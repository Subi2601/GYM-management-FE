import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated } from "@/types/api";
import type { Invoice, Payment, PaymentListQuery, PaymentStats } from "@/types/payment";

export const paymentApi = {
  list: (query: PaymentListQuery) => apiGet<Paginated<Payment>>("/payments", cleanParams(query)),
  stats: () => apiGet<PaymentStats>("/payments/stats"),
  invoice: (paymentId: string) => apiGet<Invoice>(`/payments/${paymentId}/invoice`),
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
