import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { subscriptionApi, subscriptionKeys } from "@/features/subscriptions/api";
import { CompletePaymentModal } from "@/features/subscriptions/components/CompletePaymentModal";
import { RenewModal } from "@/features/subscriptions/components/RenewModal";
import { SubscriptionViewModal } from "@/features/subscriptions/components/SubscriptionViewModal";
import { useListState } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { RenewalState } from "@/types/enums";
import type { SubscriptionDetail, SubscriptionListQuery, SubscriptionRow } from "@/types/subscription";

const RENEWAL_FILTERS: { value: "" | RenewalState; label: string }[] = [
  { value: "", label: "All Subscriptions" },
  { value: "EXPIRED", label: "Expired" },
  { value: "EXPIRING", label: "Expiring Soon" },
  { value: "NONE", label: "Active" },
];

function renewalLabel(row: SubscriptionRow): string | null {
  if (row.renewal_state === "EXPIRED") return "Renew Now";
  if (row.renewal_state === "EXPIRING") return row.days_left <= 0 ? "Today" : `${row.days_left} Days`;
  return null;
}

/** Subscriptions & Renewals — latest subscription per member, renew, view, complete payment. */
export function SubscriptionsPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const list = useListState();
  const [renewalState, setRenewalState] = useState<"" | RenewalState>("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [renewRow, setRenewRow] = useState<SubscriptionRow | null>(null);
  const [payFor, setPayFor] = useState<SubscriptionDetail | null>(null);
  const canRenew = useCan("subscription:create");
  const { setPage } = list;

  useEffect(() => setPage(1), [renewalState, setPage]);

  const query: SubscriptionListQuery = { ...list.query, renewal_state: renewalState || undefined };
  const subs = useQuery({
    queryKey: subscriptionKeys.list(branch, query),
    queryFn: () => subscriptionApi.list(query),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<ColumnDef<SubscriptionRow, unknown>[]>(() => [
    { accessorKey: "registration_id", header: "ID", meta: { width: "90px" } },
    { accessorKey: "member_name", header: "Member Name", meta: { width: "180px" },
      cell: ({ row }) => <span className="font-semibold">{row.original.member_name}</span> },
    { accessorKey: "plan_name", header: "Plans", meta: { width: "200px" } },
    { accessorKey: "start_date", header: "Start Date", meta: { width: "120px" },
      cell: ({ row }) => formatDate(row.original.start_date) },
    { accessorKey: "end_date", header: "Expiry Date", meta: { width: "120px" },
      cell: ({ row }) => formatDate(row.original.end_date) },
    { accessorKey: "status", header: "Status", meta: { width: "130px" },
      cell: ({ row }) => {
        const s = row.original;
        if (s.renewal_state === "EXPIRED") return <StatusBadge value="EXPIRED" />;
        if (s.renewal_state === "EXPIRING") return <StatusBadge value="EXPIRING" label="Expiring Soon" />;
        return <StatusBadge value={s.status} />;
      } },
    { accessorKey: "payment_status", header: "Payment", meta: { width: "100px" },
      cell: ({ row }) => <StatusBadge value={row.original.payment_status} /> },
    { id: "renewal", header: "Renewal", meta: { width: "140px" },
      cell: ({ row }) => {
        const label = renewalLabel(row.original);
        if (!label) return null;
        const tone = row.original.renewal_state === "EXPIRED" ? "btn-red" : "btn-yellow";
        return canRenew ? (
          <button type="button" className={`btn-status-action ${tone}`}
            onClick={(e) => { e.stopPropagation(); setRenewRow(row.original); }}>
            {label}
          </button>
        ) : <span className={`btn-status-action ${tone} pointer-events-none`}>{label}</span>;
      } },
    { id: "actions", header: "Actions", meta: { width: "90px" },
      cell: ({ row }) => (
        <ActionGroup>
          <ActionIcon kind="view" onClick={() => setViewId(row.original.id)} />
        </ActionGroup>
      ) },
  ], [canRenew]);

  const data = subs.data?.data;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search subscriptions..." }}
        actions={
          <>
            <select value={renewalState} onChange={(e) => setRenewalState(e.target.value as "" | RenewalState)}
              aria-label="Renewal state"
              className="h-[42px] min-w-[170px] cursor-pointer rounded-[10px] border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink outline-none transition-all focus:border-secondary-grey">
              {RENEWAL_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
              onClick={() => void subs.refetch()} disabled={subs.isFetching}>Refresh</Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={subs.isLoading}
        emptyMessage="No subscriptions found."
        getRowId={(s) => s.id}
        rowClassName={(s) =>
          s.renewal_state === "EXPIRED" ? ROW_MARKER.expired
            : s.renewal_state === "EXPIRING" ? ROW_MARKER.nearExpiry : undefined}
        pagination={{
          page: list.page, pageSize: list.pageSize, total: data?.total ?? 0,
          onPageChange: list.setPage, onPageSizeChange: list.setPageSize,
        }}
      />

      {viewId && (
        <SubscriptionViewModal
          subscriptionId={viewId}
          onClose={() => setViewId(null)}
          onCompletePayment={(detail) => { setViewId(null); setPayFor(detail); }}
        />
      )}
      {payFor && <CompletePaymentModal detail={payFor} onClose={() => setPayFor(null)} />}
      {renewRow && <RenewModal row={renewRow} onClose={() => setRenewRow(null)} />}
    </div>
  );
}
