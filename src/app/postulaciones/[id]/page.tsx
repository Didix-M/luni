import { AppShell } from "@/components/app-shell";
import { ApplicationDetail } from "./application-detail";

export const instant = false;
export default async function ApplicationPage({ params }: PageProps<"/postulaciones/[id]">) { const { id } = await params; return <AppShell><ApplicationDetail applicationId={id}/></AppShell>; }
