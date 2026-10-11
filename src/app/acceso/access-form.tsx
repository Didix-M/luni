"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { SetupRequired } from "@/components/setup-required";
import { createClient } from "@/lib/supabase/client";

export function AccessForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setStatus("error");
      setMessage("No pudimos iniciar sesión. Revisa el correo y la contraseña de tu usuario de Luni.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(420px,46%)_1fr]">
    <section className="flex items-center justify-center px-5 py-12 sm:px-10"><div className="w-full max-w-[440px]">
      <div className="flex items-center gap-2.5 text-navy"><span className="relative h-5 w-[30px]"><span className="absolute left-0 top-0.5 size-4 rounded-full bg-navy" /><span className="absolute left-[11px] top-0.5 size-4 rounded-full border-2 border-navy bg-lime" /></span><span className="font-display text-[28px] font-bold tracking-[-.04em]">luni</span></div>
      <div className="mt-12"><p className="text-sm font-bold text-muted">TU ESPACIO PERSONAL</p><h1 className="mt-2 font-display text-[32px] font-bold text-navy">Iniciar sesión</h1><p className="mt-2 leading-relaxed text-[#4a5163]">Accede con el usuario creado para ti en el proyecto Supabase de Luni.</p></div>
      {!configured ? <div className="mt-8"><SetupRequired compact /></div> : <form onSubmit={signIn} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-[15px] font-bold">Correo<input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-[50px] rounded-xl border border-[#b9bfcb] bg-white px-3.5 font-normal outline-none" placeholder="nombre@ejemplo.com" /></label>
        <label className="flex flex-col gap-1.5 text-[15px] font-bold">Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-[50px] rounded-xl border border-[#b9bfcb] bg-white px-3.5 font-normal outline-none" /></label>
        {status === "error" && <p role="alert" className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm font-semibold text-[#a4271b]">{message}</p>}
        <button disabled={status === "loading"} className="flex h-[52px] items-center justify-center gap-2.5 rounded-xl bg-lime text-[17px] font-bold text-navy transition hover:bg-[#b5f02e] disabled:cursor-wait disabled:opacity-70">{status === "loading" ? "Iniciando sesión…" : "Iniciar sesión"}<Icon name="arrow" className="size-[18px]" /></button>
        <p className="text-sm leading-relaxed text-muted">Luni no permite registro público. Si todavía no tienes acceso, crea el usuario desde Authentication → Users en el panel de tu proyecto Supabase.</p>
      </form>}
    </div></section>
    <aside className="hidden items-center bg-navy p-16 text-white lg:flex"><div className="max-w-lg"><span className="flex size-12 items-center justify-center rounded-2xl bg-lime text-navy"><Icon name="shield" className="size-6" /></span><h2 className="mt-7 font-display text-4xl font-bold leading-tight">Tu búsqueda laboral, organizada y bajo tu control.</h2><p className="mt-5 text-lg leading-relaxed text-[#d3d8e3]">Tu perfil profesional permanece asociado a tu cuenta. Luni no enviará postulaciones ni responderá preguntas sensibles sin tu autorización.</p></div></aside>
  </main>;
}
