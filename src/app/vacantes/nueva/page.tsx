import { AppShell } from "@/components/app-shell";
import { JobForm } from "../job-form";

export const instant = false;

export default function NewJobPage() {
  return <AppShell><JobForm /></AppShell>;
}
