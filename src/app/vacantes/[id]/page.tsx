import { AppShell } from "@/components/app-shell";
import { JobForm } from "../job-form";

export const instant = false;

export default async function JobPage({ params }: PageProps<"/vacantes/[id]">) {
  const { id } = await params;
  return <AppShell><JobForm jobId={id} /></AppShell>;
}
