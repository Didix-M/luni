"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const primary = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/vacantes", label: "Vacantes", icon: "briefcase" },
  { href: "/postulaciones", label: "Postulaciones", icon: "send" },
  { href: "/cv", label: "Mis CV", icon: "file" },
  { href: "/perfil", label: "Perfil", icon: "user" },
] satisfies { href: string; label: string; icon: IconName; count?: string }[];

function Brand({ dark = false }: { dark?: boolean }) {
  return <Link href="/" aria-label="Luni, inicio" className="flex items-center gap-2.5 rounded-lg"><span className="relative h-5 w-[30px]"><span className={`absolute left-0 top-0.5 size-4 rounded-full ${dark ? "bg-lime" : "bg-navy"}`} /><span className={`absolute left-[11px] top-0.5 size-4 rounded-full border-2 ${dark ? "border-white" : "border-navy bg-lime"}`} /></span><span className="font-display text-[26px] font-bold tracking-[-.04em]">luni</span></Link>;
}

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState({ name: "", email: "" });
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", data.user.id).maybeSingle();
      if (active) setAccount({ name: profile?.full_name ?? "", email: data.user.email ?? "" });
    });
    return () => { active = false; };
  }, [configured]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/acceso");
    router.refresh();
  }

  return <aside className="fixed inset-y-0 left-0 z-20 hidden w-[264px] flex-col gap-7 bg-navy px-[18px] py-7 text-white md:flex">
    <div className="px-2.5"><Brand dark /></div>
    <Link href="/vacantes/nueva" className="flex h-[46px] items-center justify-center gap-2 rounded-xl bg-lime text-[15px] font-bold text-navy transition hover:bg-[#d4ff73]"><Icon name="plus" className="size-[18px]" />Añadir vacante</Link>
    <nav aria-label="Navegación principal" className="flex flex-col gap-0.5">{primary.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex h-11 items-center gap-3 rounded-[10px] px-3 text-base ${active ? "bg-[#1e2a48] font-bold text-white" : "font-medium text-[#d3d8e3] hover:bg-[#18233f] hover:text-white"}`}><Icon name={item.icon} className={`size-[19px] ${active ? "text-lime" : ""}`} /><span className="flex-1">{item.label}</span></Link> })}</nav>
    <div className="flex-1" />
    <nav aria-label="Cuenta" className="flex flex-col gap-0.5"><Link href="/notificaciones" className="flex h-11 items-center gap-3 rounded-[10px] px-3 text-[#d3d8e3] hover:bg-[#18233f] hover:text-white"><Icon name="bell" className="size-[19px]" /><span className="flex-1">Notificaciones</span></Link><Link href="/configuracion" className="flex h-11 items-center gap-3 rounded-[10px] px-3 text-[#d3d8e3] hover:bg-[#18233f] hover:text-white"><Icon name="settings" className="size-[19px]" />Configuración</Link></nav>
    <div className="border-t border-[#26314d] px-2.5 pt-4"><div className="flex items-center gap-2.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2a3656] text-sm font-bold">{account.name ? account.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() : "—"}</span><span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{account.name || (configured ? "Perfil sin nombre" : "Supabase sin configurar")}</span><span className="block truncate text-sm text-[#a9b1c4]">{account.email || "Sin sesión"}</span></span></div>{configured && <button type="button" onClick={signOut} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2 text-sm font-semibold text-[#d3d8e3] hover:bg-[#18233f] hover:text-white"><Icon name="arrow" className="size-4 rotate-180" />Cerrar sesión</button>}</div>
  </aside>;
}

function MobileHeader() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  async function signOut() { await createClient().auth.signOut(); router.replace("/acceso"); router.refresh(); }
  return <header className="flex items-center justify-between px-5 pb-2 pt-5 md:hidden"><Brand /><div className="flex gap-2">{configured && <button type="button" onClick={signOut} aria-label="Cerrar sesión" className="flex size-11 items-center justify-center rounded-xl border border-line bg-white text-navy"><Icon name="arrow" className="size-5 rotate-180" /></button>}<Link href="/notificaciones" aria-label="Notificaciones" className="relative flex size-11 items-center justify-center rounded-xl border border-line bg-white text-navy"><Icon name="bell" className="size-5" /></Link></div></header>;
}

function MobileNav() { const pathname = usePathname(); const items = [primary[0], primary[1], { href: "/vacantes/nueva", label: "Añadir", icon: "plus" as const }, primary[2], primary[4]]; return <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-2 pb-[env(safe-area-inset-bottom)] md:hidden">{items.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); const add = item.href === "/vacantes/nueva"; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-[68px] flex-col items-center justify-center gap-1 text-[11px] font-bold ${active ? "text-navy" : "text-[#697083]"}`}>{add ? <span className="flex size-10 items-center justify-center rounded-xl bg-lime text-navy"><Icon name="plus" className="size-5" /></span> : <Icon name={item.icon} className={`size-5 ${active ? "text-navy" : ""}`} />}<span>{item.label}</span></Link> })}</nav>; }

export function AppShell({ children }: { children: ReactNode }) { return <div className="min-h-screen bg-canvas"><Sidebar /><MobileHeader /><main className="md:ml-[264px]">{children}</main><MobileNav /></div>; }
