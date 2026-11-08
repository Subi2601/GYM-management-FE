import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ActionGroup, ActionIcon, DataTable, ROW_MARKER } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { FilterTabs, ListToolbar } from "@/components/ui/ListToolbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatPercent, offerApi, useInvalidateOffers, useOfferCounts, useOffers } from "@/features/offers/api";
import { OfferFormModal } from "@/features/offers/components/OfferFormModal";
import { usePlanCategories } from "@/features/plans/api";
import { paginationProps, useAddAction, useListState, useUrlEnum } from "@/hooks/use-list-state";
import { useWriteAccess } from "@/hooks/use-write-access";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { OFFER_TABS, type Offer } from "@/types/offer";

const TAB_LABEL = { active: "Active", inactive: "Inactive", all: "All offers" } as const;

function validity(o: Offer): string {
  if (!o.valid_from && !o.valid_to) return "Always";
  if (!o.valid_to) return `From ${formatDate(o.valid_from)}`;
  if (!o.valid_from) return `Till ${formatDate(o.valid_to)}`;
  return `${formatDate(o.valid_from)} – ${formatDate(o.valid_to)}`;
}

/** Offers master — festival / referral discounts (%), switched on and off by the admin. */
export function OffersPage() {
  const [tab, setTab] = useUrlEnum("tab", OFFER_TABS, "active");
  const list = useListState({ sortDir: "asc" });
  const write = useWriteAccess("offer:manage");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);

  const { setPage } = list;
  useEffect(() => setPage(1), [tab, setPage]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);
  useAddAction(openAdd, write.allowed);

  const offers = useOffers({ ...list.query, tab });
  const counts = useOfferCounts();
  const invalidate = useInvalidateOffers();
  const categories = usePlanCategories();
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data]);

  const toggle = useMutation({
    mutationFn: (o: Offer) => offerApi.setStatus(o.id, !o.is_active),
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
    },
    onError: notify.error,
  });

  const columns = useMemo<ColumnDef<Offer, unknown>[]>(() => [
    { accessorKey: "name", header: "Offer", meta: { sortKey: "name" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{row.original.name}</div>
          {row.original.description && <div className="truncate text-xs text-muted">{row.original.description}</div>}
        </div>
      ) },
    { accessorKey: "discount_percent", header: "Gives", meta: { width: "180px", sortKey: "discount_percent" },
      cell: ({ row }) => {
        const o = row.original;
        const extras = o.summary.split(" · ").filter((p) => !p.endsWith("% off"));
        return (
          <div className="min-w-0">
            {o.discount_percent > 0 && <span className="font-display text-xl text-accent">{formatPercent(o.discount_percent)}</span>}
            {extras.length > 0 && <div className="text-xs font-semibold text-success">{extras.join(" · ")}</div>}
          </div>
        );
      } },
    { id: "applies", header: "Applies to", meta: { width: "220px" },
      cell: ({ row }) => {
        const ids = row.original.category_ids;
        if (ids.length === 0) return <span className="text-muted">All plans</span>;
        const names = ids.map((id) => categoryName.get(id) ?? "…");
        return <span className="line-clamp-2 text-[13px]" title={names.join(", ")}>{names.join(", ")}</span>;
      } },
    { id: "validity", header: "Valid", meta: { width: "200px", sortKey: "valid_to" },
      cell: ({ row }) => <span className="whitespace-nowrap">{validity(row.original)}</span> },
    { id: "status", header: "Status", meta: { width: "150px" },
      cell: ({ row }) => {
        const o = row.original;
        if (!o.is_active) return <StatusBadge value="INACTIVE" />;
        return o.available ? <StatusBadge value="ACTIVE" label="Live" />
          : <StatusBadge value="SCHEDULED" tone="amber" label="Not in dates" />;
      } },
    {
      id: "actions", header: "Actions", meta: { width: "200px" },
      cell: ({ row }) => {
        const o = row.original;
        if (!write.show) return null;
        return (
          <ActionGroup>
            <span title={write.reason}>
              <Button variant="secondary" className="h-8 px-3 py-0 text-xs" disabled={write.disabled || toggle.isPending}
                loading={toggle.isPending && toggle.variables?.id === o.id} onClick={() => toggle.mutate(o)}>
                {o.is_active ? "Deactivate" : "Activate"}
              </Button>
            </span>
            {write.allowed && <ActionIcon kind="edit" onClick={() => { setEditing(o); setFormOpen(true); }} />}
          </ActionGroup>
        );
      },
    },
  ], [write, toggle, categoryName]);

  const data = offers.data;
  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="Festival and special discounts staff pick while billing"
        actions={write.show && (
          <span title={write.reason}>
            <Button icon={<Icon name="plus" className="h-4 w-4" />} disabled={write.disabled} onClick={openAdd}>
              Add offer
            </Button>
          </span>
        )}
      />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={offers.isLoading}
        fetching={offers.isFetching}
        getRowId={(o) => o.id}
        rowClassName={(o) => (o.available ? ROW_MARKER.joined : undefined)}
        emptyIcon="flame"
        emptyMessage={offers.isError ? offers.error.message
          : list.debouncedSearch ? "No offers match this search" : tab === "inactive" ? "No inactive offers" : "No offers yet"}
        emptyHint={!offers.isError && !list.debouncedSearch && tab !== "inactive" && write.allowed
          ? "Add Diwali, Pongal, New Year or referral offers for the desk to apply." : undefined}
        sorting={list.sorting}
        pagination={paginationProps(list, data?.total)}
        toolbar={
          <>
            <FilterTabs value={tab} onChange={setTab}
              tabs={OFFER_TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts.data?.[t] }))} />
            <ListToolbar search={{ value: list.search, onChange: list.setSearch, placeholder: "Search offers" }} />
          </>
        }
      />
      <OfferFormModal open={formOpen} offer={editing} onClose={() => { setFormOpen(false); setEditing(null); }} />
    </div>
  );
}
