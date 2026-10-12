export type GreenhouseField = { name: string; type: string; values?: Array<{ value: number | string; label: string }> };
export type GreenhouseQuestion = { label: string; required: boolean; fields: GreenhouseField[] };
export type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  content?: string;
  updated_at?: string;
  location?: { name?: string };
  offices?: Array<{ name?: string; location?: string }>;
  departments?: Array<{ name?: string }>;
  metadata?: Array<{ name?: string; value?: unknown }>;
  questions?: GreenhouseQuestion[];
  location_questions?: GreenhouseQuestion[];
  compliance?: GreenhouseQuestion[];
};

export type GreenhouseBoard = { name?: string };

export function parseGreenhouseUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith("greenhouse.io")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const jobsIndex = parts.indexOf("jobs");
  const boardToken = jobsIndex > 0 ? parts[jobsIndex - 1] : url.searchParams.get("for");
  const rawJobId = jobsIndex >= 0 ? parts[jobsIndex + 1] : url.searchParams.get("token") ?? url.searchParams.get("gh_jid");
  const jobId = rawJobId?.match(/^\d+/)?.[0];
  return boardToken && jobId ? { boardToken, jobId } : null;
}

export function isSensitiveQuestion(label: string) {
  return /gender|pronoun|sexual orientation|race|ethnic|disability|veteran|demographic|age|date of birth|marital|religion|citizenship|criminal|security clearance|indigenous|consent|privacy|terms|signature|password|social security|ssn|authori[sz](?:ation|ed) to work|work authori[sz]ation|visa|sponsorship|salary|compensation|sexo|género|pronombre|orientación sexual|raza|etnia|discapacidad|veterano|demogr|edad|fecha de nacimiento|estado civil|religión|ciudadanía|antecedentes|consentimiento|privacidad|firma|autorización laboral|permiso de trabajo|visado|patrocinio|salario|compensación/i.test(label);
}
