import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { InfoRow, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { subscriptionApi, subscriptionKeys } from "@/features/subscriptions/api";
import { PAYMENT_MODE_LABEL } from "@/features/subscriptions/lib/billing";
import { formatDate, formatINR } from "@/lib/format";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { SubscriptionDetail } from "@/types/subscription";

const INFO_GRID = "grid grid-cols-2 gap-x-4 gap-y-4";

interface SubscriptionViewDrawerProps {
  subscriptionId: string;
  onClose: () => void;
  onCompletePayment: (detail: SubscriptionDetail) => void;
}

/** Subscription details: member, plans billed together, payment status; "Complete payment" when unpaid. */
export function SubscriptionViewDrawer({ subscriptionId, onClose, onCompletePayment }: SubscriptionViewDrawerProps) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canPay = useCan("payment:create");
  const detail = useQuery({
    queryKey: subscriptionKeys.detail(branch, subscriptionId),
    queryFn: () => subscriptionApi.detail(subscriptionId),
  });
  const d = detail.data?.data;

  return (
    <Drawer
      open
      title="Subscription details"
      subtitle={d ? `${d.member.name} · ${d.member.registration_id}` : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {d && d.payment_status === "PENDING" && canPay && (
            <Button onClick={() => onCompletePayment(d)}>Complete payment</Button>
          )}
        </>
      }
    >
      {detail.isLoading && <p className="m-0 p-6 text-center text-sm text-muted">Loading subscription…</p>}
      {detail.isError && <p className="m-0 p-6 text-center text-sm text-danger">{detail.error.message}</p>}
      {d && (
        <div className="flex flex-col gap-4">
          <Section title="Member">
            <div className={INFO_GRID}>
              <InfoRow label="Name" value={d.member.name} />
              <InfoRow label="Reg ID" value={d.member.registration_id} />
              <InfoRow label="Phone" value={d.member.phone} />
              <InfoRow label="Status" value={
                d.renewal_state === "EXPIRED" ? <StatusBadge value="EXPIRED" />
                  : d.renewal_state === "EXPIRING" ? <StatusBadge value="EXPIRING" label="Expiring soon" />
                    : <StatusBadge value={d.status} />
              } />
            </div>
          </Section>

          <Section title="Plans" description={d.plans.length > 1 ? "Billed together on one receipt" : undefined}>
            <div className="-my-1 flex flex-col">
              {d.plans.map((p) => (
                <div key={p.subscription_id} className="flex items-center justify-between gap-4 border-b border-line-light py-2.5 text-sm last:border-b-0">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{p.plan_name}</div>
                    <div className="text-xs text-muted">{formatDate(p.start_date)} – {formatDate(p.end_date)}</div>
                  </div>
                  <span className="font-semibold text-ink">{formatINR(p.price)}</span>
                </div>
              ))}
              {d.plans.length > 1 && (
                <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm">
                  <span className="font-semibold text-muted">Total value</span>
                  <span className="font-extrabold text-accent">
                    {formatINR(d.payment?.amount ?? d.plans.reduce((s, p) => s + p.price, 0))}
                  </span>
                </div>
              )}
            </div>
          </Section>

          <Section title="Payment" aside={<StatusBadge value={d.payment_status} />}>
            {d.payment ? (
              <div className={INFO_GRID}>
                <InfoRow label="Paid" value={formatINR(d.payment.paid_amount)} />
                <InfoRow label="Balance" value={
                  <span className={d.payment.balance_amount > 0 ? "text-danger" : undefined}>
                    {formatINR(d.payment.balance_amount)}
                  </span>
                } />
                <InfoRow label="Mode" value={PAYMENT_MODE_LABEL[d.payment.payment_mode]} />
                <InfoRow label="Receipt" value={d.payment.receipt_no} />
                {d.payment.discount_amount > 0 && <InfoRow label="Discount" value={formatINR(d.payment.discount_amount)} />}
                {d.payment.balance_due_date && <InfoRow label="Balance due" value={formatDate(d.payment.balance_due_date)} />}
              </div>
            ) : (
              <p className="m-0 text-sm text-muted">No payment recorded for this subscription yet.</p>
            )}
          </Section>
        </div>
      )}
    </Drawer>
  );
}
