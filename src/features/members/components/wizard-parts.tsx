import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/plan";

/** The original ".readonly-input": dashed, greyed, not editable. */
export const READONLY_INPUT = "!border-dashed !bg-subtle !text-muted cursor-not-allowed";

/** ".form-grid-3" (3 → 2 → 1 columns). */
export const GRID_3 = "grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 lg:grid-cols-3";
/** ".form-grid-2". */
export const GRID_2 = "grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2";

const STEPS = [
  { label: "Personal Info", hint: "Basic and contact details" },
  { label: "Plan & Package", hint: "Membership and add-ons" },
  { label: "Payment", hint: "Discount and collection" },
] as const;

interface WizardStepsProps {
  current: number;
  onSelect: (step: 1 | 2 | 3) => void;
}

/** Step bar: a top rule per step that turns red; done steps show a tick. */
export function WizardSteps({ current, onSelect }: WizardStepsProps) {
  return (
    <div className="mb-7 grid grid-cols-3 gap-3 max-md:grid-cols-1">
      {STEPS.map(({ label, hint }, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = current > n;
        const active = current === n;
        return (
          <button key={label} type="button" onClick={() => onSelect(n)}
            className={cn("flex cursor-pointer items-center gap-2.5 border-0 border-t-[3px] bg-transparent pt-3 text-left transition-colors",
              done || active ? "border-t-accent" : "border-t-line")}>
            <span className={cn(
              "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-all",
              active && "bg-grad text-white shadow-glow",
              done && "bg-accent-light text-accent",
              !active && !done && "border-[1.5px] border-line-strong text-muted",
            )}>
              {done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : n}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[13px] font-bold", active || done ? "text-ink" : "text-muted")}>{label}</span>
              <span className="block truncate text-[11.5px] text-muted">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Section heading inside a form: title, then a hairline to the edge. */
export function FormDivider({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 mt-8 flex items-center gap-3">
      <span className="whitespace-nowrap text-sm font-bold text-ink">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

const SERVICE_TAG: Partial<Record<Plan["service_type"], string>> = {
  PERSONAL_TRAINING: "Personal Training",
  DIET: "Diet",
};

/** ".plan-card": selectable plan tile with a red tick bubble when selected. */
export function PlanCard({ plan, selected, onToggle }: { plan: Plan; selected: boolean; onToggle: () => void }) {
  const tag = plan.type === "ADD_ON" ? SERVICE_TAG[plan.service_type] ?? "Add-on" : null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "relative flex cursor-pointer flex-col rounded-2xl border-2 bg-surface p-6 text-left transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]",
        selected ? "border-accent bg-accent-light shadow-glow" : "border-line hover:border-line-accent",
      )}
    >
      <div className="mb-[15px] flex items-start justify-between gap-3">
        <span className="text-base font-extrabold text-ink">{plan.name}</span>
        <span className="whitespace-nowrap text-lg font-extrabold text-accent">{formatINR(plan.price)}</span>
      </div>
      <div>
        <span className="mb-2 block text-[13px] font-bold text-secondary-grey">
          Duration: {plan.duration_days} days
          {plan.total_sessions > 0 && ` · ${plan.total_sessions} sessions`}
        </span>
        {tag && (
          <span className="mb-2 inline-block rounded-md bg-hover px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-grey">
            {tag}
          </span>
        )}
        {plan.description && <p className="m-0 text-xs leading-normal text-muted">{plan.description}</p>}
      </div>
      {selected && (
        <span className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-surface bg-grad text-white shadow-glow">
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={4} />
        </span>
      )}
    </button>
  );
}

/** ".payment-summary-card": dark gradient card with base total, discount and net payable. */
export function PaymentSummaryCard({ gross, discount, reason }: { gross: number; discount: number; reason: string }) {
  const net = Math.max(0, gross - (Number.isFinite(discount) ? discount : 0));
  const label = "text-sm font-semibold uppercase tracking-[0.05em] opacity-80";
  const amount = "text-[28px] font-extrabold text-success";
  return (
    <div className="hero-card mb-6 rounded-2xl p-6 shadow-premium">
      <div className="flex items-center justify-between">
        <span className={label}>Base Total</span>
        <span className={amount}>{formatINR(gross)}</span>
      </div>
      {discount > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <span className={label}>Discount ({reason || "Offer"})</span>
          <span className={amount}>- {formatINR(discount)}</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-line-accent pt-3">
        <span className={label}>Net Payable</span>
        <span className={amount}>{formatINR(net)}</span>
      </div>
    </div>
  );
}
