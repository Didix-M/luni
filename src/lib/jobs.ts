export type OpeningStatus = "open" | "closed" | "unverified";
export type PanamaEligibility = "confirmed" | "unconfirmed" | "excluded";
export type TrackingStage = "new" | "saved" | "approved" | "discarded";

export type Job = {
  id?: string;
  user_id?: string;
  company: string;
  title: string;
  source_url: string;
  description: string;
  workplace_mode: string;
  location: string;
  contract_type: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  salary_period: string;
  opening_status: OpeningStatus;
  panama_eligibility: PanamaEligibility;
  tracking_stage: TrackingStage;
  published_on: string;
  notes: string;
  is_favorite: boolean;
  compatibility_score: number | null;
  created_at?: string;
  updated_at?: string;
};

export const emptyJob: Job = {
  company: "", title: "", source_url: "", description: "", workplace_mode: "", location: "", contract_type: "",
  salary_min: "", salary_max: "", salary_currency: "", salary_period: "", opening_status: "unverified",
  panama_eligibility: "unconfirmed", tracking_stage: "new", published_on: "", notes: "", is_favorite: false, compatibility_score: null,
};

export const openingLabels: Record<OpeningStatus, string> = { open: "Abierta", closed: "Cerrada", unverified: "No se pudo verificar" };
export const eligibilityLabels: Record<PanamaEligibility, string> = { confirmed: "Panamá confirmado", unconfirmed: "Ubicación por confirmar", excluded: "Panamá excluido" };
export const stageLabels: Record<TrackingStage, string> = { new: "Nueva", saved: "Guardada", approved: "Aprobada", discarded: "Descartada" };

export function normalizeJob(row: Record<string, unknown>): Job {
  return {
    ...emptyJob,
    id: typeof row.id === "string" ? row.id : undefined,
    user_id: typeof row.user_id === "string" ? row.user_id : undefined,
    company: typeof row.company === "string" ? row.company : "",
    title: typeof row.title === "string" ? row.title : "",
    source_url: typeof row.source_url === "string" ? row.source_url : "",
    description: typeof row.description === "string" ? row.description : "",
    workplace_mode: typeof row.workplace_mode === "string" ? row.workplace_mode : "",
    location: typeof row.location === "string" ? row.location : "",
    contract_type: typeof row.contract_type === "string" ? row.contract_type : "",
    salary_min: row.salary_min == null ? "" : String(row.salary_min),
    salary_max: row.salary_max == null ? "" : String(row.salary_max),
    salary_currency: typeof row.salary_currency === "string" ? row.salary_currency : "",
    salary_period: typeof row.salary_period === "string" ? row.salary_period : "",
    opening_status: row.opening_status === "open" || row.opening_status === "closed" ? row.opening_status : "unverified",
    panama_eligibility: row.panama_eligibility === "confirmed" || row.panama_eligibility === "excluded" ? row.panama_eligibility : "unconfirmed",
    tracking_stage: row.tracking_stage === "saved" || row.tracking_stage === "approved" || row.tracking_stage === "discarded" ? row.tracking_stage : "new",
    published_on: typeof row.published_on === "string" ? row.published_on : "",
    notes: typeof row.notes === "string" ? row.notes : "",
    is_favorite: row.is_favorite === true,
    compatibility_score: typeof row.compatibility_score === "number" ? row.compatibility_score : null,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}
