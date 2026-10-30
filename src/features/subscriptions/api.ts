import { useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, cleanParams } from "@/lib/api-client";
import type { Paginated } from "@/types/api";
import type { CompletePaymentRequest, CompletePaymentResponse, EnrollRequest,
  EnrollResponse } from "@/types/payment-enroll";
import type { SubscriptionDetail, SubscriptionListQuery, SubscriptionRow } from "@/types/subscription";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  list: (branch: string | null | undefined, q: SubscriptionListQuery) => ["subscriptions", "list", branch, q] as const,
  detail: (branch: string | null | undefined, id: string) => ["subscriptions", "detail", branch, id] as const,
};

export const subscriptionApi = {
  list: (q: SubscriptionListQuery) => apiGet<Paginated<SubscriptionRow>>("/subscriptions", cleanParams(q)),
  detail: (id: string) => apiGet<SubscriptionDetail>(`/subscriptions/${id}`),
  /** Atomic multi-plan enrolment / renewal / add-on: subscriptions + payment in one transaction. */
  enroll: (body: EnrollRequest) => apiPost<EnrollResponse>("/subscriptions/enroll", body),
  /** Pay existing unpaid subscriptions (POST /payments). */
  completePayment: (body: CompletePaymentRequest) => apiPost<CompletePaymentResponse>("/payments", body),
};

/** After any billing write: members (expiry), board, payments, PT and every lookup are stale. */
export function useInvalidateBilling() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [["subscriptions"], ["members"], ["payments"], ["lookup"], ["dashboard"], ["personal-training"], ["diet"]]
        .map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
}

export function openInvoice(paymentId: string): void {
  window.open(`/invoice/${paymentId}`, "_blank");
}
