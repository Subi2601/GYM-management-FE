import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePlanLookup } from "@/features/lookups/api";
import { MEMBER_FILTERS, memberApi, memberKeys, useInvalidateMembers, type MemberFilter,
  type MemberListQuery } from "@/features/members/api";
import { AddonServiceModal } from "@/features/members/components/AddonServiceModal";
import { MemberWizardModal } from "@/features/members/components/MemberWizardModal";
import { useListState } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Member } from "@/types/member";

type WizardState = { member: Member | null; readOnly: boolean } | null;

const STAT_CARDS: { filter: MemberFilter; label: string; activeClass: string }[] = [
  { filter: "all", label: "Total Members", activeClass: "border-primary-grey bg-subtle" },
  { filter: "active", label: "Active", activeClass: "border-success bg-success-soft" },
  { filter: "expiring", label: "Expiring Soon", activeClass: "border-warning bg-warning-soft" },
  { filter: "inactive", label: "Expired / Inactive", activeClass: "border-danger bg-danger-soft" },
];

function isFilter(value: string | null): value is MemberFilter {
  return value !== null && (MEMBER_FILTERS as readonly string[]).includes(value);
}

/** Members Directory — stats, plan filter, server-paginated list, 3-step wizard, add-on service. */
export function MembersPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [searchParams, setSearchParams] = useSearchParams();
  const list = useListState();
  const [planId, setPlanId] = useState("");
  const [wizard, setWizard] = useState<WizardState>(null);
  const [addonFor, setAddonFor] = useState<Member | null>(null);

  const canCreate = useCan("member:create");
  const canUpdate = useCan("member:update");
  const canDelete = useCan("member:delete");
  const canEnroll = useCan("subscription:create");
  const invalidate = useInvalidateMembers();

  const rawFilter = searchParams.get("filter");
  const filter: MemberFilter = isFilter(rawFilter) ? rawFilter : "all";
  const { setPage } = list;

  const setFilter = (next: MemberFilter) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("filter", next);
      return params;
    });
  };

  // Filter changes (sidebar links, stat cards, plan select) restart from page 1.
  useEffect(() => setPage(1), [filter, planId, setPage]);

  // "Add Member" sidebar link → /members?action=add opens the wizard, then the param is cleared.
  useEffect(() => {
    if (searchParams.get("action") !== "add") return;
    if (canCreate) setWizard({ member: null, readOnly: false });
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("action");
      return params;
    }, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

  const query: MemberListQuery = { ...list.query, filter, plan_id: planId || undefined };
  const members = useQuery({
    queryKey: memberKeys.list(branch, query),
    queryFn: () => memberApi.list(query),
    placeholderData: keepPreviousData,
  });

  const counts = useQuery({ queryKey: memberKeys.counts(branch), queryFn: memberApi.counts });
  const expiringTotal = useQuery({
    queryKey: memberKeys.filterTotal(branch, "expiring"),
    queryFn: () => memberApi.filterTotal("expiring"),
  });
  const inactiveTotal = useQuery({
    queryKey: memberKeys.filterTotal(branch, "inactive"),
    queryFn: () => memberApi.filterTotal("inactive"),
  });
  const statValue: Record<MemberFilter, number | undefined> = {
    all: counts.data?.data.total,
    active: counts.data?.data.active,
    expiring: expiringTotal.data,
    inactive: inactiveTotal.data,
  };

  const membershipPlans = usePlanLookup("MEMBERSHIP");

  const remove = useMutation({
    mutationFn: memberApi.remove,
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Member, unknown>[]>(() => {
    const cols: ColumnDef<Member, unknown>[] = [
      { accessorKey: "registration_id", header: "Reg ID", meta: { width: "100px" } },
      { accessorKey: "name", header: "Full Name", meta: { width: "200px" },
        cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
      { accessorKey: "phone", header: "Phone", meta: { width: "130px" } },
      { accessorKey: "expiry_date", header: "Expiry", meta: { width: "130px" },
        cell: ({ row }) => {
          const m = row.original;
          return (
            <span className={cn("whitespace-nowrap rounded-[20px] px-2.5 py-1 text-xs font-bold",
              m.membership_state === "EXPIRED" ? "bg-danger-soft text-danger"
                : m.membership_state === "EXPIRING" ? "bg-warning-soft text-warning" : "bg-hover text-ink")}
              title={m.current_plan_name ?? undefined}>
              {m.expiry_date ? formatDate(m.expiry_date) : "No Plan"}
            </span>
          );
        } },
    ];
    if (canEnroll) {
      cols.push({
        id: "services", header: "Services", meta: { width: "150px" },
        cell: ({ row }) => (
          <button type="button" onClick={() => setAddonFor(row.original)}
            className="cursor-pointer rounded-lg border-[1.5px] border-info-line bg-info-soft px-3 py-1.5 text-[11px] font-bold text-info transition-all hover:border-info hover:bg-info hover:text-white">
            Add Service
          </button>
        ),
      });
    }
    cols.push({
      id: "actions", header: "Actions", meta: { width: "150px" },
      cell: ({ row }) => (
        <ActionGroup>
          <ActionIcon kind="view" onClick={() => setWizard({ member: row.original, readOnly: !canUpdate })} />
          {canUpdate && <ActionIcon kind="edit" onClick={() => setWizard({ member: row.original, readOnly: false })} />}
          {canDelete && (
            <ActionIcon kind="delete" onClick={async () => {
              if (await confirm(`Delete ${row.original.name}?`)) remove.mutate(row.original.id);
            }} />
          )}
        </ActionGroup>
      ),
    });
    return cols;
  }, [canEnroll, canUpdate, canDelete, remove]);

  const data = members.data?.data;

  return (
    <div>
      <PageHeader
        title="Members Directory"
        subtitle="Manage member profiles, subscriptions, and billing"
        search={{ value: list.search, onChange: list.setSearch, placeholder: "Search by name or phone..." }}
        actions={canCreate && (
          <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setWizard({ member: null, readOnly: false })}>
            Add New Member
          </Button>
        )}
      />

      {/* Stats bar — each card is also the filter */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <button key={card.filter} type="button" onClick={() => setFilter(card.filter)}
            className={cn(
              "flex cursor-pointer flex-col rounded-xl border-[1.5px] bg-surface px-5 py-4 text-left transition-all duration-200",
              "hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]",
              filter === card.filter ? card.activeClass : "border-line",
            )}>
            <span className="mb-1 text-xs font-bold uppercase text-muted">{card.label}</span>
            <span className="text-2xl font-extrabold text-ink">{statValue[card.filter] ?? "—"}</span>
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="mb-3 mt-8 flex items-end gap-6 px-1">
        <div className="flex flex-col gap-3">
          <label htmlFor="plan-filter" className="ml-0.5 text-[11px] font-extrabold uppercase leading-none tracking-[0.08em] text-muted">
            Filter by Plan
          </label>
          <select id="plan-filter" value={planId} onChange={(e) => setPlanId(e.target.value)}
            className="min-w-[200px] cursor-pointer rounded-[10px] border-[1.5px] border-line bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink transition-all focus:border-primary-grey focus:outline-none">
            <option value="">All Plans</option>
            {(membershipPlans.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          loading={members.isLoading}
          emptyMessage="No members found matching your criteria."
          maxHeightClass="max-h-[calc(100vh-350px)]"
          getRowId={(m) => m.id}
          rowClassName={(m) =>
            m.membership_state === "EXPIRED" ? ROW_MARKER.expired
              : m.membership_state === "EXPIRING" ? ROW_MARKER.nearExpiry : undefined}
          pagination={{
            page: list.page, pageSize: list.pageSize, total: data?.total ?? 0,
            onPageChange: list.setPage, onPageSizeChange: list.setPageSize,
          }}
        />
      </div>

      {wizard && (
        <MemberWizardModal member={wizard.member} readOnly={wizard.readOnly} onClose={() => setWizard(null)} />
      )}
      {addonFor && <AddonServiceModal member={addonFor} onClose={() => setAddonFor(null)} />}
    </div>
  );
}
