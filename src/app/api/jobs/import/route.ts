import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { createClient } from "@/lib/supabase/server";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

type ImportedJob = {
  company?: string;
  title?: string;
  description?: string;
  workplace_mode?: string;
  location?: string;
  contract_type?: string;
  salary_min?: string;
  salary_max?: string;
  salary_currency?: string;
  salary_period?: string;
  published_on?: string;
};

function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || /^fe[89ab]/i.test(address)) return true;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const ipv4 = mapped ?? (isIP(address) === 4 ? address : "");
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function validateUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("Usa un enlace público http o https válido.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("El enlace usa un puerto que Luni no permite consultar.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("El enlace debe apuntar a un sitio público.");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("El enlace no puede apuntar a una red privada.");
  return url;
}

async function fetchPublicHtml(initialUrl: string) {
  let url = await validateUrl(initialUrl);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: { "user-agent": "Luni Job Importer/1.0", accept: "text/html,application/xhtml+xml" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("El sitio redirigió demasiadas veces.");
      url = await validateUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "El portal bloqueó la lectura automática. Puedes copiar la descripción manualmente." : `El sitio respondió con estado ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("El enlace no devolvió una página HTML.");
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_HTML_BYTES) throw new Error("La página es demasiado grande para importarla.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No pudimos leer la respuesta del sitio.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) { await reader.cancel(); throw new Error("La página es demasiado grande para importarla."); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  }
  throw new Error("No pudimos abrir el enlace.");
}

function findJobPosting(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findJobPosting(item); if (found) return found; }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const object = value as Record<string, unknown>;
  const types = Array.isArray(object["@type"]) ? object["@type"] : [object["@type"]];
  if (types.some((type) => type === "JobPosting")) return object;
  return findJobPosting(object["@graph"]);
}

function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function objectValue(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

function plainText(html: string) {
  return cheerio.load(`<body>${html}</body>`)("body").text().replace(/\s+/g, " ").trim();
}

function parseJob(html: string) {
  const $ = cheerio.load(html);
  let posting: Record<string, unknown> | undefined;
  $('script[type="application/ld+json"]').each((_, element) => {
    if (posting) return;
    try { posting = findJobPosting(JSON.parse($(element).text())); } catch { /* Ignore invalid publisher JSON-LD. */ }
  });
  const result: ImportedJob = {};
  const detected: string[] = [];
  let source: "structured" | "metadata" = "metadata";

  if (posting) {
    source = "structured";
    const organization = objectValue(posting.hiringOrganization);
    const locationRoot = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation;
    const address = objectValue(objectValue(locationRoot).address);
    const location = [address.addressLocality, address.addressRegion, address.addressCountry].map(stringValue).filter(Boolean).join(", ");
    const salary = objectValue(posting.baseSalary);
    const salaryValue = objectValue(salary.value);
    const min = salaryValue.minValue ?? (typeof salaryValue.value === "number" ? salaryValue.value : undefined);
    const max = salaryValue.maxValue;
    const unit = stringValue(salaryValue.unitText).toUpperCase();
    const employment = Array.isArray(posting.employmentType) ? posting.employmentType.join(" ") : stringValue(posting.employmentType);
    Object.assign(result, {
      title: stringValue(posting.title),
      company: stringValue(organization.name),
      description: plainText(stringValue(posting.description)),
      location,
      workplace_mode: stringValue(posting.jobLocationType).toUpperCase() === "TELECOMMUTE" ? "Remoto" : "",
      contract_type: /CONTRACTOR|CONTRACT|TEMPORARY/i.test(employment) ? "Contractor" : /INTERN/i.test(employment) ? "Práctica" : /FULL_TIME|PART_TIME|PERMANENT/i.test(employment) ? "Empleado" : "",
      salary_min: min == null ? "" : String(min),
      salary_max: max == null ? "" : String(max),
      salary_currency: stringValue(posting.salaryCurrency),
      salary_period: /HOUR/.test(unit) ? "hourly" : /MONTH/.test(unit) ? "monthly" : /YEAR/.test(unit) ? "yearly" : "",
      published_on: stringValue(posting.datePosted).slice(0, 10),
    });
  } else {
    const meta = (property: string) => $(`meta[property="${property}"]`).attr("content")?.trim() || $(`meta[name="${property}"]`).attr("content")?.trim() || "";
    result.title = meta("og:title") || $("title").text().trim();
    result.company = meta("og:site_name");
    result.description = meta("description") || meta("og:description");
  }

  for (const [key, value] of Object.entries(result)) if (value) detected.push(key);
  return { job: result, detected, source };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || body.url.length > 2048) return Response.json({ error: "Introduce un enlace válido." }, { status: 400 });
    const html = await fetchPublicHtml(body.url.trim());
    const parsed = parseJob(html);
    if (parsed.detected.length === 0) return Response.json({ error: "La página no expone información que Luni pueda reconocer. Copia los datos manualmente." }, { status: 422 });
    return Response.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos importar la vacante.";
    return Response.json({ error: message }, { status: 422 });
  }
}
