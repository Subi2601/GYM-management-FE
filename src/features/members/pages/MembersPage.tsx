import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { DateRangeFilter, FilterSelect, FilterTabs, ListToolbar, type ActiveFilter } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePlanLookup } from "@/features/lookups/api";
import { MEMBER_FILTERS, memberApi, memberKeys, useInvalidateMembers, type MemberFilter,
  type MemberListQuery, type MemberSortKey } from "@/features/members/api";
import { AddonServiceDrawer } from "@/features/members/components/AddonServiceDrawer";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { GENDERS, type Gender } from "@/types/enums";
import type { Member } from "@/types/member";

const TAB_LABEL: Record<MemberFilter, string> = {
  all: "All members",
  active: "Active",
  expiring: "Expiring soon",
  inactive: "Expired / inactive",
};

const sortKey = (key: MemberSortKey) => key;

/** Members directory — status tabs with counts, search + plan / gender / joined filters, sortable server-paginated table. */
export function MembersPage() {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const navigate = useNavigate();
  const [tab, setTab] = useUrlEnum("tab", MEMBER_FILTERS, "all");
  const list = useListState();
  const [planId, setPlanId] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [joined, setJoined] = useState({ from: "", to: "" });
  const [addonFor, setAddonFor] = useState<Member | null>(null);

  const canCreate = useCan("member:create");
  const canUpdate = useCan("member:update");
  const canDelete = useCan("member:delete");
  const canEnroll = useCan("subscription:create");
  const invalidate = useInvalidateMembers();

  const { setPage } = list;
  // Tab / filter changes restart from page 1.
  useEffect(() => setPage(1), [tab, planId, gender, joined, setPage]);

  // Dashboard quick link /members?action=add opens the registration page.
  useAddAction(useCallback(() => navigate("/members/new"), [navigate]), canCreate);

  const query: MemberListQuery = {
    ...list.query, filter: tab, plan_id: planId || undefined, gender,
    joined_from: joined.from || undefined, joined_to: joined.to || undefined,
  };
  const members = useQuery({
    queryKey: memberKeys.list(branch, query),
    queryFn: () => memberApi.list(query),
    placeholderData: keepPreviousData,
  });

  const counts = useQuery({ queryKey: memberKeys.counts(branch), queryFn: async () => (await memberApi.counts()).data });

  // The filter is on the member's latest membership: regular and customized membership plans, not add-ons.
  const plansLookup = usePlanLookup();
  const planOptions = (plansLookup.data ?? []).filter((p) => p.type !== "ADD_ON").map((p) => ({ value: p.id, label: p.name }));

  const remove = useMutation({
    mutationFn: memberApi.remove,
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Member, unknown>[]>(() => [
    { accessorKey: "registration_id", header: "Reg ID", meta: { width: "110px", sortKey: sortKey("registration_id") },
      cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-secondary-grey">{row.original.registration_id}</span> },
    { accessorKey: "name", header: "Member", meta: { sortKey: sortKey("name") },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.name}</div>
          <div className="text-xs text-muted">{row.original.phone}</div>
        </div>
      ) },
    { id: "plan", header: "Plan", meta: { width: "170px" },
      cell: ({ row }) => row.original.current_plan_name ?? <span className="text-muted">No plan</span> },
    { accessorKey: "joining_date", header: "Joined", meta: { width: "120px", sortKey: sortKey("joining_date") },
      cell: ({ row }) => formatDate(row.original.joining_date) },
    { accessorKey: "expiry_date", header: "Expiry", meta: { width: "120px", sortKey: sortKey("expiry_date") },
      cell: ({ row }) => {
        const m = row.original;
        return (
          <span className={cn("whitespace-nowrap font-semibold",
            m.membership_state === "EXPIRED" ? "text-danger" : m.membership_state === "EXPIRING" ? "text-warning" : "text-ink")}>
            {m.expiry_date ? formatDate(m.expiry_date) : "—"}
          </span>
        );
      } },
    { accessorKey: "membership_state", header: "Status", meta: { width: "120px" },
      cell: ({ row }) => <StatusBadge value={row.original.membership_state} /> },
    {
      id: "actions", header: "", meta: { width: "210px" },
      cell: ({ row }) => {
        const m = row.original;
        return (
          <ActionGroup>
            {canEnroll && (
              <button type="button" className="btn-status-action btn-grey" onClick={() => setAddonFor(m)}>
                Add service
              </button>
            )}
            <ActionIcon kind="view" onClick={() => navigate(`/members/${m.id}`)} />
            {canUpdate && <ActionIcon kind="edit" onClick={() => navigate(`/members/${m.id}/edit`)} />}
            {canDelete && (
              <ActionIcon kind="delete" onClick={async () => {
                if (await confirm(`Delete ${m.name}?`)) remove.mutate(m.id);
              }} />
            )}
          </ActionGroup>
        );
      },
    },
  ], [canEnroll, canUpdate, canDelete, remove, navigate]);

  const active: ActiveFilter[] = [];
  if (planId) active.push({ label: `Plan: ${planOptions.find((p) => p.value === planId)?.label ?? "…"}`, onRemove: () => setPlanId("") });
  if (gender) active.push({ label: `Gender: ${humanize(gender)}`, onRemove: () => setGender("") });
  if (joined.from || joined.to) {
    active.push({
      label: `Joined: ${joined.from ? formatDate(joined.from) : "…"} – ${joined.to ? formatDate(joined.to) : "…"}`,
      onRemove: () => setJoined({ from: "", to: "" }),
    });
  }

  const data = members.data?.data;
  const filtered = !!list.debouncedSearch || active.length > 0;

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Member profiles, memberships and add-on services"
        actions={canCreate && (
          <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => navigate("/members/new")}>
            Add member
          </Button>
        )}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={members.isLoading}
        fetching={members.isFetching}
        getRowId={(m) => m.id}
        onRowClick={(m) => navigate(`/members/${m.id}`)}
        rowClassName={(m) =>
          m.membership_state === "EXPIRED" ? ROW_MARKER.expired
            : m.membership_state === "EXPIRING" ? ROW_MARKER.nearExpiry : undefined}
        emptyIcon="users"
        emptyMessage={filtered ? "No members match these filters" : "No members yet"}
        emptyHint={filtered ? "Try a different search or clear the filters." : canCreate ? "Add your first member to get started." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={MEMBER_FILTERS.map((f) => ({ value: f, label: TAB_LABEL[f], count: counts.data?.[f] }))} />
            <ListToolbar
              search={{ value: list.search, onChange: list.setSearch, placeholder: "Search name, phone or reg ID" }}
              filters={
                <>
                  <FilterSelect placeholder="All plans" ariaLabel="Plan" value={planId} onChange={setPlanId} options={planOptions} />
                  <FilterSelect placeholder="Any gender" ariaLabel="Gender" value={gender} className="min-w-[130px]"
                    onChange={(v) => setGender(v as Gender | "")}
                    options={GENDERS.map((g) => ({ value: g, label: humanize(g) }))} />
                  <DateRangeFilter label="Joined" from={joined.from} to={joined.to} onChange={(from, to) => setJoined({ from, to })} />
                </>
              }
              active={active}
            />
          </>
        }
      />

      {addonFor && <AddonServiceDrawer member={addonFor} onClose={() => setAddonFor(null)} />}
    </div>
  );
}
