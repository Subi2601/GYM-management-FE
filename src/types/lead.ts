import type { PageQuery } from "@/types/api";
import type { FitnessGoal, LeadSource, LeadStatus, PaymentMode } from "@/types/enums";

/** GET /leads, /leads/{id} — see backend app/schemas/lead.py */
export interface Lead {
  id: string;
  branch_id: string;
  name: string;
  phone: string;
  location: string | null;
  goal: FitnessGoal | null;
  /** null = not recorded (leads added before the source was captured). */
  source: LeadSource | null;
  status: LeadStatus;
  plan_to_join_date: string | null;
  next_follow_up_date: string | null;
  last_follow_up_date: string | null;
  /** History: entries joined by "\n---\n", follow-ups as "YYYY-MM-DD [Who]: note" ("[Who]" on newer entries). */
  notes: string | null;
  converted_member_id: string | null;
  /** The account that took the enquiry (logged in when the lead was added). */
  attended_by_id: string | null;
  attended_by_name: string | null;
  /** Source REFERRAL: the member who sent them (copied to the member on conversion). */
  referred_by_id: string | null;
  referred_by_name: string | null;
  /** Trial class (null = none booked); dates from Configuration at booking. */
  trial_start: string | null;
  trial_end: string | null;
  trial_state: TrialState | null;
  /** 0 = free. */
  trial_fee: number | null;
  trial_paid_on: string | null;
  trial_payment_mode: PaymentMode | null;
  trial_visits: number;
  trial_last_visit: string | null;
  created_at: string;
  updated_at: string;
}

export type TrialState = "UPCOMING" | "ON" | "ENDED";

/** GET /leads/attendants — "Attended by" filter options. */
export interface LeadAttendant {
  id: string;
  name: string;
}

export const LEAD_FILTERS = ["all", "followup", "trial", "rejected"] as const;
export type LeadFilter = (typeof LEAD_FILTERS)[number];

/** Server sort keys of GET /leads (`sort_by`). */
export type LeadSortKey = "name" | "status" | "source" | "plan_to_join_date" | "next_follow_up_date" | "trial_start"
  | "created_at";

export interface LeadListQuery extends PageQuery {
  filter?: LeadFilter;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  status?: LeadStatus | "";
  source?: LeadSource | "";
  /** Account id (see LeadAttendant). */
  attended_by?: string;
  /** YYYY-MM-DD range on next_follow_up_date. */
  follow_up_from?: string;
  follow_up_to?: string;
}

/** POST /leads, PUT /leads/{id} */
export interface LeadInput {
  name: string;
  phone: string;
  location: string;
  goal: FitnessGoal;
  source: LeadSource;
  status: LeadStatus;
  /** null = not decided yet (optional). */
  plan_to_join_date: string | null;
  next_follow_up_date: string;
  notes?: string | null;
  referred_by_id?: string | null;
}

/** POST /leads/{id}/follow-up */
export interface LeadFollowUpInput {
  notes: string;
  next_follow_up_date?: string | null;
  status?: LeadStatus | null;
}

/** POST /leads/{id}/convert */
export interface LeadConvertResult extends Lead {
  member_id: string;
  registration_id: string;
}

/** Separator the backend uses between note entries. */
export const LEAD_NOTE_SEPARATOR = "\n---\n";
