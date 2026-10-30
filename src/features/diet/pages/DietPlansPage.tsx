import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { dietApi, dietKeys } from "@/features/diet/api";
import { DietBuilderModal } from "@/features/diet/components/DietBuilderModal";
import { DietViewModal } from "@/features/diet/components/DietViewModal";
import { TierBadge } from "@/features/diet/components/TierBadge";
import { useListState } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { EligibleMember } from "@/types/diet";

const miniBtn = "flex h-8 w-8 items-center justify-center rounded-md border-none transition-all disabled:cursor-not-allowed disabled:opacity-40";

/** Diet Plan Management — eligible members with tier, plan status, configure / view. */
export function DietPlansPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canManage = useCan("diet:manage");
  const list = useListState();
  const [buildFor, setBuildFor] = useState<EligibleMember | null>(null);
  const [viewFor, setViewFor] = useState<EligibleMember | null>(null);

  const eligible = useQuery({
    queryKey: dietKeys.eligible(branch, list.query),
    queryFn: async () => (await dietApi.eligible(list.query)).data,
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<ColumnDef<EligibleMember, unknown>[]>(() => [
    { accessorKey: "registration_id", header: "Reg ID", meta: { width: "110px" } },
    {
      id: "name", header: "Member Name", meta: { width: "220px" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink">{row.original.name}</span>
          <span className="text-xs font-medium text-muted">{row.original.phone}</span>
        </div>
      ),
    },
    {
      id: "tier", header: "Plan Tier", meta: { width: "130px" },
      cell: ({ row }) => <TierBadge tier={row.original.eligible_tier} />,
    },
    {
      id: "status", header: "Status", meta: { width: "200px" },
      cell: ({ row }) => {
        const m = row.original;
        if (!m.has_plan) return <StatusBadge value="PENDING" tone="grey" label="Not Configured" />;
        return (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5">
              <StatusBadge value="ACTIVE" label="Configured" />
              {m.plan_tier && m.plan_tier !== m.eligible_tier && (
                <span className="text-[11px] font-bold text-muted">({m.plan_tier})</span>
              )}
            </div>
            {m.last_modified_date && (
              <span className="text-[11px] font-medium text-muted">Updated {formatDate(m.last_modified_date)}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions", header: "Actions", meta: { width: "120px" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <button type="button" className={`${miniBtn} bg-hover text-secondary-grey hover:enabled:bg-line hover:enabled:text-ink`}
            title={row.original.has_plan ? "View Plan" : "No plan configured yet"} disabled={!row.original.has_plan}
            onClick={() => setViewFor(row.original)}>
            <Icon name="eye" className="h-3.5 w-3.5" />
          </button>
          {canManage && (
            <button type="button" className={`${miniBtn} bg-info-soft text-info hover:bg-info-soft hover:text-info`}
              title={row.original.has_plan ? "Configure" : "Build Plan"} onClick={() => setBuildFor(row.original)}>
              <Icon name="edit" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ], [canManage]);

  return (
    <div className="w-full">
      <PageHeader
        title="Diet Plan Management"
        subtitle="Tier-based nutrition planning & macro calculation"
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search members..." }}
      />

      <DataTable
        columns={columns}
        data={eligible.data?.items ?? []}
        loading={eligible.isLoading}
        emptyMessage="No members eligible for diet plan found."
        getRowId={(r) => r.member_id}
        maxHeightClass="max-h-[calc(100vh-280px)]"
        pagination={{
          page: list.page,
          pageSize: list.pageSize,
          total: eligible.data?.total ?? 0,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
        }}
      />

      <DietBuilderModal member={buildFor} onClose={() => setBuildFor(null)} />
      <DietViewModal member={viewFor} onClose={() => setViewFor(null)} />
    </div>
  );
}
