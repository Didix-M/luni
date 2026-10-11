"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { answerCategories, answerStatusLabels, emptyAnswer, type AnswerDraft, type AnswerStatus, type SavedAnswer } from "@/lib/answers";
import { createClient } from "@/lib/supabase/client";

type View = "list" | "editor";
type UiStatus = "idle" | "loading" | "saving" | "success" | "error";
const input = "h-12 w-full rounded-xl border border-[#b9bfcb] bg-white px-3.5 outline-none placeholder:text-[#8a92a3]";
const textarea = "min-h-36 w-full resize-y rounded-xl border border-[#b9bfcb] bg-white px-3.5 py-3 outline-none placeholder:text-[#8a92a3]";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-[15px] font-bold text-[#2e3445]">{label}{children}{hint && <span className="text-sm font-normal text-muted">{hint}</span>}</label>;
}

function statusClass(status: AnswerStatus, archived: boolean) {
  if (archived) return "bg-[#eef0f4] text-[#2e3445]";
  if (status === "confirmed") return "bg-[#e7f5ec] text-[#17663f]";
  if (status === "review") return "bg-[#fff4d9] text-[#7a4e00]";
  return "bg-[#e9f0fd] text-[#1e55b8]";
}

export function AnswersManager() {
  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [userId, setUserId] = useState("");
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<SavedAnswer | null>(null);
  const [form, setForm] = useState<AnswerDraft>(emptyAnswer);
  const [status, setStatus] = useState<UiStatus>("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [answerStatus, setAnswerStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [salary, setSalary] = useState("");

  async function load(id: string) {
    const supabase = createClient();
    const [{ data, error }, { data: profile }] = await Promise.all([
      supabase.from("saved_answers").select("*").eq("user_id", id).order("updated_at", { ascending: false }),
      supabase.from("profiles").select("salary_min,salary_max,salary_currency,salary_period").eq("user_id", id).maybeSingle(),
    ]);
    if (error) throw error;
    setAnswers((data ?? []) as SavedAnswer[]);
    if (profile?.salary_min) {
      const amount = profile.salary_max && profile.salary_max !== profile.salary_min ? `${profile.salary_min}–${profile.salary_max}` : String(profile.salary_min);
      const period = profile.salary_period === "yearly" ? "al año" : profile.salary_period === "hourly" ? "por hora" : profile.salary_period === "monthly" ? "al mes" : "";
      setSalary(`${amount} ${profile.salary_currency ?? ""} ${period}`.trim());
    }
  }

  useEffect(() => {
    let active = true;
    async function start() {
      const { data } = await createClient().auth.getUser();
      if (!active) return;
      if (!data.user) { setStatus("error"); setMessage("Tu sesión no está disponible."); return; }
      setUserId(data.user.id);
      try { await load(data.user.id); setStatus("idle"); }
      catch { setStatus("error"); setMessage("No pudimos cargar tus respuestas. Aplica la migración 202610110005 en Supabase."); }
    }
    start();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return answers.filter((answer) => (showArchived || !answer.archived) && (!term || `${answer.question} ${answer.answer_text} ${answer.variants.join(" ")}`.toLowerCase().includes(term)) && (!category || answer.category === category) && (!language || answer.language === language) && (!answerStatus || answer.status === answerStatus));
  }, [answers, query, category, language, answerStatus, showArchived]);

  function openEditor(answer?: SavedAnswer) {
    setEditing(answer ?? null);
    setForm(answer ? { question: answer.question, answer_text: answer.answer_text, variants: answer.variants, language: answer.language, category: answer.category, evidence: answer.evidence } : emptyAnswer);
    setMessage(""); setStatus("idle"); setView("editor"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(nextStatus: AnswerStatus) {
    if (!form.question.trim()) { setStatus("error"); setMessage("Escribe la pregunta o el tema de la respuesta."); return; }
    if (nextStatus === "confirmed" && !form.answer_text.trim()) { setStatus("error"); setMessage("Escribe una respuesta antes de confirmarla."); return; }
    setStatus("saving"); setMessage("");
    const payload = {
      user_id: userId, question: form.question.trim(), answer_text: form.answer_text.trim(),
      variants: form.variants.map((item) => item.trim()).filter(Boolean), language: form.language, category: form.category,
      evidence: form.evidence.map((item) => item.trim()).filter(Boolean), status: nextStatus,
      confirmed_at: nextStatus === "confirmed" ? new Date().toISOString() : null,
    };
    const supabase = createClient();
    const result = editing
      ? await supabase.from("saved_answers").update(payload).eq("id", editing.id).eq("user_id", userId)
      : await supabase.from("saved_answers").insert(payload);
    if (result.error) { setStatus("error"); setMessage("No pudimos guardar la respuesta."); return; }
    await load(userId); setView("list"); setEditing(null); setStatus("success");
    setMessage(nextStatus === "confirmed" ? "Respuesta confirmada y guardada." : nextStatus === "review" ? "Respuesta guardada como pendiente de revisión." : "Borrador guardado.");
  }

  async function toggleArchive(answer: SavedAnswer) {
    const { error } = await createClient().from("saved_answers").update({ archived: !answer.archived }).eq("id", answer.id).eq("user_id", userId);
    if (error) { setStatus("error"); setMessage("No pudimos cambiar el estado de la respuesta."); return; }
    await load(userId); setView("list"); setStatus("success"); setMessage(answer.archived ? "Respuesta restaurada." : "Respuesta archivada.");
  }

  async function remove(answer: SavedAnswer) {
    if (!window.confirm("¿Eliminar esta respuesta definitivamente? Las copias históricas de futuras postulaciones deberán conservarse por separado.")) return;
    const { error } = await createClient().from("saved_answers").delete().eq("id", answer.id).eq("user_id", userId);
    if (error) { setStatus("error"); setMessage("No pudimos eliminar la respuesta."); return; }
    await load(userId); setView("list"); setEditing(null); setStatus("success"); setMessage("Respuesta eliminada.");
  }

  if (status === "loading") return <div className="mx-auto max-w-[1100px] px-5 py-10 md:px-12"><div className="animate-pulse space-y-5"><div className="h-10 w-64 rounded bg-[#dde1e8]"/><div className="h-28 rounded-2xl bg-white"/><div className="h-72 rounded-2xl bg-white"/></div></div>;

  if (view === "editor") return <div className="mx-auto max-w-[900px] px-5 py-6 pb-28 md:px-12 md:py-10"><button type="button" onClick={() => setView("list")} className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-muted hover:text-navy"><Icon name="chevron" className="size-4 rotate-180"/>Mis respuestas</button><header className="mt-2"><p className="text-sm font-bold text-muted">BIBLIOTECA PERSONAL</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy">{editing ? "Editar respuesta" : "Nueva respuesta"}</h1><p className="mt-2 text-[#4a5163]">Guarda únicamente información real que puedas revisar antes de usar en una postulación.</p></header>{message && <div role="alert" className="mt-6 rounded-xl bg-[#fdecea] p-4 text-sm font-semibold text-[#a4271b]">{message}</div>}<section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6"><div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Pregunta o tema"><input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className={input} placeholder="Ej.: ¿Qué te motiva de este puesto?"/></Field></div><div className="sm:col-span-2"><Field label="Respuesta"><textarea value={form.answer_text} onChange={(e) => setForm({ ...form, answer_text: e.target.value })} className={textarea} placeholder="Escribe una respuesta basada en datos reales."/></Field></div><Field label="Idioma"><select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as AnswerDraft["language"] })} className={input}><option>Español</option><option>Inglés</option></select></Field><Field label="Categoría"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input}>{answerCategories.map((item) => <option key={item}>{item}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Otras formas de preguntar esto" hint="Sepáralas con una línea nueva."><textarea value={form.variants.join("\n")} onChange={(e) => setForm({ ...form, variants: e.target.value.split("\n") })} className="min-h-24 w-full resize-y rounded-xl border border-[#b9bfcb] px-3.5 py-3 outline-none"/></Field></div><div className="sm:col-span-2"><Field label="Evidencia profesional usada" hint="Una fuente confirmada por línea: proyecto, experiencia, métrica o dato de tu perfil."><textarea value={form.evidence.join("\n")} onChange={(e) => setForm({ ...form, evidence: e.target.value.split("\n") })} className="min-h-24 w-full resize-y rounded-xl border border-[#b9bfcb] px-3.5 py-3 outline-none"/></Field></div></div></section><div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 sm:flex-row">{editing && <><button type="button" onClick={() => toggleArchive(editing)} className="h-12 px-4 font-bold text-muted">{editing.archived ? "Restaurar" : "Archivar"}</button><button type="button" onClick={() => remove(editing)} className="h-12 px-4 font-bold text-[#a4271b]">Eliminar</button></>}<span className="flex-1"/><button type="button" onClick={() => save("draft")} disabled={status === "saving"} className="h-12 rounded-xl border border-navy px-5 font-bold text-navy">Guardar borrador</button><button type="button" onClick={() => save("review")} disabled={status === "saving"} className="h-12 rounded-xl bg-[#fff4d9] px-5 font-bold text-[#7a4e00]">Necesita revisión</button><button type="button" onClick={() => save("confirmed")} disabled={status === "saving"} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy"><Icon name="check" className="size-[18px]"/>{status === "saving" ? "Guardando…" : "Confirmar respuesta"}</button></div></div>;

  return <div className="mx-auto max-w-[1100px] px-5 py-6 pb-28 md:px-12 md:py-10"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-muted">BIBLIOTECA PERSONAL</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Mis respuestas</h1><p className="mt-2 max-w-2xl text-[#4a5163]">Textos que podrás adaptar a cada vacante. Usarlos en una solicitud nunca modificará el original.</p></div><button type="button" onClick={() => openEditor()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy"><Icon name="plus" className="size-[18px]"/>Añadir respuesta</button></header>{message && <div role={status === "error" ? "alert" : "status"} className={`mt-6 rounded-xl p-4 text-sm font-semibold ${status === "error" ? "bg-[#fdecea] text-[#a4271b]" : "bg-[#e7f5ec] text-[#17663f]"}`}>{message}</div>}
    {salary && <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center"><span className="flex size-11 items-center justify-center rounded-xl bg-[#e9f0fd] text-[#1e55b8]"><Icon name="briefcase" className="size-5"/></span><div className="flex-1"><h2 className="font-bold text-navy">Expectativa salarial</h2><p className="text-sm text-[#4a5163]">{salary} · proviene de tus preferencias laborales, no de una respuesta guardada.</p></div><Link href="/perfil" className="font-bold text-navy underline underline-offset-4">Editar</Link></section>}
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="sm:col-span-2"><span className="sr-only">Buscar respuestas</span><input value={query} onChange={(e) => setQuery(e.target.value)} className={input} placeholder="Buscar pregunta o texto"/></label><select aria-label="Filtrar por categoría" value={category} onChange={(e) => setCategory(e.target.value)} className={input}><option value="">Todas las categorías</option>{answerCategories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filtrar por idioma" value={language} onChange={(e) => setLanguage(e.target.value)} className={input}><option value="">Todos los idiomas</option><option>Español</option><option>Inglés</option></select><select aria-label="Filtrar por estado" value={answerStatus} onChange={(e) => setAnswerStatus(e.target.value)} className={input}><option value="">Todos los estados</option>{Object.entries(answerStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="flex min-h-12 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-5 accent-[#101b35]"/>Mostrar archivadas</label></div><p className="mt-4 text-sm text-muted">{filtered.length} {filtered.length === 1 ? "respuesta" : "respuestas"}</p></section>
    <div className="mt-4 grid gap-3">{filtered.length === 0 ? <section className="rounded-2xl border border-dashed border-[#8a92a3] bg-white p-7"><h2 className="font-display text-xl font-bold text-navy">{answers.length ? "Ninguna respuesta coincide" : "Aún no tienes respuestas"}</h2><p className="mt-2 text-sm text-muted">{answers.length ? "Prueba con menos filtros." : "Añade tu primera respuesta para construir tu biblioteca personal."}</p></section> : filtered.map((answer) => <button type="button" key={answer.id} onClick={() => openEditor(answer)} className={`rounded-2xl border border-line p-5 text-left ${answer.archived ? "bg-[#fafbfc]" : "bg-white"}`}><span className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(answer.status, answer.archived)}`}>{answer.archived ? "Archivada" : answerStatusLabels[answer.status]}</span><span className="text-sm text-muted">{answer.category} · {answer.language} · actualizada {new Intl.DateTimeFormat("es-PA", { dateStyle: "medium" }).format(new Date(answer.updated_at))}</span></span><h2 className="mt-3 text-[17px] font-bold text-navy">{answer.question}</h2><p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-[#2e3445]">{answer.answer_text || "Sin contenido. Escríbela antes de confirmarla."}</p></button>)}</div>
    <aside className="mt-5 flex gap-3 rounded-xl border border-[#e8b4ae] bg-[#fff7f6] p-4 text-sm leading-relaxed text-[#5a1710]"><Icon name="shield" className="mt-0.5 size-5 shrink-0"/><p>Contraseñas, preguntas de seguridad, declaraciones legales, consentimientos y autorización laboral no se guardan aquí. Debes confirmarlos directamente en cada solicitud.</p></aside>
  </div>;
}
