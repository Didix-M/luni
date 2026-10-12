import type { IconName } from "@/components/icons";

export type NotificationType = "general" | "application" | "interview" | "reminder" | "vacancy" | "warning";

export type LuniNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_label: string | null;
  action_href: string | null;
  read_at: string | null;
  created_at: string;
};

export const notificationAppearance: Record<NotificationType, { icon: IconName; className: string }> = {
  general: { icon: "bell", className: "bg-[#e9f0fd] text-[#1e55b8]" },
  application: { icon: "send", className: "bg-[#e7f5ec] text-[#17663f]" },
  interview: { icon: "calendar", className: "bg-navy text-lime" },
  reminder: { icon: "calendar", className: "bg-[#fff4d9] text-[#7a4e00]" },
  vacancy: { icon: "briefcase", className: "bg-[#efffd0] text-[#446700]" },
  warning: { icon: "alert", className: "bg-[#fdecea] text-[#a4271b]" },
};
