import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { subscriptionApi, subscriptionKeys } from "@/features/subscriptions/api";
import { PAYMENT_MODE_LABEL } from "@/features/subscriptions/lib/billing";
import { formatDate, formatINR } from "@/lib/format";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { SubscriptionDetail } from "@/types/subscription";

const SECTION_TAG = "mb-3 mt-0 text-[11px] font-extrabold uppercase tracking-[1px] text-muted";

function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      <span className={className ?? "text-sm font-semibold text-ink"}>{children}</span>
    </div>
  );
}

interface SubscriptionViewModalProps {
  subscriptionId: string;
  onClose: () => void;
  onCompletePayment: (detail: SubscriptionDetail) => void;
}

/** "Subscription Details": member, plans billed together, payment status; "Complete Payment" when unpaid. */
export function SubscriptionViewModal({ subscriptionId, onClose, onCompletePayment }: SubscriptionViewModalProps) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canPay = useCan("payment:create");
  const detail = useQuery({
    queryKey: subscriptionKeys.detail(branch, subscriptionId),
    queryFn: () => subscriptionApi.detail(subscriptionId),
  });
  const d = detail.data?.data;
  const grid = "grid grid-cols-1 gap-[15px] md:grid-cols-3";

  return (
    <Modal open title="Subscription Details" onClose={onClose}>
      {detail.isLoading && <p className="m-0 p-6 text-center text-sm text-muted">Loading subscription…</p>}
      {detail.isError && <p className="m-0 p-6 text-center text-sm text-accent">{detail.error.message}</p>}
      {d && (
        <div>
          <section>
            <h4 className={SECTION_TAG}>Member</h4>
            <div className={grid}>
              <Detail label="Name">{d.member.name}</Detail>
              <Detail label="Reg ID">{d.member.registration_id}</Detail>
              <Detail label="Phone">{d.member.phone}</Detail>
            </div>
          </section>

          <section className="mt-5">
            <h4 className={SECTION_TAG}>Plans</h4>
            <div className="overflow-hidden rounded-lg border border-line-light">
              {d.plans.map((p) => (
                <div key={p.subscription_id} className="flex justify-between gap-4 border-b border-line-light px-[15px] py-2.5 text-[13px] last:border-b-0">
                  <span>
                    {p.plan_name}
                    <span className="ml-2 text-xs text-muted">{formatDate(p.start_date)} → {formatDate(p.end_date)}</span>
                  </span>
                  <span className="font-bold">{formatINR(p.price)}</span>
                </div>
              ))}
              {d.plans.length > 1 && (
                <div className="flex justify-between border-t border-line bg-subtle px-[15px] py-2.5 text-[13px]">
                  <span>Total Value</span>
                  <span className="font-bold text-accent">
                    {formatINR(d.payment?.amount ?? d.plans.reduce((s, p) => s + p.price, 0))}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="mt-5">
            <h4 className={SECTION_TAG}>Payment Status</h4>
            <div className={grid}>
              <Detail label="Paid">{formatINR(d.payment?.paid_amount ?? 0)}</Detail>
              <Detail label="Balance" className="text-sm font-semibold text-accent">
                {formatINR(d.payment?.balance_amount ?? 0)}
              </Detail>
              <Detail label="Mode">{d.payment ? PAYMENT_MODE_LABEL[d.payment.payment_mode] : "N/A"}</Detail>
              {d.payment && <Detail label="Receipt">{d.payment.receipt_no}</Detail>}
              {d.payment && d.payment.discount_amount > 0 && (
                <Detail label="Discount">{formatINR(d.payment.discount_amount)}</Detail>
              )}
              {d.payment?.balance_due_date && <Detail label="Balance Due">{formatDate(d.payment.balance_due_date)}</Detail>}
              {!d.payment && <Detail label="Status"><StatusBadge value={d.payment_status} /></Detail>}
            </div>
          </section>

          <div className="form-actions-modern">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {d.payment_status === "PENDING" && canPay && (
              <Button onClick={() => onCompletePayment(d)}>Complete Payment</Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
