import { useQuery } from "@tanstack/react-query";

import { Icon, type IconName } from "@/components/ui/Icon";
import { useMembershipActions } from "@/features/memberships/api";
import { subscriptionApi, subscriptionKeys } from "@/features/subscriptions/api";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { SubscriptionRow } from "@/types/subscription";

/** created_at is UTC; en-CA gives the local calendar day as YYYY-MM-DD. */
const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
/** What the member paid in that bill: price − discount − credit from the plan it replaced. */
const paidFor = (s: SubscriptionRow) => s.price - s.discount_amount - (s.upgrade_credit ?? 0);
const isMembership = (s: SubscriptionRow) => s.plan_type !== "ADD_ON";

type EventKind = "joined" | "renewed" | "upgraded" | "addon" | "received";

const EVENT: Record<EventKind, { label: string; icon: IconName; dot: string }> = {
  joined: { label: "Joined", icon: "user", dot: "bg-info-soft text-info" },
  renewed: { label: "Renewed", icon: "repeat", dot: "bg-success-soft text-success" },
  upgraded: { label: "Upgraded", icon: "trending", dot: "bg-accent-light text-accent" },
  addon: { label: "Add-on", icon: "plus", dot: "bg-warning-soft text-warning" },
  received: { label: "Received by transfer", icon: "switch", dot: "bg-info-soft text-info" },
};
const CLOSED_LABEL = { CANCELLED: "Cancelled", TRANSFERRED: "Transferred" } as const;

/**
 * The member's plans at a glance: the plan running today (days left, paid), what comes next, then a timeline of
 * what happened — joined, renewed, upgraded (old → new, credit), add-ons — each with what was paid.
 */
export function MembershipHistory({ memberId }: { memberId: string }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const subs = useQuery({
    queryKey: subscriptionKeys.member(branch, memberId),
    queryFn: async () => (await subscriptionApi.forMember(memberId)).data,
  });
  const actions = useMembershipActions(memberId);
  if (subs.isLoading) return <p className="m-0 text-sm text-muted">Loading…</p>;
  const rows = subs.data ?? [];
  if (rows.length === 0) return <p className="m-0 text-sm text-muted">No plans yet. Use Add plan to start a membership.</p>;

  const today = todayISO();
  const frozen = actions.data?.freeze?.active?.state === "ACTIVE" ? actions.data.freeze.active : null;
  const byId = new Map(rows.map((s) => [s.id, s]));
  const live = rows.filter((s) => isMembership(s) && !s.upgraded_to_id && !s.closed_reason);
  const newest = (list: SubscriptionRow[]) => [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const current = newest(live.filter((s) => s.start_date <= today && s.end_date >= today));
  const upcoming = [...live.filter((s) => s.start_date > today)].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const lastEnded = current || upcoming ? undefined : newest(live);

  const firstMembership = [...rows].filter(isMembership).sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const kindOf = (s: SubscriptionRow): EventKind =>
    !isMembership(s) ? "addon" : s.transferred_from_id ? "received" : s.upgraded_from_id ? "upgraded"
      : s.id === firstMembership?.id ? "joined" : "renewed";
  const events = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex flex-col gap-5">
      {/* Now */}
      {current ? (
        <div className="rounded-xl border border-success/30 bg-success-soft/40 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-success">Active now</div>
              <div className="text-lg font-bold text-ink">{current.plan_name}</div>
              <div className="text-xs text-muted">{formatDate(current.start_date)} → {formatDate(current.end_date)}</div>
              {frozen && (
                <div className="mt-1 inline-flex rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-bold text-info">
                  Frozen till {formatDate(frozen.end_date)}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-display text-3xl leading-none text-ink">{Math.max(0, days(today, current.end_date))}</div>
              <div className="text-xs text-muted">days left</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-success"
              style={{ width: `${Math.min(100, Math.max(3, (days(current.start_date, today) / Math.max(1, days(current.start_date, current.end_date))) * 100))}%` }} />
          </div>
          {upcoming && (
            <div className="mt-2.5 text-xs text-muted">
              Next: <b className="text-ink">{upcoming.plan_name}</b> from {formatDate(upcoming.start_date)} (already paid)
            </div>
          )}
        </div>
      ) : upcoming ? (
        <div className="rounded-xl border border-info/30 bg-info-soft/40 px-4 py-3.5 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-info">Starts soon</div>
          <b className="text-ink">{upcoming.plan_name}</b> from {formatDate(upcoming.start_date)} to {formatDate(upcoming.end_date)}
        </div>
      ) : lastEnded ? (
        <div className="rounded-xl border border-danger/30 bg-danger-soft/40 px-4 py-3.5 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-danger">No active plan</div>
          <b className="text-ink">{lastEnded.plan_name}</b> ended on {formatDate(lastEnded.end_date)}. Renew to continue.
        </div>
      ) : null}

      {/* Timeline */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">History</div>
        <ol className="m-0 list-none p-0">
          {events.map((s, i) => {
            const kind = kindOf(s);
            const meta = EVENT[kind];
            const from = s.upgraded_from_id ? byId.get(s.upgraded_from_id) : undefined;
            const replaced = s.upgraded_to_id ? byId.get(s.upgraded_to_id) : undefined;
            return (
              <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < events.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-28px)] w-px bg-line" />}
                <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.dot)}>
                  <Icon name={meta.icon} className="h-4 w-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <div className="text-sm text-ink">
                      <b>{meta.label}</b>
                      {kind === "upgraded" && from ? <> · {from.plan_name} → <b>{s.plan_name}</b></> : <> · {s.plan_name}</>}
                      <span className="text-xs text-muted"> · {formatDate(localDay(s.created_at))}</span>
                    </div>
                    <div className="text-xs text-muted">
                      Valid {formatDate(s.start_date)} – {formatDate(s.end_date)}
                      {s.upgrade_credit != null && <> · {formatINR(s.upgrade_credit)} credit from {from?.plan_name ?? "old plan"}</>}
                      {s.discount_amount > 0 && <> · {s.discount_reason ?? "Discount"} −{formatINR(s.discount_amount)}</>}
                    </div>
                    {replaced && (
                      <div className="text-xs font-semibold text-accent">Upgraded to {replaced.plan_name} on {formatDate(localDay(replaced.created_at))}</div>
                    )}
                    {s.frozen_days > 0 && (
                      <div className="text-xs font-semibold text-info">Frozen {s.frozen_days} day(s), added to the end date</div>
                    )}
                    {s.closed_reason && s.closed_on && (
                      <div className="text-xs font-semibold text-danger">
                        {CLOSED_LABEL[s.closed_reason]} on {formatDate(s.closed_on)}
                        {s.close_note && <span className="font-normal text-muted"> · {s.close_note}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {s.transferred_from_id ? (
                      <div className="text-xs text-muted">paid by<br />previous member</div>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-ink">{formatINR(paidFor(s))}</div>
                        <div className={cn("text-xs", s.payment_status === "PAID" ? "text-muted" : "font-semibold text-warning")}>
                          {s.payment_status === "PAID" ? "paid" : "payment pending"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
