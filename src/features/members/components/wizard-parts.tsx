import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/plan";

/** The original ".readonly-input": dashed, greyed, not editable. */
export const READONLY_INPUT = "!border-dashed !bg-subtle !text-muted cursor-not-allowed";

/** ".form-grid-3" (3 → 2 → 1 columns). */
export const GRID_3 = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3";
/** ".form-grid-2". */
export const GRID_2 = "grid grid-cols-1 gap-6 md:grid-cols-2";

const STEPS = ["Personal Info", "Plan & Package", "Payment"] as const;

interface WizardStepsProps {
  current: number;
  onSelect: (step: 1 | 2 | 3) => void;
}

/** ".wizard-steps": numbered circles joined by lines; active steps turn red. */
export function WizardSteps({ current, onSelect }: WizardStepsProps) {
  return (
    <div className="mb-10 flex items-center justify-center rounded-2xl bg-subtle py-2.5 max-md:flex-col max-md:gap-5 max-md:p-5">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = current >= n;
        return (
          <div key={label} className="contents">
            {i > 0 && (
              <div className={cn("-mt-6 h-0.5 w-20 transition-all max-md:hidden", current >= i ? "bg-accent" : "bg-line")} />
            )}
            <button type="button" onClick={() => onSelect(n)}
              className="relative z-[1] flex min-w-[100px] cursor-pointer flex-col items-center gap-2.5 border-none bg-transparent">
              <span className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 bg-surface text-sm font-extrabold shadow-subtle transition-all duration-300",
                active ? "scale-110 border-accent text-accent shadow-[0_0_0_4px_var(--accent-red-light)]" : "border-line text-muted",
              )}>
                {n}
              </span>
              <span className={cn("text-[11px] uppercase tracking-[0.05em]",
                active ? "font-extrabold text-ink" : "font-bold text-muted")}>
                {label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** ".form-divider": a hairline with a centred caption. */
export function FormDivider({ children }: { children: ReactNode }) {
  return (
    <div className="relative mb-[25px] mt-[35px] border-t border-line-light text-center">
      <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 bg-surface px-4 text-xs font-extrabold uppercase tracking-[0.1em] text-secondary-grey">
        {children}
      </span>
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
        selected ? "border-accent bg-accent-light shadow-[0_0_0_1px_var(--accent-red)]" : "border-line hover:border-secondary-grey",
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
        <span className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-accent text-white shadow-[0_4px_6px_rgba(225,29,72,0.3)]">
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
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary-grey to-[#334155] p-6 text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
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
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-white/30 pt-3">
        <span className={label}>Net Payable</span>
        <span className={amount}>{formatINR(net)}</span>
      </div>
    </div>
  );
}
