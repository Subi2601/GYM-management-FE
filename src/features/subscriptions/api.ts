import { useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, cleanParams } from "@/lib/api-client";
import type { Paginated, TabCounts } from "@/types/api";
import type { CompletePaymentRequest, CompletePaymentResponse, EnrollRequest,
  EnrollResponse, UpgradeRequest } from "@/types/payment-enroll";
import type { SubscriptionDetail, SubscriptionListQuery, SubscriptionRow, UpgradeInfo } from "@/types/subscription";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  list: (branch: string | null | undefined, q: SubscriptionListQuery) => ["subscriptions", "list", branch, q] as const,
  detail: (branch: string | null | undefined, id: string) => ["subscriptions", "detail", branch, id] as const,
  counts: (branch: string | null | undefined) => ["subscriptions", "counts", branch] as const,
  member: (branch: string | null | undefined, memberId: string) => ["subscriptions", "member", branch, memberId] as const,
  upgrade: (branch: string | null | undefined, memberId: string) => ["subscriptions", "upgrade", branch, memberId] as const,
};

/** Tabs of the renewal board; `active` = not due for renewal (renewal_state NONE). */
export type SubscriptionTab = "all" | "expiring" | "expired" | "active";

export const subscriptionApi = {
  list: (q: SubscriptionListQuery) => apiGet<Paginated<SubscriptionRow>>("/subscriptions", cleanParams(q)),
  /** Row count per tab in one call. */
  counts: () => apiGet<TabCounts<SubscriptionTab>>("/subscriptions/counts"),
  detail: (id: string) => apiGet<SubscriptionDetail>(`/subscriptions/${id}`),
  /** Every subscription of one member, newest first. */
  forMember: (memberId: string) => apiGet<SubscriptionRow[]>(`/subscriptions/member/${memberId}`),
  /** Can the member upgrade now (window, balance) + every membership plan with why it can't be picked. */
  upgradeInfo: (memberId: string) => apiGet<UpgradeInfo>(`/subscriptions/member/${memberId}/upgrade`),
  /** Bigger plan from the old start date; the old plan's cost is credited, only the balance billed. */
  upgrade: (body: UpgradeRequest) => apiPost<EnrollResponse>("/subscriptions/upgrade", body),
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
