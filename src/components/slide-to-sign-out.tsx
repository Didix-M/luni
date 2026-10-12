"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { createClient } from "@/lib/supabase/client";

export function SlideToSignOut() {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const maximum = useRef(0);
  const progressRef = useRef(0);
  const dragging = useRef(false);
  const [progress, setProgress] = useState(0);
  const [offset, setOffset] = useState(0);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (closing) return;
    setClosing(true); setProgress(1); setOffset(Math.max(0, (trackRef.current?.clientWidth ?? 64) - 64)); progressRef.current = 1; setError("");
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) { setClosing(false); setProgress(0); setOffset(0); progressRef.current = 0; setError("No pudimos cerrar la sesión. Inténtalo nuevamente."); return; }
    router.replace("/acceso"); router.refresh();
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (closing || !trackRef.current) return;
    dragging.current = true; startX.current = event.clientX;
    maximum.current = Math.max(1, trackRef.current.clientWidth - event.currentTarget.offsetWidth - 12);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragging.current || closing) return;
    const next = Math.min(1, Math.max(0, (startX.current - event.clientX) / maximum.current));
    progressRef.current = next; setProgress(next); setOffset(next * maximum.current);
  }

  function pointerEnd() {
    if (!dragging.current || closing) return;
    dragging.current = false;
    if (progressRef.current >= 0.82) { void signOut(); return; }
    progressRef.current = 0; setProgress(0); setOffset(0);
  }

  return <section className="mt-8 rounded-2xl border border-[#e8b4ae] bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-[#7e1d14]">Cerrar sesión</h2><p className="mt-1 text-sm text-muted">Desliza el botón hacia la izquierda para confirmar.</p><div ref={trackRef} className="relative mt-4 h-16 touch-none overflow-hidden rounded-2xl bg-navy" style={{ background: `linear-gradient(to left, #a4271b ${progress * 100}%, #101b35 ${progress * 100}%)` }}><span className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-center text-sm font-bold text-white">{progress > 0 || closing ? "Cerrando…" : "Desliza a la izquierda"}</span><button type="button" aria-label="Desliza a la izquierda para cerrar sesión. Presiona Enter como alternativa." disabled={closing} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void signOut(); } }} className="absolute right-1.5 top-1.5 flex size-[52px] cursor-grab items-center justify-center rounded-xl bg-white text-navy shadow-md transition-transform duration-150 active:cursor-grabbing disabled:cursor-wait" style={{ transform: `translateX(-${offset}px)`, color: progress > 0.45 ? "#a4271b" : "#101b35" }}><Icon name="door" className="size-6"/></button></div>{error && <p role="alert" className="mt-3 text-sm font-bold text-[#a4271b]">{error}</p>}</section>;
}
