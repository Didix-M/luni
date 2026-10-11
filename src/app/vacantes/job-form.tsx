"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { eligibilityLabels, emptyJob, normalizeJob, openingLabels, stageLabels, type Job, type OpeningStatus, type PanamaEligibility, type TrackingStage } from "@/lib/jobs";

type Status = "idle" | "loading" | "saving" | "success" | "error" | "deleting";
type ImportStatus = "idle" | "loading" | "success" | "error";
type ImportResult = { error?: string; job?: Partial<Job>; detected?: string[]; source?: "structured" | "metadata" };
const input = "h-12 w-full rounded-xl border border-[#b9bfcb] bg-white px-3.5 outline-none placeholder:text-[#8a92a3]";
const textarea = "min-h-32 w-full resize-y rounded-xl border border-[#b9bfcb] bg-white px-3.5 py-3 outline-none placeholder:text-[#8a92a3]";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1.5 text-[15px] font-bold text-[#2e3445]">{label}{children}{hint && <span className="text-sm font-normal text-muted">{hint}</span>}</label>; }
function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-line bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-navy">{title}</h2>{description && <p className="mt-1 text-sm text-muted">{description}</p>}<div className="mt-5">{children}</div></section>; }

async function requestImport(url: string) {
  const response = await fetch("/api/jobs/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
  const result = await response.json() as ImportResult;
  if (!response.ok || !result.job) throw new Error(result.error || "No pudimos importar la vacante.");
  return result;
}

function mergeImportedJob(current: Job, imported: Partial<Job>) {
  const next = { ...current };
  for (const key of Object.keys(imported) as (keyof Job)[]) {
    const value = imported[key];
    if (value && !current[key]) Object.assign(next, { [key]: value });
  }
  return next;
}

export function JobForm({ jobId, initialUrl = "", autoImport = false }: { jobId?: string; initialUrl?: string; autoImport?: boolean }) {
  const router = useRouter();
  const [job, setJob] = useState<Job>(() => ({ ...emptyJob, source_url: initialUrl }));
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<Status>(jobId ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>(autoImport ? "loading" : "idle");
  const [importMessage, setImportMessage] = useState(autoImport ? "Leyendo la información pública del enlace…" : "");
  const autoImportStarted = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!active || !auth.user) { if (active) { setStatus("error"); setMessage("Tu sesión no está disponible."); } return; }
      setUserId(auth.user.id);
      if (!jobId) return;
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", auth.user.id).maybeSingle();
      if (!active) return;
      if (error) { setStatus("error"); setMessage("No pudimos cargar la vacante."); }
      else if (!data) { setStatus("error"); setMessage("La vacante no existe o no pertenece a tu cuenta."); }
      else { setJob(normalizeJob(data)); setStatus("idle"); }
    }
    load();
    return () => { active = false; };
  }, [jobId]);

  useEffect(() => {
    if (!autoImport || !initialUrl || autoImportStarted.current) return;
    autoImportStarted.current = true;
    void requestImport(initialUrl).then((result) => {
      setJob((current) => mergeImportedJob(current, result.job ?? {}));
      setImportStatus("success");
      setImportMessage(result.source === "structured" ? "Encontramos datos estructurados de la vacante. Revisa cada campo antes de guardar." : "Encontramos información básica en la página. Completa y revisa los campos faltantes antes de guardar.");
    }).catch((error: unknown) => {
      setImportStatus("error");
      setImportMessage(error instanceof Error ? error.message : "No pudimos importar la vacante. Puedes completar el formulario manualmente.");
    });
  }, [autoImport, initialUrl]);

  function set<K extends keyof Job>(key: K, value: Job[K]) { setJob((current) => ({ ...current, [key]: value })); if (status === "success") { setStatus("idle"); setMessage(""); } }

  async function importFromUrl() {
    if (!job.source_url.trim()) { setImportStatus("error"); setImportMessage("Pega primero el enlace público de la vacante."); return; }
    setImportStatus("loading"); setImportMessage("Leyendo la información pública del enlace…");
    try {
      const result = await requestImport(job.source_url.trim());
      setJob((current) => mergeImportedJob(current, result.job ?? {}));
      setImportStatus("success");
      setImportMessage(result.source === "structured" ? "Encontramos datos estructurados de la vacante. Revisa cada campo antes de guardar." : "Encontramos información básica en la página. Completa y revisa los campos faltantes antes de guardar.");
    } catch (error) {
      setImportStatus("error");
      setImportMessage(error instanceof Error ? error.message : "No pudimos importar la vacante. Puedes completar el formulario manualmente.");
    }
  }

  async function save() {
    if (!job.company.trim() || !job.title.trim()) { setStatus("error"); setMessage("Completa la empresa y el cargo antes de guardar."); return; }
    if (!userId) { setStatus("error"); setMessage("Tu sesión no está disponible."); return; }
    setStatus("saving"); setMessage("");
    const payload = {
      user_id: userId, company: job.company.trim(), title: job.title.trim(), source_url: job.source_url.trim() || null,
      description: job.description.trim() || null, workplace_mode: job.workplace_mode || null, location: job.location.trim() || null,
      contract_type: job.contract_type || null, salary_min: job.salary_min ? Number(job.salary_min) : null,
      salary_max: job.salary_max ? Number(job.salary_max) : null, salary_currency: job.salary_currency || null,
      salary_period: job.salary_period || null, opening_status: job.opening_status, panama_eligibility: job.panama_eligibility,
      tracking_stage: job.tracking_stage, published_on: job.published_on || null, notes: job.notes.trim() || null,
    };
    const supabase = createClient();
    const result = jobId
      ? await supabase.from("jobs").update(payload).eq("id", jobId).eq("user_id", userId).select("id").single()
      : await supabase.from("jobs").insert(payload).select("id").single();
    if (result.error) { setStatus("error"); setMessage(result.error.code === "23514" ? "Revisa los datos: el salario máximo no puede ser menor que el mínimo." : "No pudimos guardar la vacante. Inténtalo de nuevo."); return; }
    if (!jobId) { router.replace(`/vacantes/${result.data.id}`); router.refresh(); return; }
    setStatus("success"); setMessage("Vacante guardada correctamente.");
  }

  async function remove() {
    if (!jobId || !userId || !window.confirm("¿Eliminar esta vacante? Esta acción no se puede deshacer.")) return;
    setStatus("deleting"); setMessage("");
    const { error } = await createClient().from("jobs").delete().eq("id", jobId).eq("user_id", userId);
    if (error) { setStatus("error"); setMessage("No pudimos eliminar la vacante."); return; }
    router.replace("/vacantes"); router.refresh();
  }

  if (status === "loading") return <div className="mx-auto max-w-[1000px] px-5 py-10 md:px-12"><div role="status" className="animate-pulse space-y-5"><div className="h-10 w-72 rounded bg-[#dde1e8]"/><div className="h-64 rounded-2xl bg-white"/><div className="h-64 rounded-2xl bg-white"/><span className="sr-only">Cargando vacante…</span></div></div>;

  return <div className="mx-auto max-w-[1000px] px-5 py-6 md:px-12 md:py-10">
    <Link href="/vacantes" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-muted hover:text-navy"><Icon name="chevron" className="size-4 rotate-180"/>Volver a vacantes</Link>
    <header className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-muted">{jobId ? "DETALLE DE VACANTE" : "NUEVA VACANTE"}</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">{jobId ? (job.title || "Vacante") : "Añadir vacante"}</h1><p className="mt-2 max-w-2xl text-[#4a5163]">{jobId ? "Actualiza únicamente datos comprobados." : "Pega el enlace para intentar importar los datos públicos. Siempre podrás revisar o completar el formulario manualmente."}</p></div><div className="flex flex-wrap gap-2">{jobId && <Link href="/postulaciones/nueva" className="flex h-12 items-center justify-center rounded-xl border border-navy px-4 font-bold text-navy">Crear postulación</Link>}<button type="button" onClick={save} disabled={status === "saving" || status === "deleting"} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy hover:bg-[#b5f02e] disabled:opacity-60"><Icon name="check" className="size-[18px]"/>{status === "saving" ? "Guardando…" : "Guardar vacante"}</button></div></header>
    {message && <div role={status === "error" ? "alert" : "status"} className={`mt-6 rounded-xl p-4 text-sm font-semibold ${status === "success" ? "bg-[#e7f5ec] text-[#17663f]" : "bg-[#fdecea] text-[#a4271b]"}`}>{message}</div>}
    <div className="mt-6 grid gap-6">
      <Card title="Información principal" description="Luni intentará leer información pública y datos estructurados. Algunos portales, incluido LinkedIn, pueden bloquear este acceso."><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Enlace original"><div className="flex flex-col gap-2 sm:flex-row"><input type="url" value={job.source_url} onChange={(e) => { set("source_url", e.target.value); setImportStatus("idle"); setImportMessage(""); }} className={input} placeholder="https://"/><button type="button" onClick={importFromUrl} disabled={importStatus === "loading"} className="h-12 shrink-0 rounded-xl border border-navy px-5 font-bold text-navy hover:bg-canvas disabled:cursor-wait disabled:opacity-60">{importStatus === "loading" ? "Leyendo…" : "Leer enlace"}</button></div></Field>{importMessage && <div role={importStatus === "error" ? "alert" : "status"} className={`mt-3 rounded-xl p-4 text-sm font-semibold ${importStatus === "error" ? "bg-[#fff4dc] text-[#805800]" : "bg-[#e7f5ec] text-[#17663f]"}`}>{importMessage}</div>}</div><Field label="Empresa"><input required value={job.company} onChange={(e) => set("company", e.target.value)} className={input}/></Field><Field label="Cargo"><input required value={job.title} onChange={(e) => set("title", e.target.value)} className={input}/></Field><Field label="Fecha de publicación"><input type="date" value={job.published_on} onChange={(e) => set("published_on", e.target.value)} className={input}/></Field><Field label="Etapa en Luni"><select value={job.tracking_stage} onChange={(e) => set("tracking_stage", e.target.value as TrackingStage)} className={input}>{Object.entries(stageLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div><div className="mt-4"><Field label="Descripción"><textarea value={job.description} onChange={(e) => set("description", e.target.value)} className={textarea} placeholder="Pega o resume la descripción si el portal no permite importarla."/></Field></div></Card>
      <Card title="Ubicación y elegibilidad" description="Que una vacante sea remota no confirma que acepte personas residentes en Panamá."><div className="grid gap-4 sm:grid-cols-2"><Field label="Modalidad"><select value={job.workplace_mode} onChange={(e) => set("workplace_mode", e.target.value)} className={input}><option value="">Por confirmar</option><option>Remoto</option><option>Híbrido</option><option>Presencial</option></select></Field><Field label="Ubicación publicada"><input value={job.location} onChange={(e) => set("location", e.target.value)} className={input} placeholder="País, región o ciudad"/></Field><Field label="Elegibilidad desde Panamá"><select value={job.panama_eligibility} onChange={(e) => set("panama_eligibility", e.target.value as PanamaEligibility)} className={input}>{Object.entries(eligibilityLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Estado de la vacante"><select value={job.opening_status} onChange={(e) => set("opening_status", e.target.value as OpeningStatus)} className={input}>{Object.entries(openingLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div></Card>
      <Card title="Contratación y salario" description="La moneda se conserva tal como la registras; Luni no convierte importes."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Contratación"><select value={job.contract_type} onChange={(e) => set("contract_type", e.target.value)} className={input}><option value="">Por confirmar</option><option>Empleado</option><option>Contractor</option><option>Freelance</option><option>Práctica</option></select></Field><Field label="Desde"><input type="number" min="0" step="0.01" value={job.salary_min} onChange={(e) => set("salary_min", e.target.value)} className={input}/></Field><Field label="Hasta"><input type="number" min="0" step="0.01" value={job.salary_max} onChange={(e) => set("salary_max", e.target.value)} className={input}/></Field><Field label="Moneda"><select value={job.salary_currency} onChange={(e) => set("salary_currency", e.target.value)} className={input}><option value="">Sin indicar</option><option>USD</option><option>PAB</option><option>EUR</option></select></Field><Field label="Periodicidad"><select value={job.salary_period} onChange={(e) => set("salary_period", e.target.value)} className={input}><option value="">Sin indicar</option><option value="hourly">Por hora</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></Field></div></Card>
      <Card title="Notas privadas"><Field label="Notas"><textarea value={job.notes} onChange={(e) => set("notes", e.target.value)} className={textarea} placeholder="Preguntas pendientes, fuente de verificación o próximos pasos."/></Field></Card>
    </div>
    <div className="sticky bottom-[74px] mt-6 flex items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-[0_8px_30px_rgba(16,27,53,.12)] backdrop-blur md:bottom-4">{jobId && <button type="button" onClick={remove} disabled={status === "deleting" || status === "saving"} className="h-12 rounded-xl px-4 font-bold text-[#a4271b] hover:bg-[#fdecea] disabled:opacity-60">{status === "deleting" ? "Eliminando…" : "Eliminar"}</button>}<p className="hidden flex-1 text-sm text-muted sm:block">Nada se postula ni se envía desde esta pantalla.</p><button type="button" onClick={save} disabled={status === "saving" || status === "deleting"} className="ml-auto flex h-12 items-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy disabled:opacity-60"><Icon name="check" className="size-[18px]"/>{status === "saving" ? "Guardando…" : "Guardar cambios"}</button></div>
  </div>;
}
