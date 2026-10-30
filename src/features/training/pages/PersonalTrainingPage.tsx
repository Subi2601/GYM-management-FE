import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Checkbox } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { trainingApi, trainingKeys } from "@/features/training/api";
import { ChangeTrainerModal } from "@/features/training/components/ChangeTrainerModal";
import { LogSessionModal } from "@/features/training/components/LogSessionModal";
import { SessionHistoryModal } from "@/features/training/components/SessionHistoryModal";
import { useListState } from "@/hooks/use-list-state";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { PT_STATUSES } from "@/types/enums";
import type { PTStatusFilter, PTSubscription } from "@/types/training";

const STATUS_FILTERS: PTStatusFilter[] = [...PT_STATUSES, "ALL"];

type RowAction = "log" | "trainer" | "history";

const ACTION_STYLE: Record<RowAction, { label: string; icon: IconName; className: string; title: string }> = {
  log: { label: "Log", icon: "plus", title: "Log Session",
    className: "bg-info-soft text-info hover:enabled:bg-info-soft" },
  trainer: { label: "Trainer", icon: "userCheck", title: "Change Trainer",
    className: "bg-success-soft text-success hover:enabled:bg-success-soft" },
  history: { label: "History", icon: "clock", title: "View History",
    className: "border-line bg-subtle text-secondary-grey hover:enabled:bg-hover" },
};

function PtActionButton({ kind, onClick, disabled, disabledTitle }: {
  kind: RowAction; onClick: () => void; disabled?: boolean; disabledTitle?: string;
}) {
  const s = ACTION_STYLE[kind];
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={disabled ? disabledTitle : s.title}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 py-1.5 text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
        s.className)}>
      <Icon name={s.icon} className="h-4 w-4" />
      {s.label}
    </button>
  );
}

function SessionBadge({ remaining, total }: { remaining: number; total: number }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold",
      remaining === 0 ? "bg-danger-soft text-danger"
        : remaining <= 3 ? "bg-warning-soft text-warning"
          : "bg-success-soft text-success")}>
      {remaining} / {total}
    </span>
  );
}

/** Personal Training Dashboard — active PT clients, log session, history, change trainer. */
export function PersonalTrainingPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canLog = useCan("pt:log");
  const canUpdate = useCan("pt:update");
  const list = useListState();
  const [status, setStatus] = useState<PTStatusFilter>("ACTIVE");
  const [paidOnly, setPaidOnly] = useState(true);

  const [logFor, setLogFor] = useState<PTSubscription | null>(null);
  const [historyFor, setHistoryFor] = useState<PTSubscription | null>(null);
  const [trainerFor, setTrainerFor] = useState<PTSubscription | null>(null);

  const query = { ...list.query, status, paid_only: paidOnly };
  const pts = useQuery({
    queryKey: trainingKeys.list(branch, query),
    queryFn: async () => (await trainingApi.list(query)).data,
    placeholderData: keepPreviousData,
  });

  const today = todayISO();

  const columns = useMemo<ColumnDef<PTSubscription, unknown>[]>(() => [
    {
      id: "member", header: "Member", meta: { width: "200px" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink">{row.original.member_name}</span>
          <span className="text-xs font-medium text-muted">{row.original.registration_id} · {row.original.member_phone}</span>
        </div>
      ),
    },
    {
      id: "trainer", header: "Trainer", meta: { width: "160px" },
      cell: ({ row }) => (
        <span className={cn(!row.original.trainer_id && "italic text-muted")}>{row.original.trainer_name}</span>
      ),
    },
    {
      id: "plan", header: "Plan", meta: { width: "160px" },
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <span>{row.original.plan_name}</span>
          {(row.original.status !== "ACTIVE" || !row.original.is_paid) && (
            <div className="flex gap-1">
              {row.original.status !== "ACTIVE" && <StatusBadge value={row.original.status} />}
              {!row.original.is_paid && <StatusBadge value="PENDING" label="Unpaid" />}
            </div>
          )}
        </div>
      ),
    },
    { accessorKey: "total_sessions", header: "Total", meta: { width: "80px" } },
    {
      id: "remaining", header: "Remaining", meta: { width: "110px" },
      cell: ({ row }) => <SessionBadge remaining={row.original.sessions_remaining} total={row.original.total_sessions} />,
    },
    {
      id: "expiry", header: "Expiry", meta: { width: "120px" },
      cell: ({ row }) => (
        <span className={cn(row.original.expiry_date < today && "font-semibold text-accent")}>
          {formatDate(row.original.expiry_date)}
        </span>
      ),
    },
    {
      id: "actions", header: "Actions", meta: { width: "280px" },
      cell: ({ row }) => {
        const pt = row.original;
        const loggable = pt.status === "ACTIVE" && pt.is_paid && pt.sessions_remaining > 0;
        return (
          <div className="flex justify-end gap-2">
            {canLog && (
              <PtActionButton kind="log" onClick={() => setLogFor(pt)} disabled={!loggable}
                disabledTitle={!pt.is_paid ? "PT subscription is not paid yet" : "PT subscription is not active"} />
            )}
            {canUpdate && <PtActionButton kind="trainer" onClick={() => setTrainerFor(pt)} />}
            <PtActionButton kind="history" onClick={() => setHistoryFor(pt)} />
          </div>
        );
      },
    },
  ], [canLog, canUpdate, today]);

  const filterSelect = "h-[42px] rounded-[10px] border border-line bg-subtle px-3 text-sm font-semibold text-ink outline-none transition-all focus:border-accent focus:bg-surface";

  return (
    <div className="mx-auto w-full">
      <PageHeader
        title="Personal Training Dashboard"
        subtitle="Manage active personal training sessions and logs"
        showBack={false}
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search members or trainers..." }}
        actions={
          <>
            <select aria-label="Status filter" className={filterSelect} value={status}
              onChange={(e) => { setStatus(e.target.value as PTStatusFilter); list.setPage(1); }}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
            <div className="flex h-[42px] items-center rounded-[10px] border border-line bg-surface px-3">
              <Checkbox checked={paidOnly} onChange={(v) => { setPaidOnly(v); list.setPage(1); }} label="Paid only" />
            </div>
            <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
              loading={pts.isFetching && !pts.isLoading} onClick={() => void pts.refetch()}>
              Refresh
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={pts.data?.items ?? []}
        loading={pts.isLoading}
        emptyMessage={status === "ACTIVE" ? "No active PT members found." : "No PT members found."}
        getRowId={(r) => r.id}
        rowClassName={(r) => (r.status !== "ACTIVE" ? ROW_MARKER.muted : r.expiry_date < today ? ROW_MARKER.expired : undefined)}
        pagination={{
          page: list.page,
          pageSize: list.pageSize,
          total: pts.data?.total ?? 0,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
        }}
      />

      <LogSessionModal pt={logFor} onClose={() => setLogFor(null)} />
      <SessionHistoryModal pt={historyFor} onClose={() => setHistoryFor(null)} />
      <ChangeTrainerModal pt={trainerFor} onClose={() => setTrainerFor(null)} />
    </div>
  );
}
