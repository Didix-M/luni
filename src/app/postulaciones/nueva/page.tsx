import { AppShell } from "@/components/app-shell";
import { NewApplication } from "./new-application";

export const instant = false;
export default function NewApplicationPage() { return <AppShell><NewApplication /></AppShell>; }
