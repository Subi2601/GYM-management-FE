import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";
import type { Paginated } from "@/types/api";
import type { ActionResult, CancelInput, DocumentUpload, FreezeInput, MemberDocument, MembershipActions, Refund,
  TransferInput } from "@/types/membership";

export const membershipKeys = {
  actions: (branch: string | null | undefined, memberId: string) => ["memberships", "actions", branch, memberId] as const,
  documents: (branch: string | null | undefined, memberId: string) => ["memberships", "documents", branch, memberId] as const,
  refunds: (branch: string | null | undefined, query: object) => ["refunds", branch, query] as const,
};

export const membershipApi = {
  actions: (memberId: string) => apiGet<MembershipActions>(`/memberships/member/${memberId}`),
  documents: (memberId: string) => apiGet<MemberDocument[]>(`/memberships/member/${memberId}/documents`),
  setAllowance: (subId: string, days: number | null) =>
    apiPut<MembershipActions>(`/memberships/${subId}/freeze-allowance`, { days }),
  freeze: (subId: string, body: FreezeInput) => apiPost<ActionResult>(`/memberships/${subId}/freeze`, body),
  resume: (freezeId: string) => apiPost<ActionResult>(`/memberships/freezes/${freezeId}/resume`),
  transfer: (subId: string, body: TransferInput) => apiPost<ActionResult>(`/memberships/${subId}/transfer`, body),
  cancel: (subId: string, body: CancelInput) => apiPost<ActionResult>(`/memberships/${subId}/cancel`, body),
  refunds: (query: { page: number; page_size: number; search?: string; date_from?: string; date_to?: string }) =>
    apiGet<Paginated<Refund>>("/refunds", cleanParams(query)),
};

export function useMembershipActions(memberId: string | null) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: membershipKeys.actions(branch, memberId ?? ""),
    queryFn: async () => (await membershipApi.actions(memberId!)).data,
    enabled: !!memberId,
  });
}

export function useMemberDocuments(memberId: string) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({
    queryKey: membershipKeys.documents(branch, memberId),
    queryFn: async () => (await membershipApi.documents(memberId)).data,
  });
}

/** A membership action changes the member's plans, lists, renewals, payments and the dashboard. */
export function useInvalidateMembership() {
  const qc = useQueryClient();
  return () => Promise.all(["memberships", "subscriptions", "members", "renewals", "payments", "refunds", "dashboard"]
    .map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

/** Opens a stored proof file in a new tab (the request carries the login, so a plain link can't be used). */
export async function openDocument(documentId: string): Promise<void> {
  const res = await api.get<Blob>(`/memberships/documents/${documentId}`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/** File → the JSON upload the API takes (base64), or an error message. */
export function readDocument(file: File): Promise<DocumentUpload> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) return reject(new Error("The file is bigger than 5 MB. Attach a smaller photo or PDF"));
    if (!DOCUMENT_ACCEPT.split(",").includes(file.type)) return reject(new Error("Attach a PDF or a photo (JPG / PNG)"));
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      resolve({ file_name: file.name.slice(0, 150), content_type: file.type, data_base64: text.slice(text.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}
