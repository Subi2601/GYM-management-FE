import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterTabs, ListToolbar } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { referralApi, useEligible, useInvalidateReferrals, useReferralCounts, useReferralStatus,
  useRewards } from "@/features/referrals/api";
import { MemberReferralsDrawer } from "@/features/referrals/components/MemberReferralsDrawer";
import { RewardProgramModal } from "@/features/referrals/components/RewardProgramModal";
import { paginationProps, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { useWriteAccess } from "@/hooks/use-write-access";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { EligibleRow, PersonBrief, RewardRow } from "@/types/referral";

const TABS = ["month", "pending", "rewarded"] as const;
const NOT_SET = "No referral reward is set for this month. Contact the admin to set the reward.";

function MemberCell({ name, registration_id, phone }: { name: string; registration_id: string; phone: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-ink">{name}</div>
      <div className="text-xs text-muted">{registration_id} · {phone}</div>
    </div>
  );
}

/** "Priya, Arun +2" with everyone in the tooltip. */
function Referred({ people, count }: { people: PersonBrief[]; count: number }) {
  const names = people.map((p) => p.name);
  return (
    <div className="min-w-0" title={names.join(", ")}>
      <div className="font-display text-xl leading-none text-ink">{count}</div>
      <div className="truncate text-xs text-muted">{names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2}` : ""}</div>
    </div>
  );
}

/**
 * Referrals — this month's reward (set by the admin, stops at month end), who is eligible this month, rewards
 * pending hand-over from ended months, and everyone already rewarded. Each row opens the member's referral tree.
 */
export function ReferralsPage() {
  const [tab, setTab] = useUrlEnum("tab", TABS, "month");
  const list = useListState();
  const status = useReferralStatus();
  const counts = useReferralCounts();
  const eligible = useEligible(tab === "month");
  const rewards = useRewards({ ...list.query, status: tab === "rewarded" ? "GIVEN" : "PENDING" }, tab !== "month");
  const manage = useWriteAccess("referral:manage");
  const invalidate = useInvalidateReferrals();
  const [programOpen, setProgramOpen] = useState<string | null>(null);
  const [treeFor, setTreeFor] = useState<string | null>(null);

  const current = status.data?.current;
  const isSet = !!current?.is_set;

  const give = useMutation({
    mutationFn: ({ memberId, monthKey }: { memberId: string; monthKey?: string }) => referralApi.give(memberId, monthKey),
    onSuccess: async (res) => { notify.success(res.message); await invalidate(); },
    onError: notify.error,
  });
  const giving = give.isPending ? give.variables?.memberId : undefined;
  const onGive = async (name: string, reward: string, memberId: string, monthKey?: string) => {
    if (await confirm(`Give "${reward}" to ${name}? It will be marked as given today.`)) give.mutate({ memberId, monthKey });
  };

  const giveButton = (memberId: string, name: string, reward: string, monthKey: string | undefined, blockedReason?: string) => (
    <span title={manage.reason ?? blockedReason} className="inline-flex">
      <Button className="h-8 px-3 py-0 text-xs" disabled={manage.disabled || !!blockedReason} loading={giving === memberId}
        icon={<Icon name="award" className="h-3.5 w-3.5" />} onClick={() => void onGive(name, reward, memberId, monthKey)}>
        Give
      </Button>
    </span>
  );

  const monthColumns = useMemo<ColumnDef<EligibleRow, unknown>[]>(() => [
    { id: "member", header: "Member", cell: ({ row }) => <MemberCell {...row.original} /> },
    { id: "referred", header: "Referred this month", meta: { width: "200px" },
      cell: ({ row }) => <Referred people={row.original.referred} count={row.original.referral_count} /> },
    { id: "reward", header: "Reward", meta: { width: "240px" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            {r.reward ? <div className="truncate font-semibold text-ink">{r.reward}</div> : <div className="text-muted">—</div>}
            {r.next_reward && r.needed_for_next != null && !r.given && (
              <div className="truncate text-xs text-muted">{r.needed_for_next} more → {r.next_reward}</div>
            )}
          </div>
        );
      } },
    { id: "state", header: "Status", meta: { width: "130px" },
      cell: ({ row }) => {
        const r = row.original;
        const [label, tone] = r.given ? ["Given", "bg-success-soft text-success"] : r.eligible ? ["Eligible", "bg-info-soft text-info"]
          : ["Not yet", "bg-subtle text-muted"];
        return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", tone)}>{label}</span>;
      } },
    { id: "actions", header: "Actions", meta: { width: "170px" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <ActionGroup>
            {manage.show && r.eligible && !r.given && r.reward
              && giveButton(r.member_id, r.name, r.reward, undefined, isSet ? undefined : NOT_SET)}
            <ActionIcon kind="tree" title="Referrals" onClick={() => setTreeFor(r.member_id)} />
          </ActionGroup>
        );
      } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [manage, isSet, giving]);

  const rewardColumns = useMemo<ColumnDef<RewardRow, unknown>[]>(() => [
    { id: "member", header: "Member", cell: ({ row }) => <MemberCell {...row.original} /> },
    { id: "month", header: "Month", meta: { width: "140px" }, cell: ({ row }) => row.original.month_label },
    { id: "referred", header: "Earned for", meta: { width: "200px" },
      cell: ({ row }) => <Referred people={row.original.referred} count={row.original.referral_count} /> },
    { id: "reward", header: "Reward", meta: { width: "220px" },
      cell: ({ row }) => <span className="font-semibold text-ink">{row.original.reward}</span> },
    tab === "rewarded"
      ? { id: "given", header: "Given on", meta: { width: "130px" }, cell: ({ row }) => formatDate(row.original.given_on) }
      : { id: "wait", header: "Status", meta: { width: "130px" },
        cell: () => <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-bold text-warning">To give</span> },
    { id: "actions", header: "Actions", meta: { width: "170px" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <ActionGroup>
            {manage.show && r.status === "PENDING" && giveButton(r.member_id, r.name, r.reward, r.month_key)}
            <ActionIcon kind="tree" title="Referrals" onClick={() => setTreeFor(r.member_id)} />
          </ActionGroup>
        );
      } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [manage, tab, giving]);

  const c = counts.data;
  const tabs = (
    <FilterTabs value={tab} onChange={setTab} tabs={[
      { value: "month", label: "Eligible this month", count: c?.eligible },
      { value: "pending", label: "Pending to give", count: c?.pending },
      { value: "rewarded", label: "Rewarded", count: c?.rewarded },
    ]} />
  );

  return (
    <div>
      <PageHeader title="Referrals" subtitle="Monthly referral rewards and who referred whom"
        actions={manage.show && (
          <span title={manage.reason}>
            <Button icon={<Icon name="award" className="h-4 w-4" />} disabled={manage.disabled}
              onClick={() => setProgramOpen(current?.month_key ?? "")}>
              {isSet ? "Edit reward" : "Set reward"}
            </Button>
          </span>
        )} />

      {/* This month's reward */}
      {current && (isSet ? (
        <div className="mb-5 rounded-2xl border border-line bg-surface p-5 shadow-subtle">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-muted">{current.month_label} reward</div>
              <div className="text-lg font-bold text-ink">{current.title ?? "Referral reward"}</div>
            </div>
            <div className="text-right text-xs text-muted">
              Ends in <b className="text-ink">{status.data?.days_left} day{status.data?.days_left === 1 ? "" : "s"}</b>
              <div>{status.data?.next.is_set ? `${status.data.next.month_label} is set` : `${status.data?.next.month_label} not set yet`}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {current.tiers.map((t) => (
              <span key={t.min_referrals} className="rounded-xl border border-line-accent bg-accent-light px-3 py-1.5 text-[13px] text-ink">
                Refer <b>{t.min_referrals}</b> → <b>{t.reward}</b>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning-line bg-warning-soft px-5 py-4 text-warning">
          <span className="flex items-start gap-2.5 text-sm">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span><b>No referral reward for {current.month_label}.</b> Rewards can't be given until it's set.
              {manage.show ? " Set this month's reward to switch it on." : " Contact the admin to set the reward."}</span>
          </span>
          {manage.show && (
            <Button disabled={manage.disabled} onClick={() => setProgramOpen(current.month_key)}>Set reward now</Button>
          )}
        </div>
      ))}

      {tab === "month" ? (
        <DataTable columns={monthColumns} data={eligible.data?.rows ?? []} loading={eligible.isLoading}
          fetching={eligible.isFetching} getRowId={(r) => r.member_id} onRowClick={(r) => setTreeFor(r.member_id)}
          emptyIcon="users" emptyMessage="No referrals this month yet"
          emptyHint="When someone joins with 'Referred by' set and pays, their referrer shows here." toolbar={tabs} />
      ) : (
        <DataTable columns={rewardColumns} data={rewards.data?.items ?? []} loading={rewards.isLoading}
          fetching={rewards.isFetching} getRowId={(r) => r.id} onRowClick={(r) => setTreeFor(r.member_id)}
          emptyIcon="award"
          emptyMessage={tab === "pending" ? "No rewards waiting to be given" : "No rewards given yet"}
          emptyHint={tab === "pending" ? "When a month ends, everyone who reached a reward shows here." : undefined}
          pagination={paginationProps(list, rewards.data?.total)}
          toolbar={<>{tabs}<ListToolbar search={{ value: list.search, onChange: list.setSearch,
            placeholder: "Search name, phone or reg ID" }} /></>} />
      )}

      {programOpen !== null && status.data && (
        <RewardProgramModal current={status.data.current} next={status.data.next} initialMonth={programOpen}
          onClose={() => setProgramOpen(null)} />
      )}
      {treeFor && <MemberReferralsDrawer memberId={treeFor} onClose={() => setTreeFor(null)} />}
    </div>
  );
}
