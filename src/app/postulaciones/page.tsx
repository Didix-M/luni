import { AppShell } from "@/components/app-shell";
import { ApplicationsList } from "./applications-list";

export const instant = false;
export default function ApplicationsPage() { return <AppShell><ApplicationsList /></AppShell>; }
