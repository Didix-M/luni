"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { notificationAppearance, type LuniNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type Filter = "all" | "unread";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function NotificationsCenter() {
  const router = useRouter();
  const [items, setItems] = useState<LuniNotification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { let active = true; (async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { if (active) { setError("Tu sesión no está disponible."); setLoading(false); } return; }
    const { data, error: loadError } = await supabase.from("notifications").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false });
    if (!active) return;
    if (loadError) setError(loadError.code === "42P01" || loadError.code === "PGRST205" ? "Falta aplicar la migración 007 de notificaciones en Supabase." : "No pudimos cargar tus notificaciones.");
    else setItems((data ?? []) as LuniNotification[]);
    setLoading(false);
  })(); return () => { active = false; }; }, []);

  const unreadCount = items.filter((item) => !item.read_at).length;
  const visible = useMemo(() => filter === "unread" ? items.filter((item) => !item.read_at) : items, [filter, items]);

  async function markRead(item: LuniNotification, navigate = false) {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
      const { error: updateError } = await createClient().from("notifications").update({ read_at: readAt }).eq("id", item.id).eq("user_id", item.user_id);
      if (updateError) { setItems((current) => current.map((entry) => entry.id === item.id ? item : entry)); setError("No pudimos actualizar la notificación."); return; }
    }
    if (navigate && item.action_href) router.push(item.action_href);
  }

  async function markAllRead() {
    if (!unreadCount || saving) return;
    setSaving(true); setError("");
    const readAt = new Date().toISOString();
    const previous = items;
    setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    const { data: auth } = await createClient().auth.getUser();
    if (!auth.user) { setItems(previous); setError("Tu sesión no está disponible."); setSaving(false); return; }
    const { error: updateError } = await createClient().from("notifications").update({ read_at: readAt }).eq("user_id", auth.user.id).is("read_at", null);
    if (updateError) { setItems(previous); setError("No pudimos marcar las notificaciones como leídas."); }
    setSaving(false);
  }

  if (loading) return <div className="mx-auto max-w-[980px] px-5 py-10 md:px-12"><div className="animate-pulse space-y-5"><div className="h-10 w-64 rounded bg-line"/><div className="h-72 rounded-2xl bg-white"/></div></div>;

  return <div className="mx-auto max-w-[980px] px-5 pb-28 pt-6 md:px-12 md:py-10">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-muted">ACTIVIDAD</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Notificaciones</h1><p className="mt-2 text-[#4a5163]">Avisos privados sobre tus vacantes, postulaciones y próximos pasos.</p></div><button type="button" disabled={!unreadCount || saving} onClick={() => void markAllRead()} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-navy px-4 font-bold text-navy transition hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent"><Icon name="check" className="size-4"/>{saving ? "Guardando…" : "Marcar todas como leídas"}</button></header>
    {error && <div role="alert" className="mt-6 rounded-xl bg-[#fdecea] p-4 font-semibold text-[#a4271b]">{error}</div>}
    <div className="mt-6 flex gap-2" role="group" aria-label="Filtrar notificaciones"><button type="button" onClick={() => setFilter("all")} className={`h-10 rounded-full px-4 text-sm font-bold ${filter === "all" ? "bg-navy text-white" : "border border-line bg-white text-navy"}`}>Todas <span className="ml-1 opacity-70">{items.length}</span></button><button type="button" onClick={() => setFilter("unread")} className={`h-10 rounded-full px-4 text-sm font-bold ${filter === "unread" ? "bg-navy text-white" : "border border-line bg-white text-navy"}`}>Pendientes <span className="ml-1 opacity-70">{unreadCount}</span></button></div>
    {!error && visible.length === 0 && <section className="mt-5 rounded-2xl border border-line bg-white p-10 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#e9f0fd] text-[#1e55b8]"><Icon name={filter === "unread" ? "check" : "bell"} className="size-6"/></span><h2 className="mt-4 font-display text-xl font-bold text-navy">{filter === "unread" ? "Estás al día" : "Todavía no tienes notificaciones"}</h2><p className="mx-auto mt-2 max-w-md text-[#4a5163]">{filter === "unread" ? "No hay avisos pendientes por revisar." : "Aquí aparecerán los avisos internos que Luni genere a partir de tu actividad. No se muestran notificaciones de demostración."}</p></section>}
    {visible.length > 0 && <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white" aria-label="Lista de notificaciones">{visible.map((item) => { const appearance = notificationAppearance[item.type] ?? notificationAppearance.general; return <article key={item.id} className={`relative grid gap-4 border-b border-[#eceef2] p-5 last:border-0 sm:grid-cols-[48px_1fr_auto] sm:items-start ${item.read_at ? "bg-white" : "bg-[#f7faff]"}`}>{!item.read_at && <span aria-label="Sin leer" className="absolute right-4 top-4 size-2 rounded-full bg-[#1e55b8]"/>}<span className={`flex size-12 items-center justify-center rounded-xl ${appearance.className}`}><Icon name={appearance.icon} className="size-5"/></span><div className="min-w-0 pr-4"><h2 className="font-display text-lg font-bold text-navy">{item.title}</h2><p className="mt-1 text-sm leading-6 text-[#4a5163]">{item.message}</p><p className="mt-2 text-xs font-semibold text-muted">{formatDate(item.created_at)}</p></div><div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:pt-7">{item.action_href && <button type="button" onClick={() => void markRead(item, true)} className="h-10 rounded-xl bg-lime px-4 text-sm font-bold text-navy">{item.action_label || "Ver detalle"}</button>}{!item.read_at && <button type="button" onClick={() => void markRead(item)} className="h-10 px-2 text-sm font-bold text-[#1e55b8]">Marcar como leída</button>}</div></article>; })}</section>}
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-navy">Canales de notificación</h2><p className="mt-1 text-sm text-muted">Solo los avisos dentro de Luni están disponibles en esta etapa.</p><div className="mt-5 divide-y divide-[#eceef2]"><Channel icon="bell" title="En la app" status="Activo" active/><Channel icon="send" title="Correo electrónico" status="Pendiente de configurar"/><Channel icon="arrow" title="Notificaciones push" status="Pendiente de configurar"/></div></section>
  </div>;
}

function Channel({ icon, title, status, active = false }: { icon: "bell" | "send" | "arrow"; title: string; status: string; active?: boolean }) {
  return <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"><span className="flex size-10 items-center justify-center rounded-xl bg-canvas text-navy"><Icon name={icon} className="size-5"/></span><span className="min-w-0 flex-1 font-bold text-navy">{title}</span><span className={`rounded-full px-3 py-1 text-right text-xs font-bold ${active ? "bg-[#e7f5ec] text-[#17663f]" : "bg-[#eef0f4] text-muted"}`}>{status}</span></div>;
}
