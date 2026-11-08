import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Modal";
import { useReferralStatus, useReferralTree } from "@/features/referrals/api";
import { formatDate } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import type { ReferralTier, TreeNode, TreeReward } from "@/types/referral";

const monthKeyOf = (iso: string) => iso.slice(0, 7);
const monthLabelOf = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** Each referral's state for rewards (only direct, paid referrals count, in the month they joined). */
function statusOf(n: TreeNode): { label: string; tone: string; hint: string } {
  if (n.counted_status === "GIVEN") return { label: "Rewarded", tone: "bg-success-soft text-success", hint: "Counted for a reward that was given" };
  if (n.counted_status === "PENDING") return { label: "Counted", tone: "bg-info-soft text-info", hint: "Counted for a reward not given yet" };
  if (n.paid) return { label: "Joined", tone: "bg-subtle text-secondary-grey", hint: "Paid; the month didn't reach a reward" };
  return { label: "Not paid yet", tone: "bg-warning-soft text-warning", hint: "Counts once they pay for a plan" };
}

function Tile({ label, value, sub, children }: { label: string; value: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="font-display text-2xl leading-tight text-ink">{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      {children}
    </div>
  );
}

function RewardChip({ reward }: { reward: TreeReward }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
      reward.status === "GIVEN" ? "bg-success-soft text-success" : "bg-info-soft text-info")}>
      <Icon name="award" className="h-3 w-3" />{reward.reward}
      <span className="font-semibold opacity-80">
        · {reward.status === "GIVEN" ? `given ${formatDate(reward.given_on)}` : "to give"}
      </span>
    </span>
  );
}

/** This month's progress: reward reached and the next one to aim for. */
function progress(count: number, tiers: ReferralTier[]) {
  const reached = [...tiers].reverse().find((t) => t.min_referrals <= count) ?? null;
  const next = tiers.find((t) => t.min_referrals > count) ?? null;
  return { reached, next };
}

/**
 * A member's referrals — direct only (rewards count only direct referrals): totals, this month's progress, then
 * month by month who joined through them, each with plan and reward status, and the reward earned that month.
 */
export function MemberReferralsDrawer({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const tree = useReferralTree(memberId);
  const status = useReferralStatus();
  const navigate = useNavigate();
  const data = tree.data;
  const open = (id: string) => { onClose(); navigate(`/members/${id}`); };

  const program = status.data?.current;
  const currentKey = program?.month_key ?? new Date().toISOString().slice(0, 7);
  const people = [...(data?.root.children ?? [])].sort((a, b) => b.joining_date.localeCompare(a.joining_date));
  const months = [...new Set(people.map((p) => monthKeyOf(p.joining_date)))];
  const rewardByMonth = new Map((data?.rewards ?? []).map((r) => [r.month_key, r]));
  const thisMonth = people.filter((p) => monthKeyOf(p.joining_date) === currentKey && p.paid).length;
  const { reached, next } = progress(thisMonth, program?.is_set ? program.tiers : []);
  const given = (data?.rewards ?? []).filter((r) => r.status === "GIVEN").length;
  const pending = (data?.rewards ?? []).filter((r) => r.status === "PENDING").length;
  const pct = next ? Math.min(100, Math.round((thisMonth / next.min_referrals) * 100)) : reached ? 100 : 0;

  return (
    <Drawer open width="720px" title="Referrals" onClose={onClose}
      subtitle={data ? `${data.root.name} · ${data.root.registration_id}` : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {tree.isLoading ? <p className="m-0 text-sm text-muted">Loading…</p>
        : tree.isError ? <p className="m-0 text-sm text-danger">{tree.error.message}</p>
          : data && (
            <div className="flex flex-col gap-5">
              {data.referred_by && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Icon name="userCheck" className="h-3.5 w-3.5" />
                  {data.root.name} was referred by
                  <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent"
                    onClick={() => open(data.referred_by!.member_id)}>
                    {data.referred_by.name} ({data.referred_by.registration_id})
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Tile label="Referred" value={people.length} sub={`${people.filter((p) => p.paid).length} paid & joined`} />
                <Tile label="Rewards" value={given} sub={pending ? `${pending} waiting to be given` : "received"} />
                <Tile label="This month" value={thisMonth}
                  sub={!program?.is_set ? "No reward set this month"
                    : next ? `${next.min_referrals - thisMonth} more → ${next.reward}` : reached ? `Reached: ${reached.reward}` : undefined}>
                  {program?.is_set && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-grad" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </Tile>
              </div>

              {people.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                  {data.root.name} hasn't referred anyone yet.
                </div>
              ) : months.map((key) => {
                const list = people.filter((p) => monthKeyOf(p.joining_date) === key);
                const reward = rewardByMonth.get(key);
                const isNow = key === currentKey;
                return (
                  <section key={key}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-bold text-ink">
                        {monthLabelOf(key)}{isNow && <span className="ml-1.5 text-xs font-semibold text-accent">this month</span>}
                        <span className="ml-2 text-xs font-normal text-muted">
                          {list.filter((p) => p.paid).length} of {list.length} joined & paid
                        </span>
                      </div>
                      {reward ? <RewardChip reward={reward} />
                        : isNow && reached ? (
                          <span className="rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-bold text-info">Reached: {reached.reward}</span>
                        ) : null}
                    </div>
                    <ul className="m-0 flex list-none flex-col divide-y divide-line-light overflow-hidden rounded-xl border border-line p-0">
                      {list.map((p) => {
                        const s = statusOf(p);
                        return (
                          <li key={p.member_id}>
                            <button type="button" onClick={() => open(p.member_id)}
                              className="flex w-full cursor-pointer items-center gap-3 border-0 bg-surface px-3 py-2.5 text-left hover:bg-hover">
                              <span className="side-avatar h-9 w-9 shrink-0 text-[11px]">{initials(p.name)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                                <span className="block truncate text-xs text-muted">
                                  {p.registration_id} · {p.plan_name ? `${p.plan_name}${p.plan_end ? ` · till ${formatDate(p.plan_end)}` : ""}` : "No plan"}
                                </span>
                              </span>
                              <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
                                Joined<br /><span className="font-semibold text-ink">{formatDate(p.joining_date)}</span>
                              </span>
                              <span title={s.hint} className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", s.tone)}>{s.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
    </Drawer>
  );
}
