import type { PaymentMode } from "@/types/enums";

/** Backend app/schemas/membership.py — freeze / transfer / cancel & refund. */
export type FreezeState = "UPCOMING" | "ACTIVE" | "DONE";

export interface Freeze {
  id: string;
  start_date: string;
  end_date: string;
  days: number;
  resumed_on: string | null;
  reason: string;
  document_id: string | null;
  document_name: string | null;
  state: FreezeState;
}

export interface FreezeStatus {
  enabled: boolean;
  allowed: boolean;
  reason: string | null;
  allowance_days: number;
  custom_allowance: boolean;
  gym_days: number;
  used_days: number;
  remaining_days: number;
  times_used: number;
  max_times: number;
  active: Freeze | null;
}

export interface TransferStatus {
  enabled: boolean;
  allowed: boolean;
  reason: string | null;
  within_days: number;
  used_days: number;
  remaining_days: number;
}

export interface CancelStatus {
  refund_eligible: boolean;
  refund_reason: string | null;
  refund_window_days: number;
  used_days: number;
  paid_amount: number;
  deduction_percent: number;
  deduction_amount: number;
  suggested_refund: number;
}

export interface MembershipActions {
  current: {
    subscription_id: string;
    plan_id: string;
    plan_name: string;
    start_date: string;
    end_date: string;
    frozen_days: number;
    received_by_transfer: boolean;
  } | null;
  reason: string | null;
  freezes: Freeze[];
  freeze: FreezeStatus | null;
  transfer: TransferStatus | null;
  cancel: CancelStatus | null;
}

export interface DocumentUpload {
  file_name: string;
  content_type: string;
  data_base64: string;
}

export interface FreezeInput {
  start_date: string;
  days: number;
  reason: string;
  document?: DocumentUpload | null;
}

export interface TransferInput {
  to_member_id?: string | null;
  name?: string | null;
  phone?: string | null;
  reason: string;
  document?: DocumentUpload | null;
}

export interface RefundInput {
  amount: number;
  mode: PaymentMode;
  reference?: string | null;
  account_holder?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  bank_name?: string | null;
  upi_id?: string | null;
}

export interface CancelInput {
  reason: string;
  document?: DocumentUpload | null;
  refund?: RefundInput | null;
}

export interface Refund {
  id: string;
  refund_no: string;
  member_id: string;
  member_name: string;
  registration_id: string;
  member_phone: string;
  plan_name: string;
  subscription_id: string;
  paid_amount: number;
  deduction_amount: number;
  amount: number;
  refund_date: string;
  refund_mode: PaymentMode;
  reason: string;
  account_holder: string | null;
  account_number: string | null;
  ifsc: string | null;
  bank_name: string | null;
  upi_id: string | null;
  reference: string | null;
}

export interface ActionResult {
  subscription_id: string;
  member_id: string;
  new_subscription_id: string | null;
  new_member_id: string | null;
  refund: Refund | null;
}

export interface MemberDocument {
  id: string;
  subscription_id: string | null;
  kind: "FREEZE" | "TRANSFER" | "CANCEL";
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}
