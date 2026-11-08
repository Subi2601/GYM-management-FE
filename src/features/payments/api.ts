import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet, cleanParams } from "@/lib/api-client";
import { openWhatsApp } from "@/lib/utils";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated } from "@/types/api";
import type { Invoice, Payment, PaymentListQuery, PaymentStats } from "@/types/payment";

export const paymentApi = {
  list: (query: PaymentListQuery) => apiGet<Paginated<Payment>>("/payments", cleanParams(query)),
  stats: () => apiGet<PaymentStats>("/payments/stats"),
  invoice: (paymentId: string) => apiGet<Invoice>(`/payments/${paymentId}/invoice`),
  /** No login — the signed token from Invoice.share_token. */
  publicInvoice: (token: string) => apiGet<Invoice>(`/public/invoice/${token}`),
};

type Branch = string | null | undefined;

export const paymentKeys = {
  all: ["payments"] as const,
  list: (branch: Branch, query: PaymentListQuery) => ["payments", "list", branch, query] as const,
  stats: (branch: Branch) => ["payments", "stats", branch] as const,
  invoice: (branch: Branch, paymentId: string) => ["payments", "invoice", branch, paymentId] as const,
};

export function usePayments(query: PaymentListQuery) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: paymentKeys.list(branch, query),
    queryFn: async () => (await paymentApi.list(query)).data,
    placeholderData: keepPreviousData,
  });
}

export function usePaymentStats(enabled = true) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: paymentKeys.stats(branch),
    queryFn: async () => (await paymentApi.stats()).data,
    enabled,
  });
}

export function useInvoice(paymentId: string | undefined) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: paymentKeys.invoice(branch, paymentId ?? ""),
    queryFn: async () => (await paymentApi.invoice(paymentId ?? "")).data,
    enabled: Boolean(paymentId),
  });
}

export function usePublicInvoice(token: string | undefined) {
  return useQuery({
    queryKey: ["public-invoice", token],
    queryFn: async () => (await paymentApi.publicInvoice(token ?? "")).data,
    enabled: Boolean(token),
    retry: false,
  });
}

/** "Thanks for joining" message that goes with the invoice PDF (no link — the PDF is the invoice). */
export function invoiceMessage(invoice: Invoice, welcome: boolean): string {
  const greeting = welcome
    ? `Welcome to *${invoice.organization_name.toUpperCase()}*, ${invoice.member.name}! 🎉\n\nThank you for joining us. We're excited to be part of your fitness journey.`
    : `Hello *${invoice.member.name}*,\n\nThank you for choosing *${invoice.organization_name.toUpperCase()}*!`;
  // A new member also gets the gym's terms & conditions (Gym Settings) as a link.
  const terms = welcome && invoice.terms_url
    ? `\n\n📄 Please read our terms & conditions:\n${window.location.origin}${invoice.terms_url}`
    : "";
  return `${greeting}\n\nYour payment of *₹${invoice.paid_amount}* (receipt ${invoice.receipt_no}) has been received. Your invoice is attached.${terms}\n\nHave a great workout! 💪`;
}

/**
 * Sends the invoice PDF to the member on WhatsApp.
 * Phone / tablet: the share sheet opens with the PDF + message → pick WhatsApp and the member.
 * Computer: WhatsApp's chat links can't carry files, so the PDF downloads and the member's chat opens with the
 * message — drop the file in (📎). Returns which path ran so the screen can say what to do next.
 */
export async function sendInvoiceOnWhatsApp(invoice: Invoice, welcome: boolean, pdf: File): Promise<"shared" | "downloaded"> {
  const text = invoiceMessage(invoice, welcome);
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [pdf] })) {
    try {
      await navigator.share({ files: [pdf], text, title: `Invoice ${invoice.receipt_no}` });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "shared";   // closed the sheet
    }
  }
  const url = URL.createObjectURL(pdf);
  const a = Object.assign(document.createElement("a"), { href: url, download: pdf.name });
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  openWhatsApp(invoice.member.phone, text);
  return "downloaded";
}
