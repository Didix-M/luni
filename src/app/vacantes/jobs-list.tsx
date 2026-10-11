"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { eligibilityLabels, normalizeJob, openingLabels, stageLabels, type Job, type OpeningStatus, type PanamaEligibility } from "@/lib/jobs";

function Eligibility({ value }: { value: PanamaEligibility }) {
  const colors = { confirmed: "bg-[#e7f5ec] text-[#17663f]", unconfirmed: "bg-[#fff4d9] text-[#7a4e00]", excluded: "bg-[#fdecea] text-[#a4271b]" };
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold ${colors[value]}`}><Icon name={value === "confirmed" ? "check" : value === "excluded" ? "alert" : "pin"} className="size-4" />{eligibilityLabels[value]}</span>;
}

function salary(job: Job) {
  if (!job.salary_min && !job.salary_max) return "No publicado";
  const values = [job.salary_min, job.salary_max].filter(Boolean).map((value) => Number(value).toLocaleString("es-PA"));
  const period = { hourly: "/ hora", monthly: "/ mes", yearly: "/ año" }[job.salary_period] ?? "";
  return `${job.salary_currency || ""} ${values.join(" – ")} ${period}`.trim();
}

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [eligibility, setEligibility] = useState<"" | PanamaEligibility>("");
  const [opening, setOpening] = useState<"" | OpeningStatus>("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) { setError("Tu sesión no está disponible."); setLoading(false); } return; }
      const { data, error: loadError } = await supabase.from("jobs").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false });
      if (!active) return;
      if (loadError) setError(loadError.code === "42P01" ? "Falta aplicar la migración de vacantes en Supabase." : "No pudimos cargar tus vacantes.");
      else setJobs((data ?? []).map(normalizeJob));
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => jobs.filter((job) => {
    const text = `${job.company} ${job.title}`.toLocaleLowerCase("es");
    return text.includes(query.toLocaleLowerCase("es")) && (!eligibility || job.panama_eligibility === eligibility) && (!opening || job.opening_status === opening);
  }), [jobs, query, eligibility, opening]);
  const hasFilters = Boolean(query || eligibility || opening);

  if (loading) return <div className="mx-auto max-w-[1160px] px-5 py-10 md:px-12"><div role="status" className="animate-pulse space-y-5"><div className="h-10 w-48 rounded bg-[#dde1e8]"/><div className="h-20 rounded-2xl bg-white"/><div className="h-72 rounded-2xl bg-white"/><span className="sr-only">Cargando vacantes…</span></div></div>;

  return <div className="mx-auto max-w-[1160px] px-5 py-6 md:px-12 md:py-10">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-muted">SEGUIMIENTO</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Vacantes</h1><p className="mt-2 text-[#4a5163]">Oportunidades guardadas manualmente en tu cuenta.</p></div><Link href="/vacantes/nueva" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy hover:bg-[#b5f02e]"><Icon name="plus" className="size-[18px]" />Añadir vacante</Link></header>
    {error && <div role="alert" className="mt-6 rounded-xl bg-[#fdecea] p-4 font-semibold text-[#a4271b]">{error}</div>}
    <section aria-label="Filtros" className="mt-6 rounded-2xl border border-line bg-white p-4"><div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_230px_210px]"><label className="flex h-12 items-center gap-2.5 rounded-xl border border-[#b9bfcb] px-3"><Icon name="briefcase" className="size-[18px] text-muted"/><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar por empresa o cargo" placeholder="Buscar empresa o cargo" className="min-w-0 flex-1 outline-none"/></label><label className="text-sm font-bold text-[#2e3445]"><span className="sr-only">Elegibilidad desde Panamá</span><select value={eligibility} onChange={(e) => setEligibility(e.target.value as "" | PanamaEligibility)} className="h-12 w-full rounded-xl border border-[#b9bfcb] bg-white px-3 font-normal"><option value="">Toda elegibilidad</option><option value="confirmed">Panamá confirmado</option><option value="unconfirmed">Ubicación por confirmar</option><option value="excluded">Panamá excluido</option></select></label><label><span className="sr-only">Estado de apertura</span><select value={opening} onChange={(e) => setOpening(e.target.value as "" | OpeningStatus)} className="h-12 w-full rounded-xl border border-[#b9bfcb] bg-white px-3"><option value="">Cualquier apertura</option><option value="open">Abierta</option><option value="closed">Cerrada</option><option value="unverified">No se pudo verificar</option></select></label></div><div className="mt-3 flex items-center justify-between text-sm text-muted"><span>{filtered.length} {filtered.length === 1 ? "vacante" : "vacantes"}</span>{hasFilters && <button type="button" onClick={() => { setQuery(""); setEligibility(""); setOpening(""); }} className="min-h-9 font-bold text-navy underline underline-offset-2">Limpiar filtros</button>}</div></section>

    {!error && jobs.length === 0 && <section className="mt-6 rounded-2xl border border-line bg-white px-5 py-12 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#e9f0fd] text-[#1e55b8]"><Icon name="briefcase" className="size-6"/></span><h2 className="mt-4 font-display text-xl font-bold text-navy">Todavía no tienes vacantes</h2><p className="mx-auto mt-2 max-w-md text-[#4a5163]">Añade la primera manualmente. Luni no leerá enlaces ni supondrá información que no hayas confirmado.</p><Link href="/vacantes/nueva" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-lime px-4 font-bold text-navy"><Icon name="plus" className="size-4"/>Añadir vacante</Link></section>}
    {jobs.length > 0 && filtered.length === 0 && <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center text-muted">No hay vacantes que coincidan con estos filtros.</div>}

    {filtered.length > 0 && <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white"><div className="hidden grid-cols-[minmax(0,2fr)_minmax(150px,1fr)_170px_140px_24px] gap-4 border-b border-line bg-canvas px-5 py-3 text-sm font-bold text-[#4a5163] lg:grid"><span>Empresa y puesto</span><span>Modalidad y ubicación</span><span>Desde Panamá</span><span>Estado</span><span/></div>{filtered.map((job) => <Link key={job.id} href={`/vacantes/${job.id}`} className="grid gap-3 border-b border-[#eceef2] px-5 py-[18px] last:border-0 hover:bg-[#fafbfc] lg:grid-cols-[minmax(0,2fr)_minmax(150px,1fr)_170px_140px_24px] lg:items-center lg:gap-4"><div><h2 className="font-bold text-navy">{job.title}</h2><p className="mt-1 text-sm text-muted">{job.company} · {salary(job)}</p><span className="mt-2 inline-block rounded-md bg-canvas px-2 py-1 text-xs font-bold text-muted lg:hidden">Compatibilidad: no evaluada</span></div><div className="text-sm"><span className="block font-semibold">{job.workplace_mode || "Modalidad pendiente"}</span><span className="text-muted">{job.location || "Ubicación pendiente"}</span></div><Eligibility value={job.panama_eligibility}/><div className="flex flex-wrap gap-2 lg:block"><span className="block text-sm font-bold text-navy">{openingLabels[job.opening_status]}</span><span className="text-sm text-muted">{stageLabels[job.tracking_stage]}</span></div><Icon name="chevron" className="hidden size-5 text-[#8a92a3] lg:block"/></Link>)}</div>}
  </div>;
}
