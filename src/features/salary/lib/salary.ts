import type { PaymentMode } from "@/types/enums";

export const PAYMENT_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash", UPI: "UPI / GPay", CARD: "Card", BANK_TRANSFER: "Bank transfer",
};

/** "dd MMM" chip label for an ISO date. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/** Year choices for the month pickers: two years back to this year. */
export function recentYears(): number[] {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y];
}
