import { cn } from "@/lib/utils";
import type { DietTier } from "@/types/enums";

const TIER_STYLE: Record<DietTier, string> = {
  BASIC: "bg-hover text-secondary-grey",
  STANDARD: "bg-warning-soft text-warning",
  PREMIUM: "bg-success-soft text-success",
};

/** The original ".tier-badge.tier-{basic|standard|premium}" pill. */
export function TierBadge({ tier, className }: { tier: DietTier; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase", TIER_STYLE[tier], className)}>
      {tier}
    </span>
  );
}
