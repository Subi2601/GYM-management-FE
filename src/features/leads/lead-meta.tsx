import { Icon, type IconName } from "@/components/ui/Icon";
import type { RichOptionGroup } from "@/components/ui/RichSelect";
import { cn } from "@/lib/utils";
import { LEAD_SOURCES, type LeadSource } from "@/types/enums";

/** How the enquiry reached the gym — label, icon and a hint for the dropdown. */
export const SOURCE_META: Record<LeadSource, { label: string; icon: IconName; hint: string }> = {
  WALK_IN: { label: "Walk-in", icon: "pin", hint: "Visited the gym" },
  PHONE_CALL: { label: "Phone call", icon: "phone", hint: "Called the gym" },
  ENQUIRY_FORM: { label: "Enquiry form", icon: "clipboard", hint: "Promotion / enquiry form" },
  REFERRAL: { label: "Referral", icon: "users", hint: "Referred by a member or friend" },
  SOCIAL_MEDIA: { label: "Social media", icon: "whatsapp", hint: "Instagram, Facebook, WhatsApp, Google" },
  OTHER: { label: "Other", icon: "more", hint: "Any other channel" },
};

export const SOURCE_GROUPS: RichOptionGroup<LeadSource>[] = [{
  label: "Enquiry came through",
  options: LEAD_SOURCES.map((s) => ({ value: s, ...SOURCE_META[s] })),
}];

/** Icon + label; "Not recorded" for leads added before the source was captured. */
export function SourceLabel({ source, className }: { source: LeadSource | null; className?: string }) {
  if (!source) return <span className={cn("text-muted", className)}>Not recorded</span>;
  const meta = SOURCE_META[source];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-ink", className)}>
      <Icon name={meta.icon} className="h-3.5 w-3.5 text-muted" />
      {meta.label}
    </span>
  );
}

const DAY_MS = 86_400_000;

/** Whole days from `today` to `date` (both `YYYY-MM-DD`); negative = in the past. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** `today` + `days` as `YYYY-MM-DD` (UTC maths, so no timezone drift). */
export function addDays(today: string, days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "Today" / "Tomorrow" / "In 5 days" / past wording ("2 days overdue" for follow-ups, "2 days ago" otherwise). */
export function relativeDays(days: number, past: "overdue" | "ago"): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  const n = -days;
  if (past === "overdue") return `${n} day${n === 1 ? "" : "s"} overdue`;
  return n === 1 ? "Yesterday" : `${n} days ago`;
}
