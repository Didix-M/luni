export type ApplicationStatus = "preparing" | "needs_info" | "ready" | "sent" | "interview" | "offer" | "rejected" | "withdrawn";
export type SendResult = "not_sent" | "platform_confirmed" | "manual_confirmed" | "uncertain";

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  preparing: "En preparación", needs_info: "Pendiente de información", ready: "Lista para revisar", sent: "Enviada",
  interview: "Entrevista", offer: "Oferta", rejected: "Rechazada", withdrawn: "Retirada",
};
export const sendResultLabels: Record<SendResult, string> = {
  not_sent: "Aún no enviada", platform_confirmed: "Confirmada por la plataforma",
  manual_confirmed: "Confirmada manualmente", uncertain: "Resultado incierto",
};

export type Application = {
  id: string; user_id: string; job_id: string; status: ApplicationStatus; send_result: SendResult;
  submitted_at: string; confirmation_source: string; next_step: string; notes: string;
  created_at: string; updated_at: string;
  jobs?: { company: string; title: string; opening_status: string; source_url?: string | null } | null;
};

export function normalizeApplication(row: Record<string, unknown>): Application {
  const statusValues: ApplicationStatus[] = ["preparing","needs_info","ready","sent","interview","offer","rejected","withdrawn"];
  const resultValues: SendResult[] = ["not_sent","platform_confirmed","manual_confirmed","uncertain"];
  return {
    id: String(row.id ?? ""), user_id: String(row.user_id ?? ""), job_id: String(row.job_id ?? ""),
    status: statusValues.includes(row.status as ApplicationStatus) ? row.status as ApplicationStatus : "preparing",
    send_result: resultValues.includes(row.send_result as SendResult) ? row.send_result as SendResult : "not_sent",
    submitted_at: typeof row.submitted_at === "string" ? row.submitted_at : "",
    confirmation_source: typeof row.confirmation_source === "string" ? row.confirmation_source : "",
    next_step: typeof row.next_step === "string" ? row.next_step : "",
    notes: typeof row.notes === "string" ? row.notes : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    jobs: row.jobs && typeof row.jobs === "object" ? row.jobs as Application["jobs"] : null,
  };
}
