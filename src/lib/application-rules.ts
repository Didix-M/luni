import { isSensitiveQuestion, type GreenhouseQuestion } from "@/lib/greenhouse";

export type RuleRequirement = {
  text: string;
  status: "match" | "missing" | "not_evaluable";
  evidence: string;
};

export type RuleAnalysis = {
  score: number | null;
  scoreLabel: "Estimación basada en reglas";
  requirements: RuleRequirement[];
  method: string;
  panamaEligibility: { status: "confirmed" | "excluded" | "unconfirmed"; label: string; evidence: string };
};

export type RuleMapping = {
  fieldName: string;
  label: string;
  value: string;
  source: string;
};

type ConfirmedAnswer = { question?: unknown; answer_text?: unknown; variants?: unknown };

const stopWords = new Set("the and for with from this that your you are our will have has into sobre para como con una uno los las del que por sus esta este desde entre experiencia trabajo years year role team ability strong excellent responsibilities qualifications preferred required minimum must need knowledge skills".split(" "));

export function normalizeMeaning(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+#]+/g, " ").trim().replace(/\s+/g, " ");
}

function meaningfulWords(value: string) {
  return [...new Set(normalizeMeaning(value).match(/[a-z0-9+#.]{3,}/g) ?? [])].filter((word) => !stopWords.has(word));
}

function detectedRequirements(description: string) {
  const chunks = description.split(/\n+|(?<=[.!?])\s+/).map((value) => value.replace(/^[-•*]\s*/, "").trim()).filter((value) => value.length > 20);
  const marked = chunks.filter((value) => /required|requirements|must|need|minimum|years? of|experience with|proficien|fluent|requisitos|obligatorio|necesario|mínimo|experiencia con|dominio/i.test(value));
  return (marked.length ? marked : chunks).slice(0, 10);
}

function panamaEligibility(description: string, stored: string | null | undefined) {
  if (stored === "confirmed") return { status: "confirmed" as const, label: "Confirmada", evidence: "La vacante está marcada en Luni como elegible desde Panamá." };
  if (stored === "excluded") return { status: "excluded" as const, label: "No elegible", evidence: "La vacante está marcada en Luni como no elegible desde Panamá." };
  const text = normalizeMeaning(description);
  if (/worldwide|anywhere in the world|work from anywhere|global remote|cualquier lugar del mundo/.test(text)) return { status: "confirmed" as const, label: "Confirmada", evidence: "La descripción indica alcance mundial o trabajo desde cualquier lugar." };
  if (/must be based in (the )?(united states|usa|us|canada|european union|eu)|only (in|within) (the )?(united states|usa|us|canada|european union|eu)|residentes? (de|en) (estados unidos|canada|union europea)/.test(text)) return { status: "excluded" as const, label: "No elegible", evidence: "La descripción limita la residencia a una región que no incluye Panamá." };
  return { status: "unconfirmed" as const, label: "Por confirmar", evidence: "No encontramos evidencia explícita sobre elegibilidad desde Panamá." };
}

export function compareByRules(description: string, profile: Record<string, unknown>, cvText: string, storedEligibility?: string | null): RuleAnalysis {
  const corpus = normalizeMeaning(`${JSON.stringify(profile)} ${cvText}`);
  const requirements = detectedRequirements(description).map<RuleRequirement>((text) => {
    const keywords = meaningfulWords(text).filter((word) => word.length > 3);
    if (keywords.length === 0) return { text, status: "not_evaluable", evidence: "La regla no pudo aislar términos verificables." };
    const found = keywords.filter((word) => corpus.includes(word));
    const ratio = found.length / keywords.length;
    if (found.length >= 2 && ratio >= 0.25) return { text, status: "match", evidence: `Coincidencias textuales verificables: ${found.slice(0, 6).join(", ")}.` };
    if (found.length === 0) return { text, status: "missing", evidence: `No encontramos estos términos en el perfil o los CV: ${keywords.slice(0, 6).join(", ")}. Esto indica evidencia faltante, no falta de experiencia.` };
    return { text, status: "not_evaluable", evidence: `Coincidencia parcial insuficiente: ${found.slice(0, 6).join(", ")}. Requiere revisión humana.` };
  });
  const evaluable = requirements.filter((item) => item.status !== "not_evaluable");
  const score = evaluable.length ? Math.round(evaluable.filter((item) => item.status === "match").length / evaluable.length * 100) : null;
  return {
    score,
    scoreLabel: "Estimación basada en reglas",
    requirements,
    method: "Comparación textual transparente entre requisitos detectados y datos guardados. No es una probabilidad de contratación ni valida experiencia.",
    panamaEligibility: panamaEligibility(description, storedEligibility),
  };
}

function standardValue(fieldName: string, label: string, profile: Record<string, unknown>) {
  const fullName = String(profile.full_name ?? "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const normalized = normalizeMeaning(`${fieldName} ${label}`);
  const candidates: Array<[RegExp, string, string]> = [
    [/first.?name|nombre(?!.*apellido)/, parts[0] ?? "", "Nombre del perfil"],
    [/last.?name|surname|apellido/, parts.slice(1).join(" "), "Apellido del perfil"],
    [/full.?name|nombre completo/, fullName, "Nombre completo del perfil"],
    [/email|correo/, String(profile.professional_email ?? ""), "Correo profesional del perfil"],
    [/phone|telephone|telefono|movil/, String(profile.phone ?? ""), "Teléfono del perfil"],
    [/location|address|city|country|ubicacion|direccion|ciudad|pais/, String(profile.location ?? ""), "Ubicación del perfil"],
    [/linkedin/, String(profile.linkedin_url ?? ""), "LinkedIn del perfil"],
    [/portfolio|website|personal site|sitio web/, String(profile.portfolio_url ?? ""), "Portafolio del perfil"],
  ];
  return candidates.find(([pattern, value]) => pattern.test(normalized) && value.trim());
}

function exactConfirmedAnswer(label: string, answers: ConfirmedAnswer[]) {
  const target = normalizeMeaning(label);
  return answers.find((answer) => {
    const meanings = [answer.question, ...(Array.isArray(answer.variants) ? answer.variants : [])].filter((value): value is string => typeof value === "string");
    return meanings.some((value) => normalizeMeaning(value) === target);
  });
}

function salaryValue(label: string, profile: Record<string, unknown>) {
  if (!/salary|compensation|pay expectation|expected pay|salario|compensacion|expectativa salarial/i.test(label)) return undefined;
  const currency = String(profile.salary_currency ?? "").toUpperCase();
  const period = String(profile.salary_period ?? "").toLowerCase();
  const min = profile.salary_min;
  const max = profile.salary_max;
  if (!currency || !period || (min == null && max == null)) return undefined;
  const normalized = normalizeMeaning(label);
  const currencyMatches = new RegExp(`(^| )${currency.toLowerCase()}( |$)`).test(normalized);
  const periodWords: Record<string, RegExp> = { hourly: /hour|hora/, monthly: /month|mes|mensual/, yearly: /year|ano|annual|anual/ };
  if (!currencyMatches || !periodWords[period]?.test(normalized)) return undefined;
  const amount = min != null && max != null && String(min) !== String(max) ? `${min} - ${max}` : String(min ?? max);
  return { value: `${amount} ${currency} ${period}`, source: "Expectativa salarial confirmada; misma moneda y periodicidad" };
}

export function mapQuestionsByRules(questions: GreenhouseQuestion[], profile: Record<string, unknown>, answers: ConfirmedAnswer[]) {
  const mappings: RuleMapping[] = [];
  for (const question of questions) {
    if (isSensitiveQuestion(question.label) && !/salary|compensation|pay expectation|expected pay|salario|compensacion|expectativa salarial/i.test(question.label)) continue;
    for (const field of question.fields) {
      if (!["input_text", "textarea"].includes(field.type)) continue;
      const standard = standardValue(field.name, question.label, profile);
      if (standard) { mappings.push({ fieldName: field.name, label: question.label, value: standard[1], source: standard[2] }); continue; }
      const salary = salaryValue(question.label, profile);
      if (salary) { mappings.push({ fieldName: field.name, label: question.label, ...salary }); continue; }
      const exact = exactConfirmedAnswer(question.label, answers);
      const answerText = String(exact?.answer_text ?? "").trim();
      if (answerText) mappings.push({ fieldName: field.name, label: question.label, value: answerText, source: "Respuesta confirmada con significado exacto" });
    }
  }
  return mappings;
}
