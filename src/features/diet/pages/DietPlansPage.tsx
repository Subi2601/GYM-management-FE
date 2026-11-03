import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { FilterSelect, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { dietApi, dietKeys } from "@/features/diet/api";
import { DietViewDrawer } from "@/features/diet/components/DietViewDrawer";
import { TierBadge } from "@/features/diet/components/TierBadge";
import { paginationProps, useListState } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { EligibleListQuery, EligibleMember, EligibleSortKey } from "@/types/diet";

const sortKey = (key: EligibleSortKey) => key;

type PlanStatus = "" | "yes" | "no";
const PLAN_STATUS_OPTIONS = [
  { value: "yes", label: "Has plan" },
  { value: "no", label: "No plan" },
];

/** Full-page builder; the row travels as router state (`{ member }`) so the page needn't look the member up again. */
const builderPath = (memberId: string) => `/diet-plans/${memberId}`;

/** Diet plans — eligible members with tier and plan status; search, plan-status filter, sortable columns. */
export function DietPlansPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const navigate = useNavigate();
  const canManage = useCan("diet:manage");
  const list = useListState();
  const [planStatus, setPlanStatus] = useState<PlanStatus>("");
  const [viewFor, setViewFor] = useState<EligibleMember | null>(null);

  const { setPage } = list;
  useEffect(() => setPage(1), [planStatus, setPage]);

  const query: EligibleListQuery = {
    ...list.query, has_plan: planStatus === "" ? undefined : planStatus === "yes",
  };
  const eligible = useQuery({
    queryKey: dietKeys.eligible(branch, query),
    queryFn: async () => (await dietApi.eligible(query)).data,
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<ColumnDef<EligibleMember, unknown>[]>(() => {
    const openBuilder = (m: EligibleMember) => navigate(builderPath(m.member_id), { state: { member: m } });
    return [
      { accessorKey: "registration_id", header: "Reg ID", meta: { width: "110px", sortKey: sortKey("registration_id") },
        cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-secondary-grey">{row.original.registration_id}</span> },
      { id: "name", header: "Member", meta: { sortKey: sortKey("name") },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{row.original.name}</div>
            <div className="text-xs text-muted">{row.original.phone}</div>
          </div>
        ) },
      { id: "eligible", header: "Eligible tier", meta: { width: "130px" },
        cell: ({ row }) => <TierBadge tier={row.original.eligible_tier} /> },
      { id: "plan", header: "Plan", meta: { width: "170px", sortKey: sortKey("plan_tier") },
        cell: ({ row }) => {
          const m = row.original;
          if (!m.has_plan) return <StatusBadge value="NO_PLAN" label="Not configured" />;
          return (
            <div className="flex items-center gap-1.5">
              <StatusBadge value="ACTIVE" label="Configured" />
              {m.plan_tier && m.plan_tier !== m.eligible_tier && <TierBadge tier={m.plan_tier} />}
            </div>
          );
        } },
      { id: "updated", header: "Last updated", meta: { width: "130px", sortKey: sortKey("last_modified_date") },
        cell: ({ row }) => row.original.last_modified_date
          ? <span className="whitespace-nowrap">{formatDate(row.original.last_modified_date)}</span>
          : <span className="text-muted">—</span> },
      {
        id: "actions", header: "", meta: { width: "170px" },
        cell: ({ row }) => {
          const m = row.original;
          return (
            <ActionGroup>
              {canManage && (
                <button type="button" className={m.has_plan ? "btn-status-action btn-grey" : "btn-status-action btn-red"}
                  onClick={() => openBuilder(m)}>
                  {m.has_plan ? "Edit plan" : "Build plan"}
                </button>
              )}
              {m.has_plan && <ActionIcon kind="view" title="View plan" onClick={() => setViewFor(m)} />}
            </ActionGroup>
          );
        },
      },
    ];
  }, [canManage, navigate]);

  const active: ActiveFilter[] = [];
  if (planStatus) {
    active.push({ label: `Plan: ${planStatus === "yes" ? "Has plan" : "No plan"}`, onRemove: () => setPlanStatus("") });
  }

  const data = eligible.data;
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader title="Diet plans" subtitle="Tier-based nutrition plans and macro targets for eligible members" />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={eligible.isLoading}
        fetching={eligible.isFetching}
        getRowId={(r) => r.member_id}
        onRowClick={(m) => {
          if (m.has_plan) setViewFor(m);
          else if (canManage) navigate(builderPath(m.member_id), { state: { member: m } });
        }}
        emptyIcon="cup"
        emptyMessage={filtered ? "No members match these filters" : "No members eligible for a diet plan"}
        emptyHint={filtered ? "Try a different search or clear the filters."
          : "Members appear here once they are enrolled on a diet add-on."}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <ListToolbar
            search={{ value: list.search, onChange: list.setSearch, placeholder: "Search name, phone or reg ID" }}
            filters={
              <FilterSelect placeholder="Any plan status" ariaLabel="Plan status" value={planStatus}
                onChange={(v) => setPlanStatus(v as PlanStatus)} options={PLAN_STATUS_OPTIONS} />
            }
            active={active}
          />
        }
      />

      {viewFor && <DietViewDrawer member={viewFor} onClose={() => setViewFor(null)} />}
    </div>
  );
}
