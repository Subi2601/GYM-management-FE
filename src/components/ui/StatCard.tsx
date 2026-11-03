import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

type Tone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  accent: "bg-accent-light text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-hover text-secondary-grey",
};

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: IconName;
  tone?: Tone;
  /** Small line under the value (trend, period, sub-total). */
  hint?: ReactNode;
  className?: string;
}

/** KPI tile: tinted icon, label, big number, optional hint. */
export function StatCard({ label, value, icon, tone = "accent", hint, className }: StatCardProps) {
  return (
    <div className={cn("flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-subtle", className)}>
      {icon && (
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE[tone])}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-muted">{label}</div>
        <div className="mt-1 truncate text-2xl font-extrabold tracking-[-0.01em] text-ink">{value ?? "—"}</div>
        {hint && <div className="mt-1 truncate text-xs font-medium text-muted">{hint}</div>}
      </div>
    </div>
  );
}
