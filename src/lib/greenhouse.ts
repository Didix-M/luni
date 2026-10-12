export type GreenhouseField = { name: string; type: string; values?: Array<{ value: number | string; label: string }> };
export type GreenhouseQuestion = { label: string; required: boolean; fields: GreenhouseField[] };
export type GreenhouseJob = { id: number; title: string; absolute_url: string; questions?: GreenhouseQuestion[]; location_questions?: GreenhouseQuestion[]; compliance?: GreenhouseQuestion[] };

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
  return /gender|race|ethnic|disability|veteran|demographic|consent|privacy|terms|signature|password|social security|ssn|authorization to work|visa|sponsorship|salary|compensation|sexo|género|raza|discapacidad|veterano|consentimiento|autorización laboral|salario/i.test(label);
}
