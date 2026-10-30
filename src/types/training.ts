import type { PTStatus } from "@/types/enums";

/** GET /personal-training — backend app/schemas/training.py PTSubscriptionResponse */
export interface PTSubscription {
  id: string;
  branch_id: string;
  member_id: string;
  member_name: string;
  registration_id: string;
  member_phone: string;
  trainer_id: string | null;
  /** "Not Assigned" when empty */
  trainer_name: string;
  plan_id: string | null;
  plan_name: string;
  subscription_id: string | null;
  goal: string | null;
  total_sessions: number;
  sessions_remaining: number;
  sessions_used: number;
  start_date: string;
  expiry_date: string;
  is_paid: boolean;
  status: PTStatus;
  created_at: string;
  updated_at: string;
}

/** Status filter of GET /personal-training (ALL = no status filter). */
export type PTStatusFilter = PTStatus | "ALL";

export interface PTListQuery {
  page: number;
  page_size: number;
  search?: string;
  status: PTStatusFilter;
  paid_only: boolean;
}

/** GET /personal-training/{id}/sessions */
export interface PTSessionLog {
  id: string;
  pt_subscription_id: string;
  session_date: string;
  trainer_id: string | null;
  trainer_name: string;
  trainer_verified: boolean;
  client_verified: boolean;
  notes: string | null;
  sessions_remaining_after: number;
  created_at: string;
  updated_at: string;
}

/** POST /personal-training/{id}/sessions — PTSessionLogCreate */
export interface PTSessionLogCreate {
  session_date?: string | null;
  trainer_id?: string | null;
  trainer_verified: boolean;
  client_verified: boolean;
  notes?: string | null;
}

/** POST /personal-training/{id}/trainer — PTTrainerUpdate */
export interface PTTrainerUpdate {
  trainer_id: string;
}
