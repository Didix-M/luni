import Browserbase from "@browserbasehq/sdk";
import { chromium, type Page } from "playwright-core";
import { mapQuestionsByRules, normalizeMeaning, type RuleMapping } from "@/lib/application-rules";
import { isSensitiveQuestion, parseGreenhouseUrl, type GreenhouseJob, type GreenhouseQuestion } from "@/lib/greenhouse";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

type SubmittedAnswer = { label: string; value: string; saveForReuse?: boolean };
type RequestBody = { launchBrowser?: boolean; answers?: SubmittedAnswer[] };

function browserbaseConfiguration() {
  return ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"].filter((name) => !process.env[name]);
}

function allQuestions(job: GreenhouseJob) {
  return [...(job.questions ?? []), ...(job.location_questions ?? []), ...(job.compliance ?? [])];
}

function isSalaryQuestion(label: string) {
  return /salary|compensation|pay expectation|expected pay|salario|compensaci[oó]n|expectativa salarial/i.test(label);
}

function questionState(questions: GreenhouseQuestion[], mappings: RuleMapping[]) {
  const mappedNames = new Set(mappings.map((item) => item.fieldName));
  return questions.map((question) => ({
    label: question.label,
    required: question.required,
    sensitive: isSensitiveQuestion(question.label) && !isSalaryQuestion(question.label),
    fields: question.fields.map((field) => ({ name: field.name, type: field.type })),
    status: question.fields.some((field) => mappedNames.has(field.name)) ? "ready" as const : "pending" as const,
    source: mappings.find((item) => question.fields.some((field) => field.name === item.fieldName))?.source ?? (isSensitiveQuestion(question.label) ? "Revisión manual obligatoria" : "Sin respuesta exacta confirmada"),
  }));
}

async function fill(page: Page, questions: GreenhouseQuestion[], mappings: RuleMapping[], cv?: { file_name: string; bytes: Buffer }) {
  const report: Array<{ label: string; status: "filled" | "manual"; source: string }> = [];
  const byName = new Map(mappings.map((item) => [item.fieldName, item]));
  for (const question of questions) {
    if (isSensitiveQuestion(question.label) && !isSalaryQuestion(question.label)) {
      report.push({ label: question.label, status: "manual", source: "Revisión manual obligatoria" });
      continue;
    }
    let completed = false;
    let source = "Sin dato confirmado";
    for (const field of question.fields) {
      const locator = page.locator(`[name="${field.name.replace(/["\\]/g, "\\$&")}"]`).first();
      if (!await locator.count()) continue;
      if (field.type === "input_file" && cv && /resume|curriculum|cv\b/i.test(question.label)) {
        await locator.setInputFiles({ name: cv.file_name, mimeType: "application/pdf", buffer: cv.bytes });
        completed = true;
        source = "CV seleccionado";
        continue;
      }
      const mapped = byName.get(field.name);
      if (mapped?.value && ["input_text", "textarea"].includes(field.type)) {
        await locator.fill(mapped.value);
        completed = true;
        source = mapped.source;
      }
    }
    report.push({ label: question.label, status: completed ? "filled" : "manual", source });
  }
  return report;
}

export async function POST(request: Request, { params }: RouteContext<"/api/applications/[id]/prepare-external">) {
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as RequestBody;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const { data: application } = await supabase.from("applications")
    .select("id,user_id,selected_cv_id,selected_answer_ids,authorized_at,submission_snapshot,jobs(source_url)")
    .eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (!application) return Response.json({ error: "No encontramos la postulación." }, { status: 404 });
  if (!application.authorized_at) return Response.json({ error: "Debes completar y autorizar la revisión de Luni primero." }, { status: 409 });

  const sourceUrl = (application.jobs as unknown as { source_url?: string | null } | null)?.source_url ?? "";
  const greenhouse = parseGreenhouseUrl(sourceUrl);
  if (!greenhouse) return Response.json({ error: "Esta primera automatización admite enlaces directos de Greenhouse. La solicitud permanece guardada en Luni." }, { status: 422 });

  const jobResponse = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(greenhouse.boardToken)}/jobs/${greenhouse.jobId}?questions=true`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!jobResponse.ok) return Response.json({ error: "Greenhouse no expuso las preguntas públicas. Puedes conservar la vacante y completar su descripción manualmente." }, { status: 422 });
  const job = await jobResponse.json() as GreenhouseJob;
  const questions = allQuestions(job);
  const validLabels = new Set(questions.map((question) => normalizeMeaning(question.label)));
  const submitted = (body.answers ?? []).filter((answer) => validLabels.has(normalizeMeaning(answer.label)) && answer.value.trim()).slice(0, 100);

  for (const answer of submitted) {
    const sensitive = isSensitiveQuestion(answer.label) && !isSalaryQuestion(answer.label);
    const status = answer.saveForReuse && !sensitive ? "confirmed" : "review";
    const { data: existing } = await supabase.from("saved_answers").select("id").eq("user_id", auth.user.id).eq("question", answer.label).maybeSingle();
    const payload = { user_id: auth.user.id, question: answer.label, answer_text: answer.value.trim(), status, confirmed_at: status === "confirmed" ? new Date().toISOString() : null, category: "Otra" };
    if (existing) await supabase.from("saved_answers").update(payload).eq("id", existing.id).eq("user_id", auth.user.id);
    else await supabase.from("saved_answers").insert(payload);
  }

  const [profileResult, cvResult, answerResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", auth.user.id).maybeSingle(),
    application.selected_cv_id ? supabase.from("cv_documents").select("id,file_name,storage_path").eq("id", application.selected_cv_id).eq("user_id", auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("saved_answers").select("id,question,answer_text,variants,evidence,updated_at").eq("user_id", auth.user.id).eq("status", "confirmed").eq("archived", false),
  ]);
  const profile = (profileResult.data ?? {}) as Record<string, unknown>;
  const confirmedAnswers = answerResult.data ?? [];
  const ruleMappings = mapQuestionsByRules(questions, profile, confirmedAnswers);
  const mappedNames = new Set(ruleMappings.map((item) => item.fieldName));
  const currentMappings: RuleMapping[] = [];
  for (const answer of submitted) {
    if (isSensitiveQuestion(answer.label) && !isSalaryQuestion(answer.label)) continue;
    const question = questions.find((item) => normalizeMeaning(item.label) === normalizeMeaning(answer.label));
    for (const field of question?.fields ?? []) {
      if (["input_text", "textarea"].includes(field.type) && !mappedNames.has(field.name)) currentMappings.push({ fieldName: field.name, label: question?.label ?? answer.label, value: answer.value.trim(), source: "Respuesta revisada para esta solicitud" });
    }
  }
  const mappings = [...ruleMappings, ...currentMappings];
  const state = questionState(questions, mappings);
  const previousSnapshot = application.submission_snapshot && typeof application.submission_snapshot === "object" ? application.submission_snapshot as Record<string, unknown> : {};
  const preparedAt = new Date().toISOString();
  const externalPreparation = { platform: "Greenhouse", prepared_at: preparedAt, source_url: job.absolute_url, questions: state, mappings: mappings.map(({ fieldName, label, source }) => ({ fieldName, label, source })), manual_answers: submitted.map(({ label, value, saveForReuse }) => ({ label, value: value.trim(), saveForReuse: Boolean(saveForReuse) })) };
  const { error: snapshotError } = await supabase.from("applications").update({ submission_snapshot: { ...previousSnapshot, external_preparation: externalPreparation }, next_step: body.launchBrowser ? "Revisar el formulario externo" : "Completar el formulario externo cuando Browserbase esté disponible" }).eq("id", application.id).eq("user_id", auth.user.id);
  if (snapshotError) return Response.json({ error: "No pudimos guardar la preparación en Luni." }, { status: 500 });

  const missing = browserbaseConfiguration();
  if (!body.launchBrowser || missing.length) {
    return Response.json({ platform: "Greenhouse", prepared: true, browserAutomation: false, missing, questions: state, report: state.map((item) => ({ label: item.label, status: item.status === "ready" ? "filled" : "manual", source: item.source })), blockedSubmission: true });
  }

  let cv: { file_name: string; bytes: Buffer } | undefined;
  if (cvResult.data) {
    const { data: signed } = await supabase.storage.from("private-cvs").createSignedUrl(cvResult.data.storage_path, 60);
    if (signed?.signedUrl) {
      const response = await fetch(signed.signedUrl);
      if (response.ok) cv = { file_name: cvResult.data.file_name, bytes: Buffer.from(await response.arrayBuffer()) };
    }
  }

  try {
    const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    const session = await browserbase.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID, keepAlive: true, api_timeout: 900, browserSettings: { allowedDomains: [new URL(job.absolute_url).hostname], solveCaptchas: false, recordSession: false, logSession: false } });
    const browser = await chromium.connectOverCDP(session.connectUrl);
    try {
      const context = browser.contexts()[0] ?? await browser.newContext();
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(job.absolute_url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const report = await fill(page, questions, mappings, cv);
      await page.evaluate(() => {
        document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"]').forEach((element) => { element.disabled = true; element.setAttribute("data-luni-blocked", "true"); });
        document.querySelectorAll("form").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); event.stopImmediatePropagation(); }, true));
      });
      const live = await browserbase.sessions.debug(session.id);
      await supabase.from("application_events").insert({ user_id: auth.user.id, application_id: application.id, event_type: "external_form_prepared", title: "Formulario externo preparado", details: "Greenhouse abierto para revisión; el envío quedó bloqueado.", origin: "luni" });
      return Response.json({ platform: "Greenhouse", prepared: true, browserAutomation: true, sessionId: session.id, reviewUrl: live.debuggerFullscreenUrl, questions: state, report, blockedSubmission: true });
    } finally { await browser.close(); }
  } catch {
    return Response.json({ platform: "Greenhouse", prepared: true, browserAutomation: false, automationError: "La preparación quedó guardada, pero Browserbase no pudo abrir el formulario.", questions: state, report: state.map((item) => ({ label: item.label, status: item.status === "ready" ? "filled" : "manual", source: item.source })), blockedSubmission: true });
  }
}
