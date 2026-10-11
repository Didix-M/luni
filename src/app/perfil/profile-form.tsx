"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { emptyProfile, normalizeProfile, type Education, type Experience, type Language, type Profile } from "@/lib/profile";

type SaveState = "idle" | "saving" | "success" | "error";
const input = "h-12 w-full rounded-xl border border-[#b9bfcb] bg-white px-3.5 outline-none placeholder:text-[#8a92a3]";
const textarea = "min-h-28 w-full resize-y rounded-xl border border-[#b9bfcb] bg-white px-3.5 py-3 outline-none placeholder:text-[#8a92a3]";

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1.5 text-[15px] font-bold text-[#2e3445]">{label}{children}</label>; }
function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-line bg-white p-5 sm:p-6"><h2 className="font-display text-xl font-bold text-navy">{title}</h2>{description && <p className="mt-1 text-sm text-muted">{description}</p>}<div className="mt-5">{children}</div></section>; }
function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className="h-11 rounded-[10px] px-3 text-sm font-bold text-[#a4271b] hover:bg-[#fdecea]">Eliminar {label}</button>; }
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 rounded-[10px] border px-3.5 text-sm font-bold ${active ? "border-navy bg-navy text-white" : "border-[#b9bfcb] bg-white text-[#4a5163] hover:border-navy"}`}>{children}</button>; }

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userData.user) { setMessage("Tu sesión no está disponible. Vuelve a iniciar sesión."); setSaveState("error"); setLoading(false); return; }
      setUserId(userData.user.id);
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userData.user.id).maybeSingle();
      if (!active) return;
      if (error) { setMessage("No pudimos cargar el perfil. Comprueba que aplicaste la migración de Supabase."); setSaveState("error"); }
      else if (!data) { setIsEmpty(true); setProfile({ ...emptyProfile, professional_email: userData.user.email ?? "" }); }
      else { setProfile(normalizeProfile(data)); setUpdatedAt(typeof data.updated_at === "string" ? data.updated_at : ""); }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); setSaveState("idle"); }
  function toggleArray(key: "contract_types", value: string) { const list = profile[key]; set(key, list.includes(value) ? list.filter((item) => item !== value) : [...list, value]); }
  function togglePreference(key: "roles" | "workModes", value: string) { const list = profile.job_preferences[key]; set("job_preferences", { ...profile.job_preferences, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] }); }

  async function save() {
    if (!userId) return;
    setSaveState("saving"); setMessage("");
    const payload = {
      user_id: userId,
      full_name: profile.full_name.trim() || null,
      professional_email: profile.professional_email.trim() || null,
      phone: profile.phone.trim() || null,
      location: profile.location.trim() || null,
      portfolio_url: profile.portfolio_url.trim() || null,
      linkedin_url: profile.linkedin_url.trim() || null,
      professional_summary: profile.professional_summary.trim() || null,
      experiences: profile.experiences,
      education: profile.education,
      skills: profile.skills.filter(Boolean),
      languages: profile.languages,
      job_preferences: profile.job_preferences,
      salary_min: profile.salary_min ? Number(profile.salary_min) : null,
      salary_max: profile.salary_max ? Number(profile.salary_max) : null,
      salary_currency: profile.salary_currency || null,
      salary_period: profile.salary_period || null,
      contract_types: profile.contract_types,
    };
    const { data, error } = await createClient().from("profiles").upsert(payload, { onConflict: "user_id" }).select("updated_at").single();
    if (error) { setSaveState("error"); setMessage(error.code === "23514" ? "Revisa el rango salarial: el máximo no puede ser menor que el mínimo." : "No pudimos guardar el perfil. Inténtalo de nuevo."); }
    else { setIsEmpty(false); setUpdatedAt(data.updated_at); setSaveState("success"); setMessage("Perfil guardado correctamente."); }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-5 py-12 md:px-12"><div role="status" className="animate-pulse space-y-5"><div className="h-9 w-64 rounded bg-[#dde1e8]" /><div className="h-52 rounded-2xl bg-white" /><div className="h-72 rounded-2xl bg-white" /><span className="sr-only">Cargando perfil…</span></div></div>;

  if (!expanded) {
    const lastUpdate = updatedAt ? new Intl.DateTimeFormat("es-PA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Panama" }).format(new Date(updatedAt)) : "Aún no se ha guardado";
    const initials = profile.full_name ? profile.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() : "—";
    return <div className="mx-auto max-w-[900px] px-5 py-6 pb-28 md:px-12 md:py-10"><header><p className="text-sm font-bold text-muted">PERFIL PROFESIONAL</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Mi perfil</h1><p className="mt-2 max-w-2xl text-[#4a5163]">Consulta el resumen de tu información y ábrelo cuando necesites revisar o editar los detalles.</p></header>{message && saveState === "error" && <div role="alert" className="mt-6 rounded-xl bg-[#fdecea] p-4 text-sm font-semibold text-[#a4271b]">{message}</div>}<button type="button" onClick={() => setExpanded(true)} className="mt-6 w-full rounded-2xl border border-line bg-white p-5 text-left shadow-[0_2px_8px_rgba(16,27,53,.04)] transition hover:border-[#aab2c1] hover:shadow-[0_8px_24px_rgba(16,27,53,.08)] sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-navy font-display text-xl font-bold text-lime">{initials}</span><span className="min-w-0 flex-1"><span className="block font-display text-2xl font-bold text-navy">{profile.full_name || "Perfil sin nombre"}</span><span className="mt-1 block text-sm text-muted">Última modificación: {lastUpdate}</span>{profile.professional_email && <span className="mt-2 block truncate text-[15px] text-[#4a5163]">{profile.professional_email}{profile.location ? ` · ${profile.location}` : ""}</span>}</span><span className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy">Ver y editar perfil<Icon name="chevron" className="size-[18px]"/></span></div><span className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-5 text-center"><span><strong className="block font-display text-xl text-navy">{profile.experiences.length}</strong><span className="text-xs text-muted">Experiencias</span></span><span><strong className="block font-display text-xl text-navy">{profile.education.length}</strong><span className="text-xs text-muted">Formaciones</span></span><span><strong className="block font-display text-xl text-navy">{profile.skills.filter(Boolean).length}</strong><span className="text-xs text-muted">Habilidades</span></span></span></button>{isEmpty && <div className="mt-4 rounded-xl border border-[#bfd0ef] bg-[#e9f0fd] p-4 text-sm text-[#1e55b8]">Tu perfil todavía está vacío. Abre la tarjeta para añadir tu información.</div>}</div>;
  }

  return <div className="mx-auto max-w-[1080px] px-5 py-6 md:px-12 md:py-10">
    <button type="button" onClick={() => setExpanded(false)} className="mb-2 flex min-h-11 items-center gap-1.5 text-sm font-bold text-muted hover:text-navy"><Icon name="chevron" className="size-4 rotate-180"/>Volver a Mi perfil</button>
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-muted">PERFIL PROFESIONAL</p><h1 className="mt-1 font-display text-[30px] font-bold text-navy md:text-[34px]">Tu información profesional</h1><p className="mt-2 max-w-2xl text-[#4a5163]">Guarda solo información confirmada. Los campos vacíos permanecen pendientes y Luni no los completará por ti.</p></div><button type="button" onClick={save} disabled={saveState === "saving" || !userId} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy hover:bg-[#b5f02e] disabled:cursor-wait disabled:opacity-60"><Icon name="check" className="size-[18px]" />{saveState === "saving" ? "Guardando…" : "Guardar perfil"}</button></header>
    {isEmpty && <div className="mt-6 rounded-xl border border-[#bfd0ef] bg-[#e9f0fd] p-4 text-[#1e55b8]"><strong>Tu perfil está vacío.</strong><p className="mt-1 text-sm">Completa únicamente los datos que quieras guardar. Ningún dato de demostración se copiará aquí.</p></div>}
    {message && <div role="status" className={`mt-6 rounded-xl p-4 text-sm font-semibold ${saveState === "success" ? "bg-[#e7f5ec] text-[#17663f]" : "bg-[#fdecea] text-[#a4271b]"}`}>{message}</div>}

    <div className="mt-6 grid gap-6">
      <Card title="Datos personales" description="Información de contacto para tus solicitudes."><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre completo"><input value={profile.full_name} onChange={(e) => set("full_name", e.target.value)} className={input} /></Field><Field label="Correo profesional"><input type="email" value={profile.professional_email} onChange={(e) => set("professional_email", e.target.value)} className={input} /></Field><Field label="Teléfono"><input type="tel" value={profile.phone} onChange={(e) => set("phone", e.target.value)} className={input} /></Field><Field label="Ubicación"><input value={profile.location} onChange={(e) => set("location", e.target.value)} className={input} placeholder="Ciudad, país" /></Field><Field label="Portfolio"><input type="url" value={profile.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} className={input} placeholder="https://" /></Field><Field label="LinkedIn"><input type="url" value={profile.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} className={input} placeholder="https://linkedin.com/in/…" /></Field></div><div className="mt-4"><Field label="Resumen profesional"><textarea value={profile.professional_summary} onChange={(e) => set("professional_summary", e.target.value)} className={textarea} /></Field></div></Card>

      <Card title="Experiencia profesional"><div className="space-y-4">{profile.experiences.length === 0 && <p className="rounded-xl bg-canvas p-4 text-sm text-muted">Aún no has añadido experiencias.</p>}{profile.experiences.map((experience, index) => <ExperienceEditor key={index} value={experience} onChange={(value) => set("experiences", profile.experiences.map((item, i) => i === index ? value : item))} onRemove={() => set("experiences", profile.experiences.filter((_, i) => i !== index))} />)}<button type="button" onClick={() => set("experiences", [...profile.experiences, { role: "", company: "", start: "", end: "", description: "" }])} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#b9bfcb] px-4 font-bold text-navy hover:bg-canvas"><Icon name="plus" className="size-4" />Añadir experiencia</button></div></Card>

      <Card title="Formación"><div className="space-y-4">{profile.education.length === 0 && <p className="rounded-xl bg-canvas p-4 text-sm text-muted">Aún no has añadido formación.</p>}{profile.education.map((education, index) => <EducationEditor key={index} value={education} onChange={(value) => set("education", profile.education.map((item, i) => i === index ? value : item))} onRemove={() => set("education", profile.education.filter((_, i) => i !== index))} />)}<button type="button" onClick={() => set("education", [...profile.education, { program: "", institution: "", start: "", end: "" }])} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#b9bfcb] px-4 font-bold text-navy hover:bg-canvas"><Icon name="plus" className="size-4" />Añadir formación</button></div></Card>

      <Card title="Habilidades e idiomas"><div className="grid gap-5 lg:grid-cols-2"><Field label="Habilidades (separadas por comas)"><textarea value={profile.skills.join(", ")} onChange={(e) => set("skills", e.target.value.split(",").map((value) => value.trim()))} className={textarea} placeholder="Diseño de producto, Figma, investigación" /></Field><div><p className="mb-1.5 text-[15px] font-bold text-[#2e3445]">Idiomas</p><div className="space-y-3">{profile.languages.map((language, index) => <LanguageEditor key={index} value={language} onChange={(value) => set("languages", profile.languages.map((item, i) => i === index ? value : item))} onRemove={() => set("languages", profile.languages.filter((_, i) => i !== index))} />)}<button type="button" onClick={() => set("languages", [...profile.languages, { language: "", level: "" }])} className="flex h-11 items-center gap-2 rounded-[10px] border border-[#b9bfcb] px-4 font-bold text-navy"><Icon name="plus" className="size-4" />Añadir idioma</button></div></div></div></Card>

      <Card title="Preferencias laborales" description="Estas preferencias ayudan a organizar oportunidades; no autorizan ningún envío."><div className="space-y-5"><div><p className="mb-2 text-[15px] font-bold text-[#2e3445]">Cargos de interés</p><div className="flex flex-wrap gap-2">{["Product Designer","UX/UI Designer","Design Lead","UX Researcher"].map((role) => <Toggle key={role} active={profile.job_preferences.roles.includes(role)} onClick={() => togglePreference("roles", role)}>{role}</Toggle>)}</div></div><div><p className="mb-2 text-[15px] font-bold text-[#2e3445]">Modalidad</p><div className="flex flex-wrap gap-2">{["Remoto","Híbrido","Presencial"].map((mode) => <Toggle key={mode} active={profile.job_preferences.workModes.includes(mode)} onClick={() => togglePreference("workModes", mode)}>{mode}</Toggle>)}</div></div><div><p className="mb-2 text-[15px] font-bold text-[#2e3445]">Tipo de contratación</p><div className="flex flex-wrap gap-2">{["Empleado","Contractor","Freelance"].map((type) => <Toggle key={type} active={profile.contract_types.includes(type)} onClick={() => toggleArray("contract_types", type)}>{type}</Toggle>)}</div></div></div></Card>

      <Card title="Expectativa salarial" description="Puedes indicar un monto único usando solo “Desde”, o completar un rango."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Desde"><input type="number" min="0" step="0.01" value={profile.salary_min} onChange={(e) => set("salary_min", e.target.value)} className={input} /></Field><Field label="Hasta"><input type="number" min="0" step="0.01" value={profile.salary_max} onChange={(e) => set("salary_max", e.target.value)} className={input} /></Field><Field label="Moneda"><select value={profile.salary_currency} onChange={(e) => set("salary_currency", e.target.value)} className={input}><option value="">Sin indicar</option><option value="USD">USD</option><option value="PAB">PAB</option><option value="EUR">EUR</option></select></Field><Field label="Periodicidad"><select value={profile.salary_period} onChange={(e) => set("salary_period", e.target.value)} className={input}><option value="">Sin indicar</option><option value="hourly">Por hora</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></Field></div><p className="mt-3 text-sm text-muted">Luni guarda la moneda elegida y no realiza conversiones automáticas.</p></Card>
    </div>
    <div className="sticky bottom-[74px] mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/95 p-3 shadow-[0_8px_30px_rgba(16,27,53,.12)] backdrop-blur md:bottom-4"><p className="hidden text-sm text-muted sm:block">Los cambios se guardan únicamente al pulsar el botón.</p><button type="button" onClick={save} disabled={saveState === "saving" || !userId} className="ml-auto flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-bold text-navy disabled:opacity-60"><Icon name="check" className="size-[18px]" />{saveState === "saving" ? "Guardando…" : "Guardar cambios"}</button></div>
  </div>;
}

function ExperienceEditor({ value, onChange, onRemove }: { value: Experience; onChange: (value: Experience) => void; onRemove: () => void }) { return <div className="rounded-xl border border-line p-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Cargo"><input value={value.role} onChange={(e) => onChange({ ...value, role: e.target.value })} className={input} /></Field><Field label="Empresa"><input value={value.company} onChange={(e) => onChange({ ...value, company: e.target.value })} className={input} /></Field><Field label="Inicio"><input type="month" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} className={input} /></Field><Field label="Fin"><input type="month" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} className={input} /></Field></div><div className="mt-3"><Field label="Descripción"><textarea value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} className={textarea} /></Field></div><div className="mt-2 text-right"><RemoveButton onClick={onRemove} label="experiencia" /></div></div>; }
function EducationEditor({ value, onChange, onRemove }: { value: Education; onChange: (value: Education) => void; onRemove: () => void }) { return <div className="rounded-xl border border-line p-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Programa o título"><input value={value.program} onChange={(e) => onChange({ ...value, program: e.target.value })} className={input} /></Field><Field label="Institución"><input value={value.institution} onChange={(e) => onChange({ ...value, institution: e.target.value })} className={input} /></Field><Field label="Inicio"><input type="month" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} className={input} /></Field><Field label="Fin"><input type="month" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} className={input} /></Field></div><div className="mt-2 text-right"><RemoveButton onClick={onRemove} label="formación" /></div></div>; }
function LanguageEditor({ value, onChange, onRemove }: { value: Language; onChange: (value: Language) => void; onRemove: () => void }) { return <div className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label="Idioma" value={value.language} onChange={(e) => onChange({ ...value, language: e.target.value })} className={input} placeholder="Idioma" /><select aria-label="Nivel" value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value })} className={input}><option value="">Nivel</option><option>Básico</option><option>Intermedio</option><option>Avanzado</option><option>Nativo</option></select><button type="button" aria-label="Eliminar idioma" onClick={onRemove} className="size-12 rounded-xl text-[#a4271b] hover:bg-[#fdecea]">×</button></div>; }
