import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { planApi, planKeys, useInvalidatePlans } from "@/features/plans/api";
import { PlanFormModal } from "@/features/plans/components/PlanFormModal";
import { useListState } from "@/hooks/use-list-state";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Plan } from "@/types/plan";

const TYPE_LABEL = { MEMBERSHIP: "Membership", ADD_ON: "Add-on" } as const;

/** Plans — list, search, add / edit modal, delete (backend refuses plans in use). */
export function PlansPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const list = useListState();
  const canCreate = useCan("plan:create");
  const canUpdate = useCan("plan:update");
  const canDelete = useCan("plan:delete");
  const invalidate = useInvalidatePlans();
  /** undefined = closed, null = add, Plan = edit. */
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);

  const plans = useQuery({
    queryKey: planKeys.list(branch, list.query),
    queryFn: () => planApi.list(list.query),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: planApi.remove,
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Plan, unknown>[]>(() => {
    const cols: ColumnDef<Plan, unknown>[] = [
      { accessorKey: "name", header: "Plan Name", meta: { width: "220px" },
        cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
      { accessorKey: "type", header: "Type", meta: { width: "120px" },
        cell: ({ row }) => TYPE_LABEL[row.original.type] },
      { accessorKey: "service_type", header: "Service", meta: { width: "150px" },
        cell: ({ row }) => (
          <StatusBadge value={row.original.service_type}
            tone={row.original.service_type === "PERSONAL_TRAINING" ? "purple" : row.original.service_type === "DIET" ? "green" : "grey"} />
        ) },
      { accessorKey: "duration_days", header: "Duration (Days)", meta: { width: "140px" } },
      { accessorKey: "total_sessions", header: "Sessions", meta: { width: "100px" },
        cell: ({ row }) => <span className="font-semibold">{row.original.total_sessions || "-"}</span> },
      { accessorKey: "price", header: "Price (₹)", meta: { width: "120px" },
        cell: ({ row }) => formatINR(row.original.price) },
    ];
    if (canUpdate || canDelete) {
      cols.push({
        id: "actions", header: "Actions", meta: { width: "120px" },
        cell: ({ row }) => (
          <ActionGroup>
            {canUpdate && <ActionIcon kind="edit" onClick={() => setEditing(row.original)} />}
            {canDelete && (
              <ActionIcon kind="delete" onClick={async () => {
                if (await confirm(`Are you sure you want to delete plan: ${row.original.name}?`)) remove.mutate(row.original.id);
              }} />
            )}
          </ActionGroup>
        ),
      });
    }
    return cols;
  }, [canUpdate, canDelete, remove]);

  const data = plans.data?.data;

  return (
    <div>
      <PageHeader
        title="Plans"
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search plans..." }}
        actions={
          <>
            <Button variant="secondary" icon={<Icon name="refresh" className="h-4 w-4" />}
              onClick={() => void plans.refetch()} disabled={plans.isFetching}>Refresh</Button>
            {canCreate && (
              <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setEditing(null)}>Add Plan</Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={plans.isLoading}
        emptyMessage="No plans configured."
        maxHeightClass="max-h-[calc(100vh-220px)]"
        getRowId={(p) => p.id}
        pagination={{
          page: list.page, pageSize: list.pageSize, total: data?.total ?? 0,
          onPageChange: list.setPage, onPageSizeChange: list.setPageSize,
        }}
      />

      {editing !== undefined && <PlanFormModal plan={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
