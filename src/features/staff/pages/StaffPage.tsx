import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys } from "@/features/staff/api";
import { EmployeeFormModal } from "@/features/staff/components/EmployeeFormModal";
import { EmployeeProfileModal } from "@/features/staff/components/EmployeeProfileModal";
import { useListState } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Employee, EmployeeListFilter } from "@/types/employee";
import type { EmployeeStatus } from "@/types/enums";

const TABS: { key: EmployeeListFilter; label: string }[] = [
  { key: "all", label: "All Staff" },
  { key: "active", label: "Current Staff" },
  { key: "archive", label: "Archive" },
];

/** Left-edge status markers from the original employee.css. */
const STATUS_MARKER: Record<EmployeeStatus, string> = {
  ACTIVE: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-success",
  INACTIVE: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-secondary-grey",
  TERMINATED: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-accent",
  ON_LEAVE: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-info",
};

function parseFilter(value: string | null): EmployeeListFilter {
  return value === "all" || value === "archive" ? value : "active";
}

/** Employee Management — Current Staff / Archive list, add/edit, profile, terminate. */
export function StaffPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canCreate = useCan("employee:create");
  const canUpdate = useCan("employee:update");
  const canTerminate = useCan("employee:terminate");
  const writable = branch !== null;

  const filter = parseFilter(params.get("filter"));
  const list = useListState();
  const { setPage } = list;
  useEffect(() => setPage(1), [filter, branch, setPage]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);

  // Sidebar "Add Staff" → /staff?action=add
  useEffect(() => {
    if (params.get("action") === "add" && canCreate && writable) {
      setEditing(null);
      setFormOpen(true);
    }
  }, [params, canCreate, writable]);

  const query = { ...list.query, status: filter };
  const employees = useQuery({
    queryKey: staffKeys.list(branch, query),
    queryFn: () => staffApi.list(query),
    placeholderData: keepPreviousData,
  });

  const terminate = useMutation({
    mutationFn: (id: string) => staffApi.terminate(id),
    onSuccess: async (res) => {
      notify.success(res.message);
      setViewing(null);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
    },
    onError: notify.error,
  });

  const onTerminate = async (e: Employee) => {
    if (await confirm(`Are you sure you want to terminate ${e.name}? This action cannot be undone.`)) {
      terminate.mutate(e.id);
    }
  };

  const setFilter = (key: EmployeeListFilter) => {
    const next = new URLSearchParams(params);
    next.set("filter", key);
    next.delete("action");
    setParams(next);
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    if (params.get("action")) {
      const next = new URLSearchParams(params);
      next.delete("action");
      setParams(next, { replace: true });
    }
  };

  const columns: ColumnDef<Employee, unknown>[] = [
    { header: "Emp ID", accessorKey: "employee_code", meta: { width: "120px" } },
    {
      header: "Name", accessorKey: "name",
      cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
    },
    { header: "Phone", accessorKey: "phone", meta: { width: "130px" } },
    { header: "Role", accessorKey: "role", meta: { width: "130px" }, cell: ({ row }) => humanize(row.original.role) },
    {
      header: "Status", accessorKey: "status", meta: { width: "120px" },
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    {
      header: "Joined", accessorKey: "date_of_joining", meta: { width: "120px" },
      cell: ({ row }) => formatDate(row.original.date_of_joining),
    },
    {
      id: "actions", header: "Actions", meta: { width: "190px" },
      cell: ({ row }) => {
        const e = row.original;
        const active = e.status !== "TERMINATED";
        return (
          <ActionGroup>
            <ActionIcon kind="view" title="View Profile" onClick={() => setViewing(e)} />
            {canUpdate && writable && active && (
              <ActionIcon kind="edit" onClick={() => { setEditing(e); setFormOpen(true); }} />
            )}
            {canTerminate && writable && active && (
              <button type="button" className="btn-status-action btn-red" onClick={() => onTerminate(e)}>Terminate</button>
            )}
          </ActionGroup>
        );
      },
    },
  ];

  const page = employees.data?.data;

  return (
    <div>
      <PageHeader
        title="Employee Management"
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search staff..." }}
        actions={
          <>
            <div className="order-first flex rounded-[10px] bg-hover p-1">
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => setFilter(t.key)}
                  className={cn(
                    "rounded-lg border-none bg-transparent px-4 py-2 text-[13px] font-bold text-muted transition-all",
                    filter === t.key && "bg-surface text-accent shadow-[0_2px_8px_rgba(0,0,0,0.05)]",
                  )}>
                  {t.label}
                </button>
              ))}
            </div>
            {canCreate && writable && (
              <Button onClick={openAdd} icon={<Icon name="plus" />}>Add Employee</Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        data={page?.items ?? []}
        loading={employees.isLoading}
        emptyMessage={employees.isLoading ? "Loading staff..." : "No employees found."}
        rowClassName={(e) => STATUS_MARKER[e.status]}
        getRowId={(e) => e.id}
        maxHeightClass="max-h-[calc(100vh-280px)]"
        pagination={{
          page: list.page,
          pageSize: list.pageSize,
          total: page?.total ?? 0,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
        }}
      />

      <EmployeeFormModal open={formOpen} employee={editing} onClose={closeForm} />
      <EmployeeProfileModal employee={viewing} onClose={() => setViewing(null)} onTerminate={onTerminate} />
    </div>
  );
}
