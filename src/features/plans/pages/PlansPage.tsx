import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { planApi, planKeys, useInvalidatePlans, type PlanListQuery, type PlanSortKey,
  type PlanTab } from "@/features/plans/api";
import { PlanFormDrawer } from "@/features/plans/components/PlanFormDrawer";
import { dayRate, SERVICE_LABEL, TYPE_LABEL } from "@/features/plans/labels";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { PLAN_SERVICE_TYPES, type PlanServiceType, type PlanType } from "@/types/enums";
import type { Plan } from "@/types/plan";

const PLAN_TABS = ["all", "membership", "addon", "custom"] as const satisfies readonly PlanTab[];

const TAB_LABEL: Record<PlanTab, string> = {
  all: "All plans", membership: "Membership", addon: "Add-ons", custom: "Customization",
};
const EMPTY_MESSAGE: Record<PlanTab, string> = {
  all: "No plans yet", membership: "No membership plans yet", addon: "No add-on services yet",
  custom: "No customized plans yet",
};
const TAB_TYPE: Record<PlanTab, PlanType | undefined> = {
  all: undefined, membership: "MEMBERSHIP", addon: "ADD_ON", custom: "CUSTOM",
};

const SERVICE_TONE = { GENERAL: "grey", PERSONAL_TRAINING: "purple", DIET: "green" } as const;

const sortKey = (key: PlanSortKey) => key;

/** Plans — type tabs with counts, search + service filter, sortable list, add / edit drawer, delete (backend refuses plans in use). */
export function PlansPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [tab, setTab] = useUrlEnum("tab", PLAN_TABS, "all");
  const list = useListState();
  const [serviceType, setServiceType] = useState<PlanServiceType | "">("");
  const canCreate = useCan("plan:create");
  const canUpdate = useCan("plan:update");
  const canDelete = useCan("plan:delete");
  const invalidate = useInvalidatePlans();
  /** undefined = closed, null = add, Plan = edit. */
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);

  const { setPage } = list;
  // Tab / filter changes restart from page 1.
  useEffect(() => setPage(1), [tab, serviceType, setPage]);
  // Membership and custom plans are always General, so the service filter doesn't apply there.
  const serviceFilterApplies = tab === "all" || tab === "addon";
  useEffect(() => {
    if (!serviceFilterApplies) setServiceType("");
  }, [serviceFilterApplies]);

  useAddAction(useCallback(() => setEditing(null), []), canCreate);

  const query: PlanListQuery = { ...list.query, type: TAB_TYPE[tab], service_type: serviceType };
  const plans = useQuery({
    queryKey: planKeys.list(branch, query),
    queryFn: () => planApi.list(query),
    placeholderData: keepPreviousData,
  });

  const counts = useQuery({ queryKey: planKeys.counts(branch), queryFn: async () => (await planApi.counts()).data });

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
      { accessorKey: "name", header: "Plan", meta: { sortKey: sortKey("name") },
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[360px]">
            <div className="truncate font-semibold text-ink">{row.original.name}</div>
            {row.original.description && <div className="truncate text-xs text-muted">{row.original.description}</div>}
          </div>
        ) },
      { accessorKey: "type", header: "Type", meta: { width: "120px", sortKey: sortKey("type") },
        cell: ({ row }) => TYPE_LABEL[row.original.type] },
      { accessorKey: "service_type", header: "Service", meta: { width: "170px", sortKey: sortKey("service_type") },
        cell: ({ row }) => <StatusBadge value={row.original.service_type} tone={SERVICE_TONE[row.original.service_type]} /> },
      { accessorKey: "duration_days", header: "Duration", meta: { width: "120px", sortKey: sortKey("duration_days") },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.duration_days} days</span> },
      { accessorKey: "total_sessions", header: "Sessions", meta: { width: "100px" },
        cell: ({ row }) => row.original.total_sessions || <span className="text-muted">—</span> },
      { accessorKey: "price", header: "Price", meta: { width: "130px", align: "right", sortKey: sortKey("price") },
        cell: ({ row }) => {
          const perDay = dayRate(row.original);
          return (
            <div>
              <div className="font-semibold">{formatINR(row.original.price)}</div>
              {perDay !== null && <div className="text-xs text-muted">{formatINR(perDay)} per day</div>}
            </div>
          );
        } },
    ];
    if (canUpdate || canDelete) {
      cols.push({
        id: "actions", header: "", meta: { width: "110px" },
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

  const active: ActiveFilter[] = [];
  if (serviceType) active.push({ label: `Service: ${SERVICE_LABEL[serviceType]}`, onRemove: () => setServiceType("") });

  const data = plans.data?.data;
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader
        title="Plans"
        subtitle="Membership plans, add-on services and customized plans"
        actions={canCreate && (
          <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setEditing(null)}>Add plan</Button>
        )}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={plans.isLoading}
        fetching={plans.isFetching}
        getRowId={(p) => p.id}
        onRowClick={canUpdate ? (p) => setEditing(p) : undefined}
        emptyIcon="tag"
        emptyMessage={filtered ? "No plans match these filters" : EMPTY_MESSAGE[tab]}
        emptyHint={filtered ? "Try a different search or clear the filters." : canCreate ? "Add a plan so members can be enrolled." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={PLAN_TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts.data?.[t] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search plans" }}
              filters={serviceFilterApplies && (
                <FilterSelect placeholder="Any service" ariaLabel="Service type" value={serviceType}
                  onChange={(v) => setServiceType(v as PlanServiceType | "")}
                  options={PLAN_SERVICE_TYPES.map((s) => ({ value: s, label: SERVICE_LABEL[s] }))} />
              )}
              active={active}
            />
          </>
        }
      />

      {editing !== undefined && <PlanFormDrawer plan={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
