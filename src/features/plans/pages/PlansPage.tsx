import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PLAN_STATUS_TABS, planApi, planKeys, useInvalidatePlans, usePlanCategories, type PlanCountsQuery,
  type PlanListQuery, type PlanSortKey } from "@/features/plans/api";
import { ManageCategoriesModal } from "@/features/plans/components/ManageCategoriesModal";
import { PlanBadges } from "@/features/plans/components/PlanBadges";
import { PlanFormDrawer } from "@/features/plans/components/PlanFormDrawer";
import { planDuration, planUnitPrice } from "@/features/plans/labels";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { useWriteAccess } from "@/hooks/use-write-access";
import { formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { Plan } from "@/types/plan";

const sortKey = (key: PlanSortKey) => key;
const TAB_LABEL = { active: "Active", inactive: "Inactive", all: "All plans" } as const;

/**
 * Plans & Pricing — Active / Inactive tabs (`?tab=`), category filter (`?cat=`) + search, add / edit drawer,
 * activate / deactivate (plans with members are deactivated, not deleted), category manager.
 */
export function PlansPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [params, setParams] = useSearchParams();
  const list = useListState({ pageSize: 50 });
  const [tab, setTab] = useUrlEnum("tab", PLAN_STATUS_TABS, "active");
  const create = useWriteAccess("plan:create");
  const update = useWriteAccess("plan:update");
  const del = useWriteAccess("plan:delete");
  const invalidate = useInvalidatePlans();
  /** undefined = closed, null = add, Plan = edit. */
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);
  const [managing, setManaging] = useState(false);

  const categories = usePlanCategories();
  const cats = useMemo(() => categories.data ?? [], [categories.data]);
  const rawCat = params.get("cat");
  const cat = cats.some((c) => c.id === rawCat) ? rawCat! : "";
  const setCat = (next: string) => setParams((prev) => {
    const p = new URLSearchParams(prev);
    if (!next) p.delete("cat");
    else p.set("cat", next);
    return p;
  }, { replace: true });

  const { setPage } = list;
  useEffect(() => setPage(1), [cat, tab, setPage]);
  useAddAction(useCallback(() => setEditing(null), []), create.allowed);

  const query: PlanListQuery = { ...list.query, category_id: cat || undefined, status: tab === "all" ? undefined : tab };
  const plans = useQuery({
    queryKey: planKeys.list(branch, query),
    queryFn: () => planApi.list(query),
    placeholderData: keepPreviousData,
  });
  const countsQuery: PlanCountsQuery = { search: list.debouncedSearch || undefined, category_id: cat || undefined };
  const counts = useQuery({
    queryKey: planKeys.counts(branch, countsQuery),
    queryFn: async () => (await planApi.counts(countsQuery)).data,
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: (p: Plan) => planApi.update(p.id, { is_active: !p.is_active }),
    onSuccess: async (res) => {
      notify.success(res.data.is_active ? `${res.data.name} is active again` : `${res.data.name} is inactive: not shown in billing`);
      await invalidate();
    },
    onError: notify.error,
  });
  const remove = useMutation({
    mutationFn: planApi.remove,
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Plan, unknown>[]>(() => [
    { accessorKey: "name", header: "Plan", meta: { sortKey: sortKey("name") },
      cell: ({ row }) => (
        <div className={cn("min-w-0 max-w-[280px]", !row.original.is_active && "opacity-60")}>
          <div className="truncate font-semibold text-ink">{row.original.name}</div>
          <div className="truncate text-xs text-muted">
            {cat ? row.original.description ?? "" : row.original.category_name}
          </div>
        </div>
      ) },
    { accessorKey: "duration_days", header: "Duration", meta: { width: "120px", sortKey: sortKey("duration_days") },
      cell: ({ row }) => <span className="whitespace-nowrap">{planDuration(row.original)}</span> },
    { id: "package", header: "Package", meta: { width: "150px" },
      cell: ({ row }) => <PlanBadges plan={row.original} empty={<span className="text-muted">Single</span>} /> },
    { accessorKey: "price", header: "Price", meta: { width: "140px", align: "right", sortKey: sortKey("price") },
      cell: ({ row }) => (
        <div>
          <div className="font-semibold">{formatINR(row.original.price, true)}</div>
          <div className="text-xs text-muted">{planUnitPrice(row.original)}</div>
        </div>
      ) },
    // Status only on "All plans"; the Active / Inactive tabs already say it.
    ...(tab === "all" ? [{ id: "status", header: "Status", meta: { width: "110px" },
      cell: ({ row }) => <StatusBadge value={row.original.is_active ? "ACTIVE" : "INACTIVE"} /> } satisfies ColumnDef<Plan, unknown>] : []),
    {
      id: "actions", header: "Actions", meta: { width: "200px" },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <ActionGroup>
            {update.show && (
              <span title={update.reason} className="inline-flex">
                <button type="button" className="btn-status-action btn-grey disabled:pointer-events-none disabled:opacity-40"
                  disabled={update.disabled || toggle.isPending} onClick={() => toggle.mutate(p)}>
                  {p.is_active ? "Deactivate" : "Activate"}
                </button>
              </span>
            )}
            {update.show && (
              <ActionIcon kind="edit" disabled={update.disabled} disabledReason={update.reason} onClick={() => setEditing(p)} />
            )}
            {del.show && (
              <ActionIcon kind="delete" disabled={del.disabled} disabledReason={del.reason} onClick={async () => {
                if (await confirm(`Delete plan ${p.name}? Plans members are on can only be deactivated.`)) remove.mutate(p.id);
              }} />
            )}
          </ActionGroup>
        );
      },
    },
  ], [cat, tab, update, del, toggle, remove]);

  const active: ActiveFilter[] = [];
  const catName = cats.find((c) => c.id === cat)?.name;
  if (catName) active.push({ label: `Category: ${catName}`, onRemove: () => setCat("") });
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader
        title="Plans & Pricing"
        subtitle="Your packages and prices. Make a plan inactive to stop selling it; members on it keep it"
        actions={
          <>
            {update.show && (
              <Button variant="secondary" icon={<Icon name="tag" className="h-4 w-4" />} onClick={() => setManaging(true)}>
                Categories
              </Button>
            )}
            {create.show && (
              <span title={create.reason}>
                <Button icon={<Icon name="plus" className="h-4 w-4" />} disabled={create.disabled} onClick={() => setEditing(null)}>
                  Add plan
                </Button>
              </span>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        data={plans.data?.data.items ?? []}
        loading={plans.isLoading}
        fetching={plans.isFetching}
        getRowId={(p) => p.id}
        onRowClick={update.allowed ? (p) => setEditing(p) : undefined}
        emptyIcon="tag"
        emptyMessage={filtered ? "No plans match these filters" : tab === "inactive" ? "No inactive plans" : "No plans yet"}
        emptyHint={filtered ? "Try a different search or clear the filters."
          : create.allowed ? "Add a plan so the desk can sell it." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, plans.data?.data.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={PLAN_STATUS_TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts.data?.[t] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search plans" }}
              filters={
                <FilterSelect placeholder="All categories" ariaLabel="Category" value={cat} onChange={setCat}
                  options={cats.map((c) => ({ value: c.id, label: c.is_active ? c.name : `${c.name} (inactive)` }))} />
              }
              active={active}
            />
          </>
        }
      />

      {editing !== undefined && (
        <PlanFormDrawer plan={editing} defaultCategoryId={cat || cats[0]?.id}
          onClose={() => setEditing(undefined)} />
      )}
      {managing && <ManageCategoriesModal onClose={() => setManaging(false)} />}
    </div>
  );
}
