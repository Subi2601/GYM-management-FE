import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys, useStaffCounts, type EmployeeListQuery } from "@/features/staff/api";
import { EmployeeProfileDrawer } from "@/features/staff/components/EmployeeProfileDrawer";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate, formatINR } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { EMPLOYEE_LIST_FILTERS, type Employee, type EmployeeListFilter, type EmployeeSortKey } from "@/types/employee";
import { EMPLOYEE_ROLES, type EmployeeRole } from "@/types/enums";

const TAB_LABEL: Record<EmployeeListFilter, string> = {
  active: "Active",
  archive: "Archive",
  all: "All staff",
};

const sortKey = (key: EmployeeSortKey) => key;

/** Staff directory — Active / Archive (terminated) / All tabs, search + role filter, sortable server-paginated table. */
export function StaffPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canCreate = useCan("employee:create");
  const canUpdate = useCan("employee:update");
  const canTerminate = useCan("employee:terminate");
  const writable = branch !== null;

  const [tab, setTab] = useUrlEnum("tab", EMPLOYEE_LIST_FILTERS, "active");
  const list = useListState();
  const [role, setRole] = useState<EmployeeRole | "">("");
  const [viewing, setViewing] = useState<Employee | null>(null);

  const { setPage } = list;
  // Tab / filter / branch changes restart from page 1.
  useEffect(() => setPage(1), [tab, role, branch, setPage]);

  // Dashboard quick link /staff?action=add opens the registration page.
  useAddAction(useCallback(() => navigate("/staff/new"), [navigate]), canCreate && writable);

  const query: EmployeeListQuery = { ...list.query, status: tab, role };
  const employees = useQuery({
    queryKey: staffKeys.list(branch, query),
    queryFn: () => staffApi.list(query),
    placeholderData: keepPreviousData,
  });

  const counts = useStaffCounts();

  const terminate = useMutation({
    mutationFn: (id: string) => staffApi.terminate(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      setViewing(null);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
    },
    onError: notify.error,
  });

  const { mutate: terminateEmployee } = terminate;
  const onTerminate = useCallback(async (e: Employee) => {
    if (await confirm(`Are you sure you want to terminate ${e.name}? This action cannot be undone.`)) {
      terminateEmployee(e.id);
    }
  }, [terminateEmployee]);

  const columns = useMemo<ColumnDef<Employee, unknown>[]>(() => [
    { accessorKey: "name", header: "Employee", meta: { sortKey: sortKey("name") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.name}</div>
          <div className="font-mono text-xs text-muted">{row.original.employee_code}</div>
        </div>
      ) },
    { accessorKey: "phone", header: "Phone", meta: { width: "130px" } },
    { accessorKey: "role", header: "Role", meta: { width: "140px", sortKey: sortKey("role") },
      cell: ({ row }) => humanize(row.original.role) },
    { accessorKey: "base_salary", header: "Base salary", meta: { width: "140px", align: "right", sortKey: sortKey("base_salary") },
      cell: ({ row }) => <span className="font-semibold">{formatINR(row.original.base_salary)}</span> },
    { accessorKey: "average_rating", header: "Rating", meta: { width: "100px", sortKey: sortKey("average_rating") },
      cell: ({ row }) => {
        const r = row.original.average_rating;
        return r == null ? <span className="text-muted">—</span> : (
          <span className="inline-flex items-center gap-1 font-semibold">
            <Icon name="star" strokeWidth={1.5} className="h-3.5 w-3.5 fill-warning text-warning" />
            {r.toFixed(1)}
          </span>
        );
      } },
    { accessorKey: "date_of_joining", header: "Joined", meta: { width: "120px", sortKey: sortKey("date_of_joining") },
      cell: ({ row }) => formatDate(row.original.date_of_joining) },
    { accessorKey: "status", header: "Status", meta: { width: "120px" },
      cell: ({ row }) => <StatusBadge value={row.original.status} /> },
    {
      id: "actions", header: "", meta: { width: "170px" },
      cell: ({ row }) => {
        const e = row.original;
        const active = e.status !== "TERMINATED";
        return (
          <ActionGroup>
            {canTerminate && writable && active && (
              <button type="button" className="btn-status-action btn-red" onClick={() => void onTerminate(e)}>
                Terminate
              </button>
            )}
            <ActionIcon kind="view" title="View profile" onClick={() => setViewing(e)} />
            {canUpdate && writable && active && (
              <ActionIcon kind="edit" onClick={() => navigate(`/staff/${e.id}/edit`)} />
            )}
          </ActionGroup>
        );
      },
    },
  ], [canTerminate, canUpdate, writable, onTerminate, navigate]);

  const active: ActiveFilter[] = [];
  if (role) active.push({ label: `Role: ${humanize(role)}`, onRemove: () => setRole("") });

  const data = employees.data?.data;
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Employees, their profiles, personal training clients and feedback"
        actions={canCreate && writable && (
          <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => navigate("/staff/new")}>
            Add staff
          </Button>
        )}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={employees.isLoading}
        fetching={employees.isFetching}
        getRowId={(e) => e.id}
        onRowClick={setViewing}
        rowClassName={(e) =>
          e.status === "TERMINATED" ? ROW_MARKER.muted
            : e.status === "ON_LEAVE" ? ROW_MARKER.new
              : e.status === "INACTIVE" ? ROW_MARKER.nearExpiry : undefined}
        emptyIcon="users"
        emptyMessage={filtered ? "No staff match these filters" : tab === "archive" ? "No terminated staff" : "No staff yet"}
        emptyHint={filtered ? "Try a different search or clear the filters."
          : canCreate && writable && tab !== "archive" ? "Add your first employee to get started." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={EMPLOYEE_LIST_FILTERS.map((f) => ({ value: f, label: TAB_LABEL[f], count: counts.data?.[f] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search name, phone or employee ID" }}
              filters={
                <FilterSelect placeholder="All roles" ariaLabel="Role" value={role}
                  onChange={(v) => setRole(v as EmployeeRole | "")}
                  options={EMPLOYEE_ROLES.map((r) => ({ value: r, label: humanize(r) }))} />
              }
              active={active}
            />
          </>
        }
      />

      {viewing && <EmployeeProfileDrawer employee={viewing} onClose={() => setViewing(null)} onTerminate={onTerminate} />}
    </div>
  );
}
