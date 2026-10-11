import { AppShell } from "@/components/app-shell";
import { JobForm } from "../job-form";

export const instant = false;

export default async function NewJobPage({ searchParams }: PageProps<"/vacantes/nueva">) {
  const query = await searchParams;
  const initialUrl = typeof query.url === "string" ? query.url.slice(0, 2048) : "";
  return <AppShell><JobForm initialUrl={initialUrl} autoImport={query.analizar === "1" && Boolean(initialUrl)} /></AppShell>;
}
