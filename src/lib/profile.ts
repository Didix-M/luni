export type Experience = { role: string; company: string; start: string; end: string; description: string };
export type Education = { program: string; institution: string; start: string; end: string };
export type Language = { language: string; level: string };
export type JobPreferences = { roles: string[]; workModes: string[] };

export type Profile = {
  full_name: string;
  professional_email: string;
  phone: string;
  location: string;
  portfolio_url: string;
  linkedin_url: string;
  professional_summary: string;
  experiences: Experience[];
  education: Education[];
  skills: string[];
  languages: Language[];
  job_preferences: JobPreferences;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  salary_period: string;
  contract_types: string[];
};

export const emptyProfile: Profile = {
  full_name: "", professional_email: "", phone: "", location: "", portfolio_url: "", linkedin_url: "", professional_summary: "",
  experiences: [], education: [], skills: [], languages: [], job_preferences: { roles: [], workModes: [] },
  salary_min: "", salary_max: "", salary_currency: "", salary_period: "", contract_types: [],
};

export function normalizeProfile(row: Record<string, unknown>): Profile {
  const preferences = row.job_preferences && typeof row.job_preferences === "object" && !Array.isArray(row.job_preferences)
    ? row.job_preferences as Partial<JobPreferences>
    : {};
  return {
    ...emptyProfile,
    full_name: typeof row.full_name === "string" ? row.full_name : "",
    professional_email: typeof row.professional_email === "string" ? row.professional_email : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    location: typeof row.location === "string" ? row.location : "",
    portfolio_url: typeof row.portfolio_url === "string" ? row.portfolio_url : "",
    linkedin_url: typeof row.linkedin_url === "string" ? row.linkedin_url : "",
    professional_summary: typeof row.professional_summary === "string" ? row.professional_summary : "",
    experiences: Array.isArray(row.experiences) ? row.experiences as Experience[] : [],
    education: Array.isArray(row.education) ? row.education as Education[] : [],
    skills: Array.isArray(row.skills) ? row.skills.filter((item): item is string => typeof item === "string") : [],
    languages: Array.isArray(row.languages) ? row.languages as Language[] : [],
    job_preferences: {
      roles: Array.isArray(preferences.roles) ? preferences.roles.filter((item): item is string => typeof item === "string") : [],
      workModes: Array.isArray(preferences.workModes) ? preferences.workModes.filter((item): item is string => typeof item === "string") : [],
    },
    salary_min: row.salary_min == null ? "" : String(row.salary_min),
    salary_max: row.salary_max == null ? "" : String(row.salary_max),
    salary_currency: typeof row.salary_currency === "string" ? row.salary_currency : "",
    salary_period: typeof row.salary_period === "string" ? row.salary_period : "",
    contract_types: Array.isArray(row.contract_types) ? row.contract_types.filter((item): item is string => typeof item === "string") : [],
  };
}
