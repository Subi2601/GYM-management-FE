import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePlanLookup } from "@/features/lookups/api";
import { subscriptionApi, subscriptionKeys, type SubscriptionTab } from "@/features/subscriptions/api";
import { CompletePaymentDrawer } from "@/features/subscriptions/components/CompletePaymentDrawer";
import { RenewDrawer } from "@/features/subscriptions/components/RenewDrawer";
import { SubscriptionViewDrawer } from "@/features/subscriptions/components/SubscriptionViewDrawer";
import { paginationProps, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { RenewalState } from "@/types/enums";
import type { SubscriptionDetail, SubscriptionListQuery, SubscriptionRow,
  SubscriptionSortKey } from "@/types/subscription";

const TABS = ["all", "expiring", "expired", "active"] as const satisfies readonly SubscriptionTab[];
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  all: "All",
  expiring: "Expiring soon",
  expired: "Expired",
  active: "Active",
};

const TAB_STATE: Record<Tab, RenewalState | undefined> = {
  all: undefined,
  expiring: "EXPIRING",
  expired: "EXPIRED",
  active: "NONE",
};

const sortKey = (key: SubscriptionSortKey) => key;

/** "Today", "5 days left", "3 days ago" — shown under the expiry date of expiring / expired rows. */
function expiryHint(row: SubscriptionRow): string | null {
  if (row.renewal_state === "NONE") return null;
  if (row.days_left === 0) return "Today";
  if (row.days_left > 0) return `${row.days_left} day${row.days_left === 1 ? "" : "s"} left`;
  const ago = -row.days_left;
  return `${ago} day${ago === 1 ? "" : "s"} ago`;
}

/** Subscriptions & renewals — latest subscription per member: renewal tabs, plan filter, sortable table, renew / view / pay. */
export function SubscriptionsPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [tab, setTab] = useUrlEnum("tab", TABS, "all");
  const list = useListState();
  const [planId, setPlanId] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [renewRow, setRenewRow] = useState<SubscriptionRow | null>(null);
  const [payFor, setPayFor] = useState<SubscriptionDetail | null>(null);
  const canRenew = useCan("subscription:create");

  const { setPage } = list;
  // Tab / filter changes restart from page 1.
  useEffect(() => setPage(1), [tab, planId, setPage]);

  const query: SubscriptionListQuery = { ...list.query, renewal_state: TAB_STATE[tab], plan_id: planId || undefined };
  const subs = useQuery({
    queryKey: subscriptionKeys.list(branch, query),
    queryFn: () => subscriptionApi.list(query),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: subscriptionKeys.counts(branch),
    queryFn: async () => (await subscriptionApi.counts()).data,
  });

  const plans = usePlanLookup();
  const planOptions = (plans.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const columns = useMemo<ColumnDef<SubscriptionRow, unknown>[]>(() => [
    { accessorKey: "member_name", header: "Member", meta: { sortKey: sortKey("member_name") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.member_name}</div>
          <div className="font-mono text-xs text-muted">{row.original.registration_id}</div>
        </div>
      ) },
    { accessorKey: "plan_name", header: "Plan", meta: { width: "200px", sortKey: sortKey("plan_name") } },
    { accessorKey: "start_date", header: "Start", meta: { width: "120px", sortKey: sortKey("start_date") },
      cell: ({ row }) => formatDate(row.original.start_date) },
    { accessorKey: "end_date", header: "Expiry", meta: { width: "130px", sortKey: sortKey("end_date") },
      cell: ({ row }) => {
        const s = row.original;
        const hint = expiryHint(s);
        return (
          <div className="whitespace-nowrap">
            <div className={cn("font-semibold",
              s.renewal_state === "EXPIRED" ? "text-danger" : s.renewal_state === "EXPIRING" ? "text-warning" : "text-ink")}>
              {formatDate(s.end_date)}
            </div>
            {hint && <div className="text-xs text-muted">{hint}</div>}
          </div>
        );
      } },
    { accessorKey: "status", header: "Status", meta: { width: "130px" },
      cell: ({ row }) => {
        const s = row.original;
        if (s.renewal_state === "EXPIRED") return <StatusBadge value="EXPIRED" />;
        if (s.renewal_state === "EXPIRING") return <StatusBadge value="EXPIRING" label="Expiring soon" />;
        return <StatusBadge value={s.status} />;
      } },
    { accessorKey: "payment_status", header: "Payment", meta: { width: "110px" },
      cell: ({ row }) => <StatusBadge value={row.original.payment_status} /> },
    {
      id: "actions", header: "", meta: { width: "150px" },
      cell: ({ row }) => {
        const s = row.original;
        const due = s.renewal_state !== "NONE";
        return (
          <ActionGroup>
            {canRenew && due && (
              <button type="button" className={cn("btn-status-action", s.renewal_state === "EXPIRED" ? "btn-red" : "btn-yellow")}
                onClick={() => setRenewRow(s)}>
                Renew
              </button>
            )}
            <ActionIcon kind="view" onClick={() => setViewId(s.id)} />
          </ActionGroup>
        );
      },
    },
  ], [canRenew]);

  const active: ActiveFilter[] = [];
  if (planId) active.push({ label: `Plan: ${planOptions.find((p) => p.value === planId)?.label ?? "…"}`, onRemove: () => setPlanId("") });

  const data = subs.data?.data;
  const filtered = !!list.debouncedSearch || active.length > 0 || tab !== "all";

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Latest membership per member, renewals and pending payments" />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={subs.isLoading}
        fetching={subs.isFetching}
        getRowId={(s) => s.id}
        onRowClick={(s) => setViewId(s.id)}
        rowClassName={(s) =>
          s.renewal_state === "EXPIRED" ? ROW_MARKER.expired
            : s.renewal_state === "EXPIRING" ? ROW_MARKER.nearExpiry : undefined}
        emptyIcon="repeat"
        emptyMessage={subs.isError ? subs.error.message : filtered ? "No subscriptions match these filters" : "No subscriptions yet"}
        emptyHint={filtered ? "Try a different search, tab or plan." : "Subscriptions appear here once members are enrolled."}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts.data?.[t] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search member, reg ID or plan" }}
              filters={
                <FilterSelect placeholder="All plans" ariaLabel="Plan" value={planId} onChange={setPlanId}
                  options={planOptions} className="min-w-[170px]" />
              }
              actions={
                <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
                  onClick={() => void subs.refetch()} disabled={subs.isFetching}>Refresh</Button>
              }
              active={active}
            />
          </>
        }
      />

      {viewId && (
        <SubscriptionViewDrawer
          subscriptionId={viewId}
          onClose={() => setViewId(null)}
          onCompletePayment={(detail) => { setViewId(null); setPayFor(detail); }}
        />
      )}
      {payFor && <CompletePaymentDrawer detail={payFor} onClose={() => setPayFor(null)} />}
      {renewRow && <RenewDrawer row={renewRow} onClose={() => setRenewRow(null)} />}
    </div>
  );
}
