import { AppShell } from "@/components/app-shell";
import { AnswersManager } from "./answers-manager";

export const instant = false;

export default function AnswersPage() {
  return <AppShell><AnswersManager /></AppShell>;
}
