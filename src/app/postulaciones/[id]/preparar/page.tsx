import { AppShell } from "@/components/app-shell";
import { ApplicationPreparation } from "./application-preparation";

export const instant = false;

export default async function PrepareApplicationPage({ params }: PageProps<"/postulaciones/[id]/preparar">) {
  const { id } = await params;
  return <AppShell><ApplicationPreparation applicationId={id}/></AppShell>;
}
