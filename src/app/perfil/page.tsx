import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ProfileForm } from "./profile-form";

export const instant = false;

export default function ProfilePage() {
  if (!isSupabaseConfigured()) return <AppShell><div className="px-5 py-16 md:px-12"><SetupRequired /></div></AppShell>;
  return <AppShell><ProfileForm /></AppShell>;
}
