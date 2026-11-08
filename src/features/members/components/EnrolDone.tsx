import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { sendInvoiceOnWhatsApp, useInvoice } from "@/features/payments/api";
import { useInvoicePdf } from "@/features/payments/lib/invoice-pdf";
import { InvoiceSheet } from "@/features/payments/pages/InvoicePage";
import { openInvoice } from "@/features/subscriptions/api";
import { formatDate, formatINR } from "@/lib/format";

interface Props {
  paymentId: string;
  /** New member → "Welcome / thanks for joining" message; renewal → a plain thank-you. */
  welcome: boolean;
  onAddAnother: () => void;
  onClose: () => void;
}

/**
 * After the payment is saved: one click sends the thank-you message with the invoice PDF on WhatsApp
 * (the PDF is built here from the invoice sheet, off-screen), or print it.
 */
export function EnrolDone({ paymentId, welcome, onAddAnother, onClose }: Props) {
  const invoice = useInvoice(paymentId);
  const data = invoice.data;
  const sheetRef = useRef<HTMLDivElement>(null);
  const { pdf, failed } = useInvoicePdf(data, sheetRef);
  const [sentHint, setSentHint] = useState<string | null>(null);
  if (invoice.isLoading) return <PageLoader />;

  const send = async () => {
    if (!data || !pdf) return;
    const how = await sendInvoiceOnWhatsApp(data, welcome, pdf);
    setSentHint(how === "downloaded"
      ? `${pdf.name} is downloaded and ${data.member.name}'s chat is open. Attach the PDF (📎) and press Send.`
      : "Pick WhatsApp and the member in the share sheet, then press Send.");
  };

  return (
    <div className="mx-auto w-full max-w-[560px] rounded-2xl border border-line bg-surface p-7 text-center shadow-premium">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
        <Icon name="check" className="h-8 w-8" strokeWidth={3} />
      </span>
      <h2 className="m-0 mt-4 text-xl font-extrabold text-ink">
        {data ? `${data.member.name} is all set` : "Payment saved"}
      </h2>
      {data && (
        <p className="m-0 mt-1 text-sm text-muted">
          {data.member.registration_id} · Receipt {data.receipt_no} · {formatDate(data.payment_date)}
        </p>
      )}

      {data && (
        <div className="mt-5 rounded-xl border border-line bg-subtle p-4 text-left text-[13px]">
          {data.lines.map((l) => (
            <div key={`${l.plan_name}-${l.start_date}`} className="flex justify-between gap-3 py-1">
              <span className="text-secondary-grey">{l.plan_name}
                {l.end_date && <span className="text-muted"> · till {formatDate(l.end_date)}</span>}</span>
              <span className="font-semibold text-ink">{formatINR(l.price)}</span>
            </div>
          ))}
          {data.credit_amount > 0 && (
            <div className="flex justify-between gap-3 py-1 text-success">
              <span>{data.credit_label ?? "Credit from previous plan"}</span><span>- {formatINR(data.credit_amount)}</span>
            </div>
          )}
          {data.discount_amount > 0 && (
            <div className="flex justify-between gap-3 py-1 text-success">
              <span>{data.discount_reason ?? "Discount"}</span><span>- {formatINR(data.discount_amount)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2 font-bold text-ink">
            <span>Paid ({data.payment_mode.replace("_", " ").toLowerCase()})</span><span>{formatINR(data.paid_amount)}</span>
          </div>
          {data.balance_amount > 0 && (
            <div className="flex justify-between gap-3 py-1 font-semibold text-danger">
              <span>Balance{data.balance_due_date ? ` · due ${formatDate(data.balance_due_date)}` : ""}</span>
              <span>{formatINR(data.balance_amount)}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2.5">
        <button type="button" disabled={!pdf} onClick={() => void send()}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-success px-5 py-3 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
          <Icon name="whatsapp" className="h-5 w-5" />
          {pdf ? `Send ${welcome ? "welcome + invoice PDF" : "invoice PDF"} on WhatsApp`
            : failed ? "Couldn't prepare the PDF" : "Preparing invoice PDF…"}
        </button>
        <p className="m-0 text-xs text-muted">
          {sentHint ?? (failed ? "Use Print invoice → Save as PDF, then share it."
            : `The PDF and a thank-you message go to ${data?.member.phone ?? "the member"}.`)}
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Button variant="secondary" icon={<Icon name="print" className="h-4 w-4" />} onClick={() => openInvoice(paymentId)}>
            Print invoice
          </Button>
          <Button variant="secondary" icon={<Icon name="plus" className="h-4 w-4" />} onClick={onAddAnother}>
            {welcome ? "Add another" : "New member"}
          </Button>
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>

      {/* The invoice sheet the PDF is made from — rendered off-screen at A4 width. */}
      {data && (
        <div aria-hidden className="theme-light pointer-events-none fixed left-[-10000px] top-0 w-[210mm]">
          <div ref={sheetRef}><InvoiceSheet data={data} /></div>
        </div>
      )}
    </div>
  );
}
