import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { NotificationsCenter } from "./notifications-center";

export const instant = false;

export default function NotificationsPage() {
  if (!isSupabaseConfigured()) return <AppShell><div className="px-5 py-16 md:px-12"><SetupRequired /></div></AppShell>;
  return <AppShell><NotificationsCenter /></AppShell>;
}
