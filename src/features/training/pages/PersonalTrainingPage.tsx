import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Checkbox } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useTrainerLookup } from "@/features/lookups/api";
import { trainingApi, trainingKeys, type PTTab } from "@/features/training/api";
import { ChangeTrainerModal } from "@/features/training/components/ChangeTrainerModal";
import { LogSessionDrawer } from "@/features/training/components/LogSessionDrawer";
import { SessionHistoryDrawer } from "@/features/training/components/SessionHistoryDrawer";
import { paginationProps, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { PTListQuery, PTSortKey, PTStatusFilter, PTSubscription } from "@/types/training";

const TABS = ["active", "completed", "expired", "all"] as const satisfies readonly PTTab[];
type Tab = (typeof TABS)[number];

const TAB_STATUS: Record<Tab, PTStatusFilter> = {
  active: "ACTIVE",
  completed: "COMPLETED",
  expired: "EXPIRED",
  all: "ALL",
};
const TAB_LABEL: Record<Tab, string> = {
  active: "Active",
  completed: "Completed",
  expired: "Expired",
  all: "All",
};

const sortKey = (key: PTSortKey) => key;

/** Sessions left as a compact bar: green, amber at 3 or fewer, red when used up. */
function SessionsBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;
  const tone = remaining === 0 ? "bg-danger" : remaining <= 3 ? "bg-warning" : "bg-success";
  return (
    <div className="flex min-w-0 flex-col gap-1" title={`${remaining} of ${total} sessions remaining`}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={cn("font-bold", remaining === 0 ? "text-danger" : remaining <= 3 ? "text-warning" : "text-ink")}>
          {remaining} left
        </span>
        <span className="text-muted">of {total}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover">
        <div className={cn("h-full rounded-full transition-[width]", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Personal training — status tabs, search + trainer + paid-only filters, sortable list, log / history / trainer. */
export function PersonalTrainingPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canLog = useCan("pt:log");
  const canUpdate = useCan("pt:update");
  const [tab, setTab] = useUrlEnum("tab", TABS, "active");
  const list = useListState();
  const [trainerId, setTrainerId] = useState("");
  const [paidOnly, setPaidOnly] = useState(true);

  const [logFor, setLogFor] = useState<PTSubscription | null>(null);
  const [historyFor, setHistoryFor] = useState<PTSubscription | null>(null);
  const [trainerFor, setTrainerFor] = useState<PTSubscription | null>(null);

  const { setPage } = list;
  // Tab / filter changes restart from page 1.
  useEffect(() => setPage(1), [tab, trainerId, paidOnly, setPage]);

  const trainers = useTrainerLookup();
  const trainerOptions = (trainers.data ?? []).map((t) => ({ value: t.id, label: t.name }));

  const query: PTListQuery = {
    ...list.query, status: TAB_STATUS[tab], paid_only: paidOnly, trainer_id: trainerId || undefined,
  };
  const pts = useQuery({
    queryKey: trainingKeys.list(branch, query),
    queryFn: async () => (await trainingApi.list(query)).data,
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: trainingKeys.counts(branch, paidOnly),
    queryFn: async () => (await trainingApi.counts(paidOnly)).data,
  });

  const today = todayISO();

  const columns = useMemo<ColumnDef<PTSubscription, unknown>[]>(() => [
    {
      id: "member", header: "Member", meta: { sortKey: sortKey("member_name") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.member_name}</div>
          <div className="text-xs text-muted">{row.original.registration_id} · {row.original.member_phone}</div>
        </div>
      ),
    },
    {
      id: "trainer", header: "Trainer", meta: { width: "170px", sortKey: sortKey("trainer_name") },
      cell: ({ row }) => (
        <span className={cn(!row.original.trainer_id && "italic text-muted")}>{row.original.trainer_name}</span>
      ),
    },
    {
      id: "plan", header: "Plan", meta: { width: "180px" },
      cell: ({ row }) => {
        const pt = row.original;
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="truncate">{pt.plan_name}</span>
            {(pt.status !== "ACTIVE" || !pt.is_paid) && (
              <div className="flex gap-1">
                {pt.status !== "ACTIVE" && <StatusBadge value={pt.status} />}
                {!pt.is_paid && <StatusBadge value="PENDING" label="Unpaid" />}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "sessions", header: "Sessions", meta: { width: "150px", sortKey: sortKey("sessions_remaining") },
      cell: ({ row }) => <SessionsBar remaining={row.original.sessions_remaining} total={row.original.total_sessions} />,
    },
    {
      id: "start", header: "Start", meta: { width: "115px", sortKey: sortKey("start_date") },
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.start_date)}</span>,
    },
    {
      id: "expiry", header: "Expiry", meta: { width: "115px", sortKey: sortKey("expiry_date") },
      cell: ({ row }) => (
        <span className={cn("whitespace-nowrap font-semibold", row.original.expiry_date < today ? "text-danger" : "text-ink")}>
          {formatDate(row.original.expiry_date)}
        </span>
      ),
    },
    {
      id: "actions", header: "Actions", meta: { width: "250px" },
      cell: ({ row }) => {
        const pt = row.original;
        const loggable = pt.status === "ACTIVE" && pt.is_paid && pt.sessions_remaining > 0;
        return (
          <ActionGroup>
            {canLog && (
              <button type="button" disabled={!loggable} onClick={() => setLogFor(pt)}
                className="btn-status-action btn-red disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-accent disabled:hover:bg-none disabled:hover:text-accent disabled:hover:shadow-none"
                title={loggable ? "Log a session"
                  : !pt.is_paid ? "PT subscription is not paid yet"
                    : pt.sessions_remaining === 0 ? "No sessions remaining" : "PT subscription is not active"}>
                Log session
              </button>
            )}
            {canUpdate && (
              <button type="button" className="btn-status-action btn-grey" onClick={() => setTrainerFor(pt)}>
                Trainer
              </button>
            )}
            <button type="button" className="action-icon view" title="Session history" aria-label="Session history"
              onClick={() => setHistoryFor(pt)}>
              <Icon name="clock" className="h-4 w-4" />
            </button>
          </ActionGroup>
        );
      },
    },
  ], [canLog, canUpdate, today]);

  const active: ActiveFilter[] = [];
  if (trainerId) {
    active.push({ label: `Trainer: ${trainerOptions.find((t) => t.value === trainerId)?.label ?? "…"}`,
      onRemove: () => setTrainerId("") });
  }
  if (!paidOnly) active.push({ label: "Including unpaid", onRemove: () => setPaidOnly(true) });

  const data = pts.data;
  const filtered = !!list.debouncedSearch || !!trainerId;

  return (
    <div>
      <PageHeader title="Personal training" subtitle="PT clients, session logs and trainer assignments" />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={pts.isLoading}
        fetching={pts.isFetching}
        getRowId={(r) => r.id}
        onRowClick={(r) => setHistoryFor(r)}
        rowClassName={(r) => (r.status !== "ACTIVE" ? ROW_MARKER.muted : r.expiry_date < today ? ROW_MARKER.expired : undefined)}
        emptyIcon="dumbbell"
        emptyMessage={filtered ? "No PT clients match these filters"
          : tab === "active" ? "No active PT clients" : "No PT clients found"}
        emptyHint={filtered ? "Try a different search or clear the filters."
          : "Personal training starts when a member is enrolled on a PT add-on."}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts.data?.[t] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search member or trainer" }}
              filters={
                <>
                  <FilterSelect placeholder="All trainers" ariaLabel="Trainer" value={trainerId} onChange={setTrainerId}
                    options={trainerOptions} />
                  <div className="toolbar-control flex items-center">
                    <Checkbox checked={paidOnly} onChange={setPaidOnly} label="Paid only" />
                  </div>
                </>
              }
              actions={
                <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
                  loading={pts.isFetching && !pts.isLoading} onClick={() => void pts.refetch()}>
                  Refresh
                </Button>
              }
              active={active}
            />
          </>
        }
      />

      {logFor && <LogSessionDrawer pt={logFor} onClose={() => setLogFor(null)} />}
      {historyFor && <SessionHistoryDrawer pt={historyFor} onClose={() => setHistoryFor(null)} />}
      {trainerFor && <ChangeTrainerModal pt={trainerFor} onClose={() => setTrainerFor(null)} />}
    </div>
  );
}
