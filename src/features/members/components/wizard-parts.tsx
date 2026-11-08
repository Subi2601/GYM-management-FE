import { Icon } from "@/components/ui/Icon";
import { PlanBadges } from "@/features/plans/components/PlanBadges";
import { dayRate, planDuration, planUnitPrice } from "@/features/plans/labels";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/plan";

const STEPS = [
  { label: "Personal info", hint: "Contact and health" },
  { label: "Plan & package", hint: "Membership and add-ons" },
  { label: "Payment", hint: "Offer and collection" },
] as const;

interface WizardStepsProps {
  current: number;
  onSelect: (step: 1 | 2 | 3) => void;
  /** Steps the user can jump to (done or next); others are shown but not clickable. */
  canReach?: (step: 1 | 2 | 3) => boolean;
}

/**
 * Horizontal stepper: numbered dots joined by a line that fills as steps complete. Done steps show a tick and
 * stay clickable; on phones only the dots and the current label are shown.
 */
export function WizardSteps({ current, onSelect, canReach = () => true }: WizardStepsProps) {
  return (
    <nav aria-label="Registration steps" className="mb-6 rounded-2xl border border-line bg-surface px-5 py-4 shadow-subtle sm:px-7">
      <ol className="m-0 flex list-none items-center p-0">
        {STEPS.map(({ label, hint }, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = current > n;
          const active = current === n;
          const reachable = canReach(n) && !active;
          return (
            <li key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
              <button type="button" disabled={!reachable} aria-current={active ? "step" : undefined}
                onClick={() => onSelect(n)}
                className={cn("flex items-center gap-3 border-0 bg-transparent p-0 text-left",
                  reachable ? "cursor-pointer" : "cursor-default")}>
                <span className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition-all",
                  active && "bg-grad text-white shadow-glow",
                  done && "bg-accent-light text-accent ring-1 ring-line-accent",
                  !active && !done && "border-[1.5px] border-line-strong bg-surface text-muted",
                )}>
                  {done ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : n}
                </span>
                <span className={cn("min-w-0", !active && "max-sm:hidden")}>
                  <span className={cn("block whitespace-nowrap text-sm font-bold", active || done ? "text-ink" : "text-muted")}>
                    {label}
                  </span>
                  <span className="block whitespace-nowrap text-xs text-muted max-md:hidden">{hint}</span>
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="mx-3 h-[3px] min-w-6 flex-1 overflow-hidden rounded-full bg-line sm:mx-5">
                  <span className={cn("block h-full rounded-full bg-grad transition-all duration-500", done ? "w-full" : "w-0")} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const SERVICE_TAG: Partial<Record<Plan["service_type"], string>> = {
  PERSONAL_TRAINING: "Personal training",
  DIET: "Diet",
};

interface PlanCardProps {
  plan: Plan;
  selected: boolean;
  onToggle: () => void;
  /** The member's current plan: its end date (shows a "Current" badge). */
  current?: string | null;
}

/** Selectable plan tile — same height in a row: name, duration, package badges; price + unit price at the bottom. */
export function PlanCard({ plan, selected, onToggle, current }: PlanCardProps) {
  const tag = plan.type === "ADD_ON" ? SERVICE_TAG[plan.service_type] ?? "Add-on"
    : plan.type === "CUSTOM" ? `Custom · ${formatINR(dayRate(plan))}/day` : null;
  const unit = planUnitPrice(plan);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "relative flex h-full cursor-pointer flex-col rounded-2xl border-2 bg-surface p-5 text-left transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-premium",
        selected ? "border-accent bg-accent-light/40 shadow-glow" : "border-line hover:border-line-accent",
      )}
    >
      <span className={cn("absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full transition-all",
        selected ? "bg-grad text-white" : "border-[1.5px] border-line-strong bg-surface")}>
        {selected && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3.5} />}
      </span>
      {current !== undefined && (
        <span className="mb-1.5 self-start rounded-md bg-accent-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
          Current{current ? ` · till ${formatDate(current)}` : ""}
        </span>
      )}
      <span className="pr-9 text-[15px] font-extrabold leading-snug text-ink">{plan.name}</span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary-grey">
          <Icon name="calendar" className="h-3.5 w-3.5" />
          {planDuration(plan)}
        </span>
        {tag && (
          <span className="rounded-md bg-hover px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-grey">{tag}</span>
        )}
      </span>
      <span className="mt-2"><PlanBadges plan={plan} /></span>
      {plan.description && <p className="m-0 mt-2 line-clamp-2 text-xs leading-normal text-muted">{plan.description}</p>}
      <span className="mt-auto pt-4 font-display text-2xl leading-none text-accent">{formatINR(plan.price, true)}</span>
      {unit && <span className="mt-1 text-xs font-medium text-muted">{unit}</span>}
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
        <div className="mt-3 flex items-center justify-between gap-3">
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
