import { cn, humanize } from "@/lib/utils";

type Tone = "green" | "red" | "amber" | "grey" | "blue" | "purple";

const TONES: Record<Tone, string> = {
  green: "bg-success-soft text-success",
  red: "bg-accent-light text-accent",
  amber: "bg-warning-soft text-warning",
  grey: "bg-hover text-secondary-grey",
  blue: "bg-info-soft text-info",
  purple: "bg-plum-soft text-plum",
};

/** Default tone for every status value the API returns. */
const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "green", PAID: "green", PRESENT: "green", JOINED: "green", COMPLETED: "blue", GRANTED: "green",
  PENDING: "amber", EXPIRING: "amber", LATE: "amber", FOLLOW_UP: "amber", HALF_DAY: "amber", ON_LEAVE: "purple",
  EXPIRED: "red", ABSENT: "red", TERMINATED: "red", NOT_INTERESTED: "red", JOINED_ELSEWHERE: "red",
  INACTIVE: "grey", NO_PLAN: "grey", NEW: "blue",
  BASIC: "grey", STANDARD: "blue", PREMIUM: "purple",
};

interface StatusBadgeProps {
  value: string | null | undefined;
  tone?: Tone;
  label?: string;
  className?: string;
}

export function StatusBadge({ value, tone, label, className }: StatusBadgeProps) {
  if (!value) return <span className="text-muted">—</span>;
  const t = tone ?? STATUS_TONE[value] ?? "grey";
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", TONES[t], className)}>
      {label ?? humanize(value)}
    </span>
  );
}
