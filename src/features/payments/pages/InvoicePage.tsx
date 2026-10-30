import { useEffect, useRef, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";
import { useInvoice } from "@/features/payments/api";
import { formatDate, formatINR } from "@/lib/format";
import { cn, humanize, openWhatsApp } from "@/lib/utils";
import type { Invoice } from "@/types/payment";

/** Business letterhead carried over from the original invoice (not stored in the backend). */
const LETTERHEAD = {
  studio: "LIFESTYLE & FITNESS STUDIO",
  contacts: ["Mob: 7598164812, 8428143133", "Mail: stagfitness2702@gmail.com"],
  gstin: "GSTIN: 33CLMPA7280H2Z2",
};

const BRAND = "text-[#8B0000]";

/** Printable receipt at /invoice/:paymentId — rendered without the app shell, auto-prints once loaded. */
export function InvoicePage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const invoice = useInvoice(paymentId);
  const printed = useRef(false);

  // Auto print after load, as the original did (once per page view).
  useEffect(() => {
    if (!invoice.data || printed.current) return;
    const id = window.setTimeout(() => {
      printed.current = true;
      window.print();
    }, 1000);
    return () => window.clearTimeout(id);
  }, [invoice.data]);

  useEffect(() => {
    if (invoice.data) document.title = `Invoice ${invoice.data.receipt_no}`;
  }, [invoice.data]);

  const data = invoice.data;

  const shareWhatsApp = () => {
    if (!data) return;
    const message = `Hello *${data.member.name}*,\n\nThank you for choosing *STAG FITNESS*! \n\nYour payment of *₹${data.paid_amount}* has been received successfully. \n\nYou can view and download your invoice here:\n${window.location.href}\n\nHave a great workout!`;
    openWhatsApp(data.member.phone, message);
  };

  return (
    <div className="theme-light flex min-h-screen flex-col items-center bg-[#f4f4f4] px-[15px] py-10 print:block print:min-h-0 print:bg-white print:p-0">
      {/* A4, no browser margins */}
      <style>{"@media print { @page { size: A4; margin: 0; } }"}</style>

      {invoice.isLoading && (
        <StatusCard>
          <div className="mx-auto mb-[15px] h-10 w-10 animate-spin rounded-full border-4 border-hover border-t-[#8B0000]" />
          <p className="m-0">Generating Invoice...</p>
        </StatusCard>
      )}

      {invoice.isError && (
        <StatusCard>
          <Icon name="alert" className="mx-auto mb-3 h-8 w-8 text-accent" />
          <p className="m-0 mb-4 font-semibold text-ink">{invoice.error.message}</p>
          <button type="button" onClick={() => invoice.refetch()}
            className="rounded-lg border border-line bg-white px-5 py-2 text-sm font-bold text-secondary-grey hover:border-secondary-grey hover:text-ink">
            Retry
          </button>
        </StatusCard>
      )}

      {data && (
        <>
          <div className="no-print mb-5 flex w-full max-w-[210mm] justify-end gap-[15px]">
            <button type="button" onClick={shareWhatsApp}
              className="flex items-center gap-2 rounded-[8pt] border-none bg-[#25D366] px-[20pt] py-[10pt] font-bold text-white shadow-[0_4px_10px_rgba(37,211,102,0.2)] transition-transform hover:-translate-y-0.5 hover:brightness-90">
              <Icon name="whatsapp" /> Share on WhatsApp
            </button>
            <button type="button" onClick={() => window.print()}
              className="flex items-center gap-2 rounded-[8pt] border-none bg-[#16a34a] px-[20pt] py-[10pt] font-bold text-white shadow-[0_4px_10px_rgba(22,163,74,0.2)] transition-transform hover:-translate-y-0.5 hover:brightness-90">
              <Icon name="print" /> Download / Print PDF
            </button>
          </div>
          <InvoiceSheet data={data} />
        </>
      )}
    </div>
  );
}

function StatusCard({ children }: { children: ReactNode }) {
  return (
    <div className="no-print mt-[50px] rounded-xl bg-white px-[50px] py-[30px] text-center text-muted shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      {children}
    </div>
  );
}

const money = (n: number) => formatINR(n);

function InvoiceSheet({ data }: { data: Invoice }) {
  const branchLine = [data.branch_name, data.branch_location].filter(Boolean).join(", ");
  const thCls = cn("border-b-[1.5pt] border-[#8B0000] bg-subtle p-[8pt] text-left text-[8.5pt] font-bold [print-color-adjust:exact] [-webkit-print-color-adjust:exact]", BRAND);
  const tdCls = "border-b border-line-light px-[8pt] py-[10pt] text-[9.5pt] text-[#334155]";

  return (
    <div className="relative mb-10 box-border flex min-h-[297mm] w-[210mm] flex-col bg-white p-[15mm] shadow-[0_0_15px_rgba(0,0,0,0.1)] max-[794px]:w-full max-[794px]:p-[10mm] print:m-0 print:w-full print:p-[12mm] print:shadow-none">
      {/* Corporate header */}
      <div className="mb-[8mm] flex items-start justify-between border-b-[1.5pt] border-[#8B0000] pb-[6mm] max-[794px]:flex-col max-[794px]:gap-[15px]">
        <div className="flex-1 text-left">
          <h1 className={cn("m-0 mb-[8pt] text-[24pt] font-extrabold uppercase leading-none tracking-[-0.5pt] max-[794px]:text-[20pt]", BRAND)}>
            {data.organization_name || "STAG FITNESS"}
          </h1>
          <div className="flex flex-col gap-[1pt]">
            <p className="m-0 text-[10.5pt] font-bold uppercase tracking-[0.5px] text-primary-grey">{LETTERHEAD.studio}</p>
            {branchLine && <p className="m-0 text-[9pt] leading-[1.3] text-secondary-grey">{branchLine}</p>}
            {LETTERHEAD.contacts.map((c) => (
              <p key={c} className="m-0 text-[9pt] leading-[1.3] text-secondary-grey">{c}</p>
            ))}
            <p className="m-0 mt-[4pt] text-[9pt] font-bold leading-[1.3] text-primary-grey">{LETTERHEAD.gstin}</p>
          </div>
        </div>

        <div className="flex flex-col items-end text-right max-[794px]:items-start max-[794px]:text-left">
          <div className={cn("mb-[8pt] text-[20pt] font-extrabold tracking-[2pt]", BRAND)}>INVOICE</div>
          <div className="flex w-fit flex-col gap-[4pt] rounded-[6pt] border-r-[3pt] border-[#8B0000] bg-subtle p-[8pt] [print-color-adjust:exact]">
            <Meta label="Invoice No:" value={`#${data.receipt_no}`} />
            <Meta label="Date:" value={formatDate(data.payment_date)} />
            <Meta label="Payment Mode:" value={humanize(data.payment_mode)} />
          </div>
        </div>
      </div>

      {/* Bill to */}
      <div className="mb-[10mm]">
        <div className={cn("mb-[6pt] border-b border-line-light pb-[3pt] text-[9pt] font-extrabold uppercase tracking-[1pt]", BRAND)}>
          BILL TO
        </div>
        <div className="text-[15pt] font-bold text-ink">{data.member.name}</div>
        <div className="text-[10pt] text-muted">Reg ID: {data.member.registration_id} | Phone: {data.member.phone}</div>
      </div>

      {/* Lines */}
      <table className="mb-[10mm] w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(thCls, "w-[30%]")}>DESCRIPTION</th>
            <th className={cn(thCls, "w-[15%]")}>DURATION</th>
            <th className={cn(thCls, "w-[15%]")}>SESSIONS</th>
            <th className={cn(thCls, "w-[13%] text-right")}>CGST</th>
            <th className={cn(thCls, "w-[13%] text-right")}>SGST</th>
            <th className={cn(thCls, "w-[14%] text-right")}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.plan_name}-${i}`}>
              <td className={tdCls}>
                <span className="font-bold text-ink">{line.plan_name}</span>
                <div className="mt-[2pt] text-[8.5pt] text-muted">
                  {formatDate(line.start_date)} to {formatDate(line.end_date)}
                </div>
              </td>
              <td className={tdCls}>{line.duration_days ? `${line.duration_days} Days` : "-"}</td>
              <td className={tdCls}>{line.total_sessions || "-"}</td>
              <td className={cn(tdCls, "text-right")}>{money(0)}</td>
              <td className={cn(tdCls, "text-right")}>{money(0)}</td>
              <td className={cn(tdCls, "text-right")}>{money(line.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="mb-[15mm] ml-auto flex w-[80mm] flex-col gap-[5pt] max-[794px]:w-full">
        <SummaryRow label="Subtotal" value={money(data.gross)} />
        <SummaryRow label="CGST (0%)" value={money(0)} />
        <SummaryRow label="SGST (0%)" value={money(0)} />
        {data.discount_amount > 0 && (
          <SummaryRow label={`Discount (${data.discount_reason || "Offer"})`}
            value={<span className="text-[#ef4444]">- {money(data.discount_amount)}</span>} />
        )}
        <SummaryRow label="Net Amount" value={money(data.net_amount)} variant="highlight" />
        <SummaryRow label="Amount Paid" value={money(data.paid_amount)} variant="paid" />
        {data.balance_amount > 0 && (
          <SummaryRow
            label={data.balance_due_date ? `Balance Due (by ${formatDate(data.balance_due_date)})` : "Balance Due"}
            value={money(data.balance_amount)} variant="balance" />
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pb-[5mm] text-center">
        <div className="mb-[10mm] flex justify-end">
          <div className="w-[70mm] text-center">
            <div className="h-[15mm]" />
            <div className="mb-[4pt] border-t border-primary-grey" />
            <p className="m-0 text-[9pt] font-semibold text-secondary-grey">Authorized Signatory</p>
            <p className="m-0 text-[9pt] font-bold uppercase text-primary-grey">For {data.organization_name || "STAG FITNESS"}</p>
          </div>
        </div>
        <div className="text-[10.5pt] font-bold tracking-[0.5pt] text-ink">THANK YOU FOR YOUR MEMBERSHIP!</div>
        <div className="mt-[4pt] text-[7.5pt] text-slate-400">This is a computer generated invoice.</div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-end gap-[8pt] text-[9pt]">
      <span className="mr-[5pt] font-semibold text-slate-400">{label}</span>
      <span className="font-bold text-primary-grey">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, variant }:
  { label: string; value: ReactNode; variant?: "highlight" | "paid" | "balance" }) {
  return (
    <div className={cn(
      "flex justify-between text-[9.5pt] text-muted",
      (variant === "highlight" || variant === "paid") && "border-t border-line-light pt-[5pt] text-[11pt] font-bold text-ink",
      variant === "paid" && "text-[#16a34a]",
      variant === "balance" && "rounded-[4pt] bg-[#fef2f2] p-[6pt] text-[12pt] font-extrabold text-[#ef4444] [print-color-adjust:exact]",
    )}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
