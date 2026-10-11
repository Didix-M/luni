import { AppShell } from "@/components/app-shell";
import { JobsList } from "./jobs-list";

export const instant = false;

export default function JobsPage() {
  return <AppShell><JobsList /></AppShell>;
}
