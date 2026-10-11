import { AppShell } from "@/components/app-shell";
import { CvManager } from "./cv-manager";

export const instant = false;

export default function CvPage() {
  return <AppShell><CvManager /></AppShell>;
}
