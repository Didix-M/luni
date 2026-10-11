export type AnswerStatus = "draft" | "confirmed" | "review";

export type SavedAnswer = {
  id: string;
  user_id: string;
  question: string;
  answer_text: string;
  variants: string[];
  language: "Español" | "Inglés";
  category: string;
  status: AnswerStatus;
  evidence: string[];
  archived: boolean;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnswerDraft = Pick<SavedAnswer, "question" | "answer_text" | "variants" | "language" | "category" | "evidence">;

export const emptyAnswer: AnswerDraft = { question: "", answer_text: "", variants: [], language: "Español", category: "Presentación profesional", evidence: [] };

export const answerCategories = ["Presentación profesional", "Motivación", "Experiencia", "Logros", "Trabajo en equipo", "Resolución de problemas", "Disponibilidad", "Otra"];

export const answerStatusLabels: Record<AnswerStatus, string> = { draft: "Borrador", confirmed: "Confirmada", review: "Necesita revisión" };
