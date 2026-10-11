import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";

// These temporary, URL-specific placeholders can block until their slug is known.
export const instant = false;

export default async function PendingPage({ params }: PageProps<"/[...slug]">) {
  const { slug } = await params;
  const title = slug.at(-1)?.replaceAll("-", " ") ?? "Sección";
  return <AppShell><div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-2xl items-center px-5 py-16 md:min-h-screen md:px-12"><section className="w-full rounded-2xl border border-line bg-white p-7 text-center sm:p-10"><span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#e9f0fd] text-[#1e55b8]"><Icon name="calendar" className="size-6" /></span><p className="mt-5 text-sm font-bold uppercase tracking-wide text-muted">Próxima etapa</p><h1 className="mt-2 font-display text-3xl font-bold capitalize text-navy">{title}</h1><p className="mx-auto mt-3 max-w-md leading-relaxed text-[#4a5163]">Esta sección todavía no está implementada ni conectada a servicios externos. La navegación ya está preparada para incorporarla en una siguiente etapa.</p><Link href="/" className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy hover:bg-[#b5f02e]"><Icon name="arrow" className="size-[18px] rotate-180" />Volver al inicio</Link></section></div></AppShell>;
}
