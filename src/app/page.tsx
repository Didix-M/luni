import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Dashboard } from "./dashboard";

export const instant = false;

export default function Home() {
  if (!isSupabaseConfigured()) return <AppShell><div className="px-5 py-16 md:px-12"><SetupRequired /></div></AppShell>;
  return <AppShell><Dashboard /></AppShell>;
}
