"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { eligibilityLabels, normalizeJob, openingLabels, stageLabels, type Job, type OpeningStatus, type PanamaEligibility } from "@/lib/jobs";

type Sort = "compatibility" | "recent" | "company";

function Eligibility({ value }: { value: PanamaEligibility }) {
  const colors = { confirmed: "bg-[#e7f5ec] text-[#17663f]", unconfirmed: "bg-[#fff4d9] text-[#7a4e00]", excluded: "bg-[#fdecea] text-[#a4271b]" };
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${colors[value]}`}><Icon name={value === "confirmed" ? "check" : value === "excluded" ? "alert" : "pin"} className="size-3.5"/>{eligibilityLabels[value]}</span>;
}

function salary(job: Job) {
  if (!job.salary_min && !job.salary_max) return "No publicado";
  const values = [job.salary_min, job.salary_max].filter(Boolean).map((value) => Number(value).toLocaleString("es-PA"));
  const period = { hourly: "/ hora", monthly: "/ mes", yearly: "/ año" }[job.salary_period] ?? "";
  return `${job.salary_currency || ""} ${values.join(" – ")} ${period}`.trim();
}

function savedDate(value?: string) {
  return value ? new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short" }).format(new Date(value)) : "—";
}

const select = "h-11 rounded-[10px] border border-[#b9bfcb] bg-white px-3 text-sm outline-none";

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("compatibility");
  const [mode, setMode] = useState("");
  const [eligibility, setEligibility] = useState<"" | PanamaEligibility>("");
  const [opening, setOpening] = useState<"" | OpeningStatus>("");
  const [savedWithin, setSavedWithin] = useState("");
  const [minimumCompatibility, setMinimumCompatibility] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [salaryOnly, setSalaryOnly] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) { setError("Tu sesión no está disponible."); setLoading(false); } return; }
      setUserId(auth.user.id);
      const { data, error: loadError } = await supabase.from("jobs").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false });
      if (!active) return;
      if (loadError) setError(loadError.code === "42P01" ? "Falta aplicar la migración de vacantes en Supabase." : "No pudimos cargar tus vacantes.");
      else setJobs((data ?? []).map(normalizeJob));
      setCurrentTime(Date.now());
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    const cutoff = savedWithin ? currentTime - Number(savedWithin) * 86400000 : 0;
    const rows = jobs.filter((job) => {
      const text = `${job.company} ${job.title}`.toLocaleLowerCase("es");
      return (!term || text.includes(term)) && (!mode || job.workplace_mode === mode) && (!eligibility || job.panama_eligibility === eligibility) && (!opening || job.opening_status === opening) && (!cutoff || new Date(job.created_at ?? 0).getTime() >= cutoff) && (!minimumCompatibility || (job.compatibility_score != null && job.compatibility_score >= Number(minimumCompatibility))) && (!favoritesOnly || job.is_favorite) && (!salaryOnly || Boolean(job.salary_min || job.salary_max));
    });
    return rows.sort((a, b) => sort === "company" ? a.company.localeCompare(b.company, "es") : sort === "recent" ? new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime() : (b.compatibility_score ?? -1) - (a.compatibility_score ?? -1) || new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  }, [jobs, query, sort, mode, eligibility, opening, savedWithin, minimumCompatibility, favoritesOnly, salaryOnly, currentTime]);

  const hasFilters = Boolean(query || mode || eligibility || opening || savedWithin || minimumCompatibility || favoritesOnly || salaryOnly);
  function clearFilters() { setQuery(""); setMode(""); setEligibility(""); setOpening(""); setSavedWithin(""); setMinimumCompatibility(""); setFavoritesOnly(false); setSalaryOnly(false); }

  async function toggleFavorite(job: Job) {
    if (!job.id || !userId) return;
    const next = !job.is_favorite;
    setJobs((current) => current.map((item) => item.id === job.id ? { ...item, is_favorite: next } : item));
    const { error: updateError } = await createClient().from("jobs").update({ is_favorite: next }).eq("id", job.id).eq("user_id", userId);
    if (updateError) { setJobs((current) => current.map((item) => item.id === job.id ? { ...item, is_favorite: !next } : item)); setError("No pudimos guardar la favorita. Aplica la migración 202610110006 en Supabase."); }
  }

  if (loading) return <div className="mx-auto max-w-[1380px] px-5 py-10 md:px-12"><div role="status" className="animate-pulse space-y-5"><div className="h-10 w-48 rounded bg-[#dde1e8]"/><div className="h-36 rounded-2xl bg-white"/><div className="h-72 rounded-2xl bg-white"/><span className="sr-only">Cargando vacantes…</span></div></div>;

  return <div className="mx-auto max-w-[1380px] px-5 py-6 pb-28 md:px-12 md:py-10"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-muted">SEGUIMIENTO</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Vacantes</h1><p className="mt-2 text-[#4a5163]">Organiza y revisa las oportunidades guardadas en tu cuenta.</p></div><Link href="/vacantes/nueva" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy hover:bg-[#b5f02e]"><Icon name="plus" className="size-[18px]"/>Añadir vacante</Link></header>
    {error && <div role="alert" className="mt-6 rounded-xl bg-[#fdecea] p-4 font-semibold text-[#a4271b]">{error}</div>}
    <section aria-label="Filtros de vacantes" className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row"><label className="flex min-h-14 w-full min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#b9bfcb] px-3 sm:min-h-12"><Icon name="briefcase" className="size-[18px] shrink-0 text-muted"/><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar por empresa o cargo" placeholder="Buscar empresa o cargo" className="h-14 w-full min-w-0 flex-1 bg-transparent text-base outline-none sm:h-12"/></label><label className="flex items-center gap-2 text-sm font-bold text-[#4a5163]">Ordenar<select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${select} flex-1 font-normal lg:w-48`}><option value="compatibility">Compatibilidad</option><option value="recent">Más recientes</option><option value="company">Empresa A–Z</option></select></label></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-sm font-bold">Modalidad<select value={mode} onChange={(e) => setMode(e.target.value)} className={`${select} mt-1 w-full font-normal`}><option value="">Todas</option><option>Remoto</option><option>Híbrido</option><option>Presencial</option></select></label><label className="text-sm font-bold">Elegibilidad desde Panamá<select value={eligibility} onChange={(e) => setEligibility(e.target.value as "" | PanamaEligibility)} className={`${select} mt-1 w-full font-normal`}><option value="">Todas</option><option value="confirmed">Panamá confirmado</option><option value="unconfirmed">Por confirmar</option><option value="excluded">Panamá excluido</option></select></label><label className="text-sm font-bold">Apertura<select value={opening} onChange={(e) => setOpening(e.target.value as "" | OpeningStatus)} className={`${select} mt-1 w-full font-normal`}><option value="">Todas</option><option value="open">Abierta</option><option value="closed">Cerrada</option><option value="unverified">No verificada</option></select></label><label className="text-sm font-bold">Guardada<select value={savedWithin} onChange={(e) => setSavedWithin(e.target.value)} className={`${select} mt-1 w-full font-normal`}><option value="">Cualquier fecha</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select></label><label className="text-sm font-bold">Compatibilidad<select value={minimumCompatibility} onChange={(e) => setMinimumCompatibility(e.target.value)} className={`${select} mt-1 w-full font-normal`}><option value="">Cualquiera</option><option value="70">70% o más</option><option value="60">60% o más</option></select></label></div><div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold ${favoritesOnly ? "border-navy bg-navy text-white" : "border-[#b9bfcb] text-navy"}`}><Icon name="star" className={`size-4 ${favoritesOnly ? "fill-lime text-lime" : ""}`}/>Favoritas</button><button type="button" aria-pressed={salaryOnly} onClick={() => setSalaryOnly((value) => !value)} className={`h-10 rounded-full border px-4 text-sm font-bold ${salaryOnly ? "border-navy bg-navy text-white" : "border-[#b9bfcb] text-navy"}`}>Con salario</button><span className="ml-auto text-sm text-muted">{filtered.length} de {jobs.length} vacantes</span>{hasFilters && <button type="button" onClick={clearFilters} className="min-h-10 font-bold text-navy underline underline-offset-2">Limpiar filtros</button>}</div></section>

    {!error && jobs.length === 0 && <section className="mt-6 rounded-2xl border border-line bg-white px-5 py-12 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#e9f0fd] text-[#1e55b8]"><Icon name="briefcase" className="size-6"/></span><h2 className="mt-4 font-display text-xl font-bold text-navy">Todavía no tienes vacantes</h2><p className="mx-auto mt-2 max-w-md text-[#4a5163]">Analiza un enlace o añade la información manualmente para comenzar.</p><Link href="/vacantes/nueva" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-lime px-4 font-bold text-navy"><Icon name="plus" className="size-4"/>Añadir vacante</Link></section>}
    {jobs.length > 0 && filtered.length === 0 && <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center text-muted">No hay vacantes que coincidan con estos filtros.</div>}

    {filtered.length > 0 && <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white"><div role="row" className="hidden grid-cols-[36px_minmax(180px,2fr)_82px_minmax(130px,1.2fr)_155px_125px_72px_125px_18px] gap-3 border-b border-line bg-canvas px-4 py-3 text-xs font-bold text-[#4a5163] xl:grid"><span/><span>Empresa y puesto</span><span>Compat.</span><span>Modalidad y ubicación</span><span>Desde Panamá</span><span>Salario</span><span>Guardada</span><span>Estado</span><span/></div>{filtered.map((job) => <article key={job.id} className="relative grid gap-3 border-b border-[#eceef2] p-5 last:border-0 hover:bg-[#fafbfc] xl:grid-cols-[36px_minmax(180px,2fr)_82px_minmax(130px,1.2fr)_155px_125px_72px_125px_18px] xl:items-center xl:gap-3 xl:px-4"><Link href={`/vacantes/${job.id}`} aria-label={`Abrir ${job.title} en ${job.company}`} className="absolute inset-0"/><button type="button" aria-pressed={job.is_favorite} aria-label={`${job.is_favorite ? "Quitar de" : "Marcar como"} favoritas: ${job.title}`} onClick={() => toggleFavorite(job)} className="relative z-10 flex size-11 items-center justify-center rounded-xl hover:bg-[#fff4d9] xl:size-9"><Icon name="star" className={`size-5 ${job.is_favorite ? "fill-[#e0a400] text-[#b07a00]" : "text-[#8a92a3]"}`}/></button><div className="pointer-events-none"><h2 className="font-bold text-navy">{job.title}</h2><p className="mt-0.5 text-sm text-muted">{job.company}</p></div><div className="pointer-events-none"><strong className="text-lg tabular-nums text-navy">{job.compatibility_score == null ? "—" : `${job.compatibility_score}%`}</strong><span className="block text-xs text-muted">{job.compatibility_score == null ? "Pendiente" : "Orientativa"}</span></div><div className="pointer-events-none text-sm"><span className="block font-semibold">{job.workplace_mode || "Por confirmar"}</span><span className="text-muted">{job.location || "Ubicación pendiente"}</span></div><div className="pointer-events-none"><Eligibility value={job.panama_eligibility}/></div><span className={`pointer-events-none text-sm ${job.salary_min || job.salary_max ? "text-[#111]" : "text-muted"}`}>{salary(job)}</span><span className="pointer-events-none text-sm text-muted">{savedDate(job.created_at)}</span><div className="pointer-events-none"><span className="block text-sm font-bold text-navy">{stageLabels[job.tracking_stage]}</span><span className="text-xs text-muted">{openingLabels[job.opening_status]}</span></div><Icon name="chevron" className="pointer-events-none hidden size-4 text-[#8a92a3] xl:block"/><div className="pointer-events-none col-span-full grid grid-cols-2 gap-2 border-t border-line pt-3 text-sm xl:hidden"><span><strong className="block text-xs text-muted">Salario</strong>{salary(job)}</span><span><strong className="block text-xs text-muted">Guardada</strong>{savedDate(job.created_at)} · {stageLabels[job.tracking_stage]}</span></div></article>)}</div>}
  </div>;
}
