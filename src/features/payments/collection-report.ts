import { formatDate, formatINR } from "@/lib/format";
import { humanize } from "@/lib/utils";
import type { Payment, PaymentStats } from "@/types/payment";

/** Escape text before interpolating it into the report HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ReportInput {
  rows: Payment[];
  stats: PaymentStats | undefined;
  /** Human description of the active filters, e.g. "Mode: Cash · 01-10-2026 to 30-10-2026". */
  filterLabel: string;
  /** True when the backend returned fewer rows than matched (500-row cap). */
  truncated: boolean;
}

/** The original exportToPDF() collection report, as a self-printing HTML document. */
export function buildCollectionReportHtml({ rows, stats, filterLabel, truncated }: ReportInput): string {
  const today = new Date().toLocaleDateString("en-IN");
  const reportTotal = rows.reduce((sum, p) => sum + p.paid_amount, 0);

  const statBox = (label: string, value: number) => `
    <div class="stat-box">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(formatINR(value, true))}</span>
    </div>`;

  const summary = [
    stats ? statBox("Total Collection", stats.today) : "",
    stats ? statBox("Cash Payments", stats.today_cash) : "",
    stats ? statBox("Online/Account", stats.today_account) : "",
    statBox(`This Report (${rows.length} receipts)`, reportTotal),
  ].join("");

  const body = rows
    .map((p) => `
      <tr>
        <td>${escapeHtml(p.receipt_no)}</td>
        <td>${escapeHtml(p.registration_id)}</td>
        <td>${escapeHtml(p.member_name)}</td>
        <td>${escapeHtml(p.plan_names.join(", ") || "-")}</td>
        <td>${escapeHtml(humanize(p.payment_mode))}</td>
        <td class="num">${escapeHtml(formatINR(p.paid_amount))}</td>
        <td class="num">${escapeHtml(formatINR(p.balance_amount))}</td>
        <td>${escapeHtml(formatDate(p.payment_date))}</td>
      </tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Collection Report - ${escapeHtml(today)}</title>
  <style>
    body { font-family: sans-serif; padding: 20px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; }
    .header p { color: #64748b; font-size: 13px; margin: 4px 0 0; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; }
    .stat-box { display: flex; flex-direction: column; }
    .stat-label { font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .stat-value { font-size: 20px; font-weight: bold; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; font-size: 13px; }
    th { background: #f1f5f9; font-weight: bold; }
    td.num { text-align: right; }
    .note { color: #b91c1c; font-size: 12px; margin-top: 10px; }
    .footer { margin-top: 40px; text-align: right; font-size: 12px; color: #64748b; }
    @media print { .no-print { display: none; } th, .summary { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>STAG FITNESS</h1>
    <h2>Collection Report - ${escapeHtml(today)}</h2>
    ${filterLabel ? `<p>${escapeHtml(filterLabel)}</p>` : ""}
  </div>

  <div class="summary">${summary}</div>

  <table>
    <thead>
      <tr>
        <th>Receipt</th>
        <th>Reg ID</th>
        <th>Member Name</th>
        <th>Plan</th>
        <th>Mode</th>
        <th>Paid Amt</th>
        <th>Balance</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>${body || `<tr><td colspan="8" style="text-align:center">No payment records found.</td></tr>`}</tbody>
  </table>
  ${truncated ? `<p class="note">Only the first ${rows.length} matching receipts are included. Narrow the filters for a complete report.</p>` : ""}

  <div class="footer">Report Generated on ${escapeHtml(new Date().toLocaleString("en-IN"))}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}
