"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { applicationStatusLabels, normalizeApplication, sendResultLabels, type Application, type ApplicationStatus } from "@/lib/applications";
import { createClient } from "@/lib/supabase/client";

const statusTone: Record<ApplicationStatus, string> = { preparing:"bg-[#e9f0fd] text-[#1e55b8]", needs_info:"bg-[#fff4d9] text-[#7a4e00]", ready:"bg-[#e7f5ec] text-[#17663f]", sent:"bg-[#e7f5ec] text-[#17663f]", interview:"bg-navy text-lime", offer:"bg-lime text-navy", rejected:"bg-[#eef0f4] text-[#2e3445]", withdrawn:"bg-[#eef0f4] text-[#2e3445]" };

export function ApplicationsList() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | ApplicationStatus>("");

  useEffect(() => { let active = true; (async () => {
    const supabase = createClient(); const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { if (active) { setError("Tu sesión no está disponible."); setLoading(false); } return; }
    const { data, error: loadError } = await supabase.from("applications").select("*, jobs(company,title,opening_status,source_url)").eq("user_id", auth.user.id).order("updated_at", { ascending: false });
    if (!active) return;
    if (loadError) setError(loadError.code === "42P01" || loadError.code === "PGRST205" ? "Falta aplicar la migración de postulaciones en Supabase." : "No pudimos cargar tus postulaciones.");
    else setItems((data ?? []).map(normalizeApplication));
    setLoading(false);
  })(); return () => { active = false; }; }, []);

  const filtered = useMemo(() => items.filter((item) => `${item.jobs?.company ?? ""} ${item.jobs?.title ?? ""}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")) && (!status || item.status === status)), [items, query, status]);
  if (loading) return <div className="mx-auto max-w-[1120px] px-5 py-10 md:px-12"><div className="animate-pulse space-y-5"><div className="h-10 w-60 rounded bg-line"/><div className="h-72 rounded-2xl bg-white"/></div></div>;

  return <div className="mx-auto max-w-[1120px] px-5 py-6 md:px-12 md:py-10">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-muted">SEGUIMIENTO</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Postulaciones</h1><p className="mt-2 text-[#4a5163]">Registro privado de preparación, envíos confirmados y próximos pasos.</p></div><Link href="/postulaciones/nueva" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy"><Icon name="plus" className="size-[18px]"/>Crear postulación</Link></header>
    {error && <div role="alert" className="mt-6 rounded-xl bg-[#fdecea] p-4 font-semibold text-[#a4271b]">{error}</div>}
    <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-[1fr_260px]"><label className="flex h-12 items-center gap-2 rounded-xl border border-[#b9bfcb] px-3"><Icon name="send" className="size-[18px] text-muted"/><input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 outline-none" placeholder="Buscar empresa o cargo"/></label><select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value as "" | ApplicationStatus)} className="h-12 rounded-xl border border-[#b9bfcb] bg-white px-3"><option value="">Todos los estados</option>{Object.entries(applicationStatusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    {!error && items.length === 0 && <section className="mt-6 rounded-2xl border border-line bg-white p-10 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#e9f0fd] text-[#1e55b8]"><Icon name="send" className="size-6"/></span><h2 className="mt-4 font-display text-xl font-bold text-navy">Todavía no tienes postulaciones</h2><p className="mx-auto mt-2 max-w-md text-[#4a5163]">Crea una desde una vacante guardada. Esto solo inicia el seguimiento; no envía nada.</p><Link href="/postulaciones/nueva" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-lime px-4 font-bold text-navy"><Icon name="plus" className="size-4"/>Crear postulación</Link></section>}
    {items.length > 0 && filtered.length === 0 && <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center text-muted">No hay resultados con estos filtros.</div>}
    {filtered.length > 0 && <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">{filtered.map((item) => <Link key={item.id} href={item.status === "preparing" || item.status === "needs_info" || item.status === "ready" ? `/postulaciones/${item.id}/preparar` : `/postulaciones/${item.id}`} className="grid gap-3 border-b border-[#eceef2] p-5 last:border-0 hover:bg-[#fafbfc] lg:grid-cols-[minmax(0,1.5fr)_190px_minmax(180px,1fr)_24px] lg:items-center"><div><h2 className="font-bold text-navy">{item.jobs?.title || "Cargo no disponible"}</h2><p className="mt-1 text-sm text-muted">{item.jobs?.company || "Empresa no disponible"}</p><span className="mt-2 inline-block text-xs font-bold text-muted">Vacante: {item.jobs?.opening_status === "open" ? "Abierta" : item.jobs?.opening_status === "closed" ? "Cerrada" : "No verificada"}</span></div><span className={`w-fit rounded-full px-3 py-1.5 text-sm font-bold ${statusTone[item.status]}`}>{applicationStatusLabels[item.status]}</span><div><p className={`text-sm font-bold ${item.send_result === "uncertain" ? "text-[#a4271b]" : "text-[#4a5163]"}`}>{sendResultLabels[item.send_result]}</p><p className="mt-1 text-sm text-muted">{item.next_step || "Sin próximo paso definido"}</p></div><Icon name="chevron" className="hidden size-5 text-[#8a92a3] lg:block"/></Link>)}</div>}
  </div>;
}
