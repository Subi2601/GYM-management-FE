import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { membershipApi, membershipKeys } from "@/features/memberships/api";
import { PAYMENT_MODE_LABEL } from "@/features/subscriptions/lib/billing";
import { useDebouncedValue } from "@/hooks/use-list-state";
import { formatDate, formatINR } from "@/lib/format";
import { useBranchStore } from "@/stores/branch-store";

const PAGE_SIZE = 20;

/** Money paid back on cancelled memberships (RF-0001 …), newest first. Bank numbers are masked without PII access. */
export function RefundsDrawer({ onClose }: { onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const term = useDebouncedValue(search.trim(), 300);
  const query = { page, page_size: PAGE_SIZE, search: term || undefined };
  const refunds = useQuery({
    queryKey: membershipKeys.refunds(branch, query),
    queryFn: async () => (await membershipApi.refunds(query)).data,
    placeholderData: keepPreviousData,
  });
  const data = refunds.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Drawer open width="620px" title="Refunds" subtitle="Paid back when memberships were cancelled" onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-3">
        <Input placeholder="Search member, phone, reg ID or RF-…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search refunds" />
        {refunds.isLoading ? <p className="m-0 text-sm text-muted">Loading…</p>
          : !data?.items.length ? <p className="m-0 text-sm text-muted">No refunds{term ? " match this search" : " yet"}.</p>
            : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.items.map((r) => (
                  <li key={r.id} className="rounded-xl border border-line px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-ink">{r.member_name} <span className="font-normal text-muted">· {r.registration_id}</span></div>
                        <div className="text-xs text-muted">{r.refund_no} · {formatDate(r.refund_date)} · {r.plan_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-danger">− {formatINR(r.amount)}</div>
                        <div className="text-xs text-muted">{PAYMENT_MODE_LABEL[r.refund_mode]}</div>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-secondary-grey">
                      Paid {formatINR(r.paid_amount)} · kept {formatINR(r.deduction_amount)} · {r.reason}
                    </div>
                    {(r.account_number || r.upi_id || r.reference) && (
                      <div className="mt-1 text-xs text-muted">
                        {r.account_number && <>{r.account_holder} · A/c {r.account_number} · {r.ifsc}{r.bank_name ? ` · ${r.bank_name}` : ""}</>}
                        {r.upi_id && <>UPI {r.upi_id}</>}
                        {r.reference && <> · Ref {r.reference}</>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
        {pages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
