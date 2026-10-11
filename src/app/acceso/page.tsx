import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AccessForm } from "./access-form";

export default function AccessPage() {
  return <AccessForm configured={isSupabaseConfigured()} />;
}
