import type { PageQuery } from "@/types/api";
import type { LeadStatus } from "@/types/enums";

/** GET /leads, /leads/{id} — see backend app/schemas/lead.py */
export interface Lead {
  id: string;
  branch_id: string;
  name: string;
  phone: string;
  location: string | null;
  goal: string | null;
  status: LeadStatus;
  plan_to_join_date: string | null;
  next_follow_up_date: string | null;
  last_follow_up_date: string | null;
  /** History: entries joined by "\n---\n", follow-ups as "YYYY-MM-DD: note". */
  notes: string | null;
  converted_member_id: string | null;
  created_at: string;
  updated_at: string;
}

export const LEAD_FILTERS = ["all", "followup", "rejected"] as const;
export type LeadFilter = (typeof LEAD_FILTERS)[number];

export interface LeadListQuery extends PageQuery {
  filter?: LeadFilter;
}

/** POST /leads, PUT /leads/{id} */
export interface LeadInput {
  name: string;
  phone: string;
  location: string;
  goal: string;
  status: LeadStatus;
  plan_to_join_date: string;
  next_follow_up_date: string;
  notes?: string | null;
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
