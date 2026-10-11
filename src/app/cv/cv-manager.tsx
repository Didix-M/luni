"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { detectCvData, type CvDocument, type ExtractedCvData } from "@/lib/cv";

type Status = "idle" | "loading" | "reading" | "saving" | "success" | "error";
type CandidateKey = keyof ExtractedCvData;

const labels: Record<CandidateKey, string> = {
  full_name: "Nombre completo",
  professional_email: "Correo profesional",
  phone: "Teléfono",
  linkedin_url: "LinkedIn",
  portfolio_url: "Portfolio",
  skills: "Habilidades",
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function readPdf(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  if (!header.includes("%PDF-")) throw new Error("El archivo seleccionado no parece ser un PDF válido.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join("\n").replace(/[ \t]+/g, " ").trim();
}

export function CvManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CvDocument[]>([]);
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [latest, setLatest] = useState<CvDocument | null>(null);
  const [selected, setSelected] = useState<CandidateKey[]>([]);

  async function loadDocuments(id: string) {
    const { data, error } = await createClient().from("cv_documents").select("id,file_name,storage_path,file_size,extracted_text,extracted_data,created_at").eq("user_id", id).order("created_at", { ascending: false });
    if (error) throw error;
    setDocuments((data ?? []) as CvDocument[]);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) { setStatus("error"); setMessage("Tu sesión no está disponible. Vuelve a iniciar sesión."); return; }
      setUserId(data.user.id);
      try { await loadDocuments(data.user.id); setStatus("idle"); }
      catch { setStatus("error"); setMessage("No pudimos cargar tus CV. Aplica primero la migración 202610110004 en Supabase."); }
    }
    load();
    return () => { active = false; };
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setStatus("error"); setMessage("Selecciona un archivo PDF."); return; }
    if (file.size > 10 * 1024 * 1024) { setStatus("error"); setMessage("El PDF supera el límite de 10 MB."); return; }

    setStatus("reading"); setMessage("Leyendo el texto del PDF en este dispositivo…");
    try {
      const extractedText = await readPdf(file);
      if (!extractedText) throw new Error("No encontramos texto seleccionable. Si el PDF es una imagen escaneada, necesitará reconocimiento OCR en una etapa posterior.");
      const extractedData = detectCvData(extractedText);
      const path = `${userId}/${crypto.randomUUID()}.pdf`;
      setStatus("saving"); setMessage("Guardando el PDF de forma privada…");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("private-cvs").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      const { data, error: rowError } = await supabase.from("cv_documents").insert({
        user_id: userId, file_name: file.name, storage_path: path, file_size: file.size,
        mime_type: "application/pdf", extracted_text: extractedText.slice(0, 250000), extracted_data: extractedData,
      }).select("id,file_name,storage_path,file_size,extracted_text,extracted_data,created_at").single();
      if (rowError) { await supabase.storage.from("private-cvs").remove([path]); throw rowError; }
      const document = data as CvDocument;
      setLatest(document);
      setSelected(Object.keys(extractedData) as CandidateKey[]);
      await loadDocuments(userId);
      setStatus("success");
      setMessage("CV guardado. Revisa los datos detectados antes de copiarlos a tu perfil.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.message ? error.message : "No pudimos procesar el PDF. Inténtalo nuevamente.");
    }
  }

  async function applyToProfile() {
    if (!latest || !userId) return;
    setStatus("saving"); setMessage("Comprobando los campos vacíos de tu perfil…");
    const supabase = createClient();
    const { data: current, error } = await supabase.from("profiles").select("full_name,professional_email,phone,linkedin_url,portfolio_url,skills").eq("user_id", userId).maybeSingle();
    if (error) { setStatus("error"); setMessage("No pudimos consultar tu perfil."); return; }
    const changes: Record<string, string | string[]> = {};
    for (const key of selected) {
      const value = latest.extracted_data[key];
      const existing = current?.[key];
      if (value && (!existing || (Array.isArray(existing) && existing.length === 0))) changes[key] = value;
    }
    if (Object.keys(changes).length === 0) { setStatus("idle"); setMessage("No hay campos seleccionados vacíos. Tu información existente no fue reemplazada."); return; }
    const { error: saveError } = await supabase.from("profiles").upsert({ user_id: userId, ...changes }, { onConflict: "user_id" });
    if (saveError) { setStatus("error"); setMessage("No pudimos copiar los datos al perfil."); return; }
    setStatus("success"); setMessage("Los datos seleccionados se copiaron únicamente en campos que estaban vacíos. Revisa tu perfil antes de usarlos.");
  }

  async function openDocument(document: CvDocument) {
    const { data, error } = await createClient().storage.from("private-cvs").createSignedUrl(document.storage_path, 60);
    if (error) { setStatus("error"); setMessage("No pudimos abrir el PDF."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeDocument(document: CvDocument) {
    if (!window.confirm(`¿Eliminar “${document.file_name}”? Esta acción no se puede deshacer.`)) return;
    setStatus("saving"); setMessage("Eliminando el CV…");
    const supabase = createClient();
    const { error: fileError } = await supabase.storage.from("private-cvs").remove([document.storage_path]);
    if (fileError) { setStatus("error"); setMessage("No pudimos eliminar el archivo privado."); return; }
    const { error: rowError } = await supabase.from("cv_documents").delete().eq("id", document.id);
    if (rowError) { setStatus("error"); setMessage("El archivo se eliminó, pero no pudimos borrar su registro. Recarga la página."); return; }
    if (latest?.id === document.id) setLatest(null);
    await loadDocuments(userId);
    setStatus("success"); setMessage("CV eliminado.");
  }

  const candidates = latest ? Object.entries(latest.extracted_data).filter((entry): entry is [CandidateKey, string | string[]] => Boolean(entry[1]) && (!Array.isArray(entry[1]) || entry[1].length > 0)) : [];

  return <div className="mx-auto max-w-[1080px] px-5 py-6 pb-28 md:px-12 md:py-10">
    <header><p className="text-sm font-bold text-muted">DOCUMENTOS PROFESIONALES</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Mis CV</h1><p className="mt-2 max-w-2xl text-[#4a5163]">Sube tu CV original en PDF. Luni extrae el texto en tu navegador y te pide revisar cualquier dato antes de incorporarlo al perfil.</p></header>

    {message && <div role="status" className={`mt-6 rounded-xl p-4 text-sm font-semibold ${status === "error" ? "bg-[#fdecea] text-[#a4271b]" : status === "success" ? "bg-[#e7f5ec] text-[#17663f]" : "bg-[#e9f0fd] text-[#1e55b8]"}`}>{message}</div>}

    <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-xl font-bold text-navy">Añadir un CV</h2><p className="mt-1 text-sm text-muted">Solo PDF, hasta 10 MB. El archivo se guarda en un bucket privado asociado a tu usuario.</p></div><button type="button" disabled={!userId || status === "reading" || status === "saving"} onClick={() => inputRef.current?.click()} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy hover:bg-[#b5f02e] disabled:cursor-wait disabled:opacity-60"><Icon name="plus" className="size-[18px]" />{status === "reading" ? "Leyendo…" : status === "saving" ? "Guardando…" : "Subir PDF"}</button></div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={upload} className="sr-only" />
      <div className="mt-5 flex gap-3 rounded-xl bg-canvas p-4 text-sm leading-relaxed text-[#4a5163]"><Icon name="shield" className="mt-0.5 size-5 shrink-0 text-navy" /><p>No se envía el contenido a servicios de IA. La detección automática puede equivocarse y no interpreta todavía imágenes escaneadas, experiencias ni formación compleja.</p></div>
    </section>

    {latest && candidates.length > 0 && <section className="mt-6 rounded-2xl border border-[#bfd0ef] bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-navy">Datos detectados en {latest.file_name}</h2><p className="mt-1 text-sm text-muted">Desmarca lo que no sea correcto. Luni nunca reemplazará un campo que ya tenga información.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{candidates.map(([key, value]) => <label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-line p-4"><input type="checkbox" checked={selected.includes(key)} onChange={() => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} className="mt-1 size-4 accent-[#101b35]" /><span className="min-w-0"><strong className="block text-sm text-navy">{labels[key]}</strong><span className="mt-1 block break-words text-sm text-[#4a5163]">{Array.isArray(value) ? value.join(", ") : value}</span></span></label>)}</div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={applyToProfile} disabled={status === "saving" || selected.length === 0} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy disabled:opacity-60"><Icon name="check" className="size-[18px]" />Copiar campos vacíos al perfil</button><Link href="/perfil" className="flex h-12 items-center justify-center rounded-xl border border-[#b9bfcb] px-5 font-bold text-navy">Revisar perfil</Link></div></section>}

    <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-navy">Documentos guardados</h2>{status === "loading" ? <p className="mt-5 text-sm text-muted">Cargando tus CV…</p> : documents.length === 0 ? <div className="mt-5 rounded-xl bg-canvas p-5 text-sm text-muted">Todavía no has subido ningún CV.</div> : <div className="mt-5 divide-y divide-line">{documents.map((document) => <article key={document.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9f0fd] text-[#1e55b8]"><Icon name="file" className="size-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-navy">{document.file_name}</h3><p className="text-sm text-muted">{formatSize(document.file_size)} · {new Intl.DateTimeFormat("es-PA", { dateStyle: "medium" }).format(new Date(document.created_at))}</p></div><div className="flex gap-2"><button type="button" onClick={() => openDocument(document)} className="h-11 rounded-[10px] border border-[#b9bfcb] px-4 text-sm font-bold text-navy">Ver PDF</button><button type="button" onClick={() => removeDocument(document)} className="h-11 rounded-[10px] px-3 text-sm font-bold text-[#a4271b] hover:bg-[#fdecea]">Eliminar</button></div></article>)}</div>}</section>
  </div>;
}
