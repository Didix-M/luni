import Anthropic from "@anthropic-ai/sdk";
import Browserbase from "@browserbasehq/sdk";
import { chromium, type Page } from "playwright-core";
import { createClient } from "@/lib/supabase/server";
import { isSensitiveQuestion, parseGreenhouseUrl, type GreenhouseJob, type GreenhouseQuestion } from "@/lib/greenhouse";

export const maxDuration = 120;

type Mapping = { fieldName: string; label: string; value: string; source: string; confidence: "high" | "medium"; manualReview: boolean };

function requiredConfiguration() {
  return ["ANTHROPIC_API_KEY", "BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"].filter((name) => !process.env[name]);
}

function standardValue(name: string, profile: Record<string, unknown>) {
  const fullName = String(profile.full_name ?? "").trim();
  const parts = fullName.split(/\s+/);
  const values: Record<string, string> = {
    first_name: parts[0] ?? "", last_name: parts.slice(1).join(" "), email: String(profile.professional_email ?? ""),
    phone: String(profile.phone ?? ""), linkedin_profile: String(profile.linkedin_url ?? ""), website: String(profile.portfolio_url ?? ""),
  };
  return values[name] ?? "";
}

async function claudeMappings(questions: GreenhouseQuestion[], profile: Record<string, unknown>, answers: Array<Record<string, unknown>>) {
  const candidates = questions.flatMap((question) => question.fields.map((field) => ({ label: question.label, required: question.required, name: field.name, type: field.type, values: field.values ?? [] }))).filter((field) => ["input_text", "textarea"].includes(field.type) && !standardValue(field.name, profile) && !isSensitiveQuestion(field.label));
  if (!candidates.length) return [];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 3000,
    system: "Map confirmed candidate facts to job application fields. Never invent, infer sensitive/legal answers, or answer work authorization, visa, salary, consent, demographic, disability, veteran, identity, or signature questions. Return only fields directly supported by the supplied profile or confirmed saved answers.",
    messages: [{ role: "user", content: JSON.stringify({ fields: candidates, profile, confirmedSavedAnswers: answers }) }],
    output_config: { format: { type: "json_schema", schema: { type: "object", additionalProperties: false, properties: { mappings: { type: "array", items: { type: "object", additionalProperties: false, properties: { fieldName: { type: "string" }, label: { type: "string" }, value: { type: "string" }, source: { type: "string" }, confidence: { type: "string", enum: ["high", "medium"] }, manualReview: { type: "boolean" } }, required: ["fieldName", "label", "value", "source", "confidence", "manualReview"] } } }, required: ["mappings"] } } },
  });
  const text = message.content.find((block) => block.type === "text")?.text;
  if (!text) return [];
  const parsed = JSON.parse(text) as { mappings?: Mapping[] };
  const allowed = new Set(candidates.map((field) => field.name));
  return (parsed.mappings ?? []).filter((item) => allowed.has(item.fieldName) && item.value.trim() && !isSensitiveQuestion(item.label));
}

async function fill(page: Page, questions: GreenhouseQuestion[], mappings: Mapping[], profile: Record<string, unknown>, cv?: { file_name: string; bytes: Buffer }) {
  const report: Array<{ label: string; status: "filled" | "manual"; source: string }> = [];
  const byName = new Map(mappings.map((item) => [item.fieldName, item]));
  for (const question of questions) {
    if (isSensitiveQuestion(question.label)) { report.push({ label: question.label, status: "manual", source: "Revisión obligatoria" }); continue; }
    let completed = false;
    for (const field of question.fields) {
      const locator = page.locator(`[name="${field.name.replace(/["\\]/g, "\\$&")}"]`).first();
      if (!await locator.count()) continue;
      if (field.type === "input_file" && cv) { await locator.setInputFiles({ name: cv.file_name, mimeType: "application/pdf", buffer: cv.bytes }); completed = true; continue; }
      const direct = standardValue(field.name, profile);
      const mapped = byName.get(field.name);
      const value = direct || mapped?.value || "";
      if (value && ["input_text", "textarea"].includes(field.type)) { await locator.fill(value); completed = true; }
    }
    report.push({ label: question.label, status: completed ? "filled" : "manual", source: completed ? "Perfil, CV o respuesta confirmada" : "Sin dato confirmado" });
  }
  return report;
}

export async function POST(_: Request, { params }: RouteContext<"/api/applications/[id]/prepare-external">) {
  const missing = requiredConfiguration();
  if (missing.length) return Response.json({ error: "Falta configurar la automatización.", missing }, { status: 503 });
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const { data: application } = await supabase.from("applications").select("id,user_id,selected_cv_id,selected_answer_ids,authorized_at,jobs(source_url)").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (!application) return Response.json({ error: "No encontramos la postulación." }, { status: 404 });
  if (!application.authorized_at) return Response.json({ error: "Debes completar y autorizar la revisión de Luni primero." }, { status: 409 });
  const sourceUrl = (application.jobs as unknown as { source_url?: string | null } | null)?.source_url ?? "";
  const greenhouse = parseGreenhouseUrl(sourceUrl);
  if (!greenhouse) return Response.json({ error: "La primera prueba solo admite enlaces directos de Greenhouse." }, { status: 422 });
  const [jobResponse, profileResult, cvResult, answerResult] = await Promise.all([
    fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(greenhouse.boardToken)}/jobs/${greenhouse.jobId}?questions=true`, { signal: AbortSignal.timeout(15000) }),
    supabase.from("profiles").select("*").eq("user_id", auth.user.id).maybeSingle(),
    application.selected_cv_id ? supabase.from("cv_documents").select("id,file_name,storage_path").eq("id", application.selected_cv_id).eq("user_id", auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("saved_answers").select("id,question,answer_text,evidence,updated_at").eq("user_id", auth.user.id).in("id", application.selected_answer_ids ?? []).eq("status", "confirmed"),
  ]);
  if (!jobResponse.ok) return Response.json({ error: "Greenhouse no expuso el formulario de esta vacante." }, { status: 422 });
  const job = await jobResponse.json() as GreenhouseJob;
  const questions = [...(job.questions ?? []), ...(job.location_questions ?? [])];
  const profile = (profileResult.data ?? {}) as Record<string, unknown>;
  const mappings = await claudeMappings(questions, profile, answerResult.data ?? []);
  let cv: { file_name: string; bytes: Buffer } | undefined;
  if (cvResult.data) {
    const { data: signed } = await supabase.storage.from("private-cvs").createSignedUrl(cvResult.data.storage_path, 60);
    if (signed?.signedUrl) { const response = await fetch(signed.signedUrl); if (response.ok) cv = { file_name: cvResult.data.file_name, bytes: Buffer.from(await response.arrayBuffer()) }; }
  }
  const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await browserbase.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID, keepAlive: true, api_timeout: 900, browserSettings: { allowedDomains: [new URL(job.absolute_url).hostname], solveCaptchas: false, recordSession: false, logSession: false } });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(job.absolute_url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const report = await fill(page, questions, mappings, profile, cv);
    await page.evaluate(() => { document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]').forEach((element) => { element.disabled = true; element.setAttribute("data-luni-blocked", "true"); }); document.querySelectorAll("form").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); event.stopImmediatePropagation(); }, true)); });
    const live = await browserbase.sessions.debug(session.id);
    await supabase.from("application_events").insert({ user_id: auth.user.id, application_id: application.id, event_type: "external_form_prepared", title: "Formulario externo preparado", details: "Greenhouse abierto para revisión; el envío quedó bloqueado.", origin: "luni" });
    return Response.json({ platform: "Greenhouse", sessionId: session.id, reviewUrl: live.debuggerFullscreenUrl, report, blockedSubmission: true });
  } finally { await browser.close(); }
}
