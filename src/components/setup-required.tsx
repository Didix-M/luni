import Link from "next/link";

export function SetupRequired({ compact = false }: { compact?: boolean }) {
  return <section className={`rounded-2xl border border-[#e7c873] bg-[#fff4d9] text-[#5d4100] ${compact ? "p-4" : "mx-auto max-w-2xl p-7 sm:p-9"}`}>
    <p className="text-sm font-bold uppercase tracking-wide">Configuración necesaria</p>
    <h1 className="mt-2 font-display text-2xl font-bold text-navy">Conecta el proyecto Supabase de Luni</h1>
    <p className="mt-3 leading-relaxed">No hay una sesión simulada. Copia <code className="rounded bg-white/70 px-1.5 py-0.5">.env.example</code> como <code className="rounded bg-white/70 px-1.5 py-0.5">.env.local</code> y agrega la URL y la publishable key del proyecto correcto.</p>
    {!compact && <><p className="mt-3 text-sm">Después aplica la migración de <code>supabase/migrations</code> y reinicia el servidor de desarrollo.</p><Link href="/acceso" className="mt-5 inline-flex h-11 items-center rounded-xl bg-navy px-4 font-bold text-white">Ir a acceso</Link></>}
  </section>;
}
