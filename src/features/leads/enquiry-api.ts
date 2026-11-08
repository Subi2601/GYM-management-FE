import { apiGet, apiPost } from "@/lib/api-client";
import type { FitnessGoal } from "@/types/enums";

/** GET /public/enquiry/{token} — what the public form shows. */
export interface EnquiryFormInfo {
  organization_name: string;
  branch_name: string;
  branch_location: string | null;
  contact_phone: string | null;
  /** Gym logo / terms (Gym Settings). */
  logo_url: string | null;
  terms_url: string | null;
  /** Trial class offer (Configuration); the form shows the option only when enabled. */
  trial_enabled: boolean;
  trial_days: number;
  trial_fee: number;
  /** Latest trial start = today + this. */
  trial_book_ahead_days: number;
}

export interface EnquiryResult {
  name: string;
  branch_name: string;
  trial_start: string | null;
  trial_end: string | null;
  trial_fee: number | null;
  /** Asked for a trial but this phone already had one. */
  trial_used: boolean;
}

export type PreferredTime = "MORNING" | "AFTERNOON" | "EVENING";
export type JoinWhen = "THIS_WEEK" | "THIS_MONTH" | "LATER";

export interface EnquiryInput {
  name: string;
  phone: string;
  goal: FitnessGoal | null;
  preferred_time: PreferredTime | null;
  join_when: JoinWhen | null;
  location: string | null;
  message: string | null;
  trial: boolean;
  trial_date: string | null;
  /** Honeypot: hidden on the page, people leave it empty. */
  website: string | null;
}

/** GET /leads/enquiry-form — the branch's link token (staff side). */
export interface EnquiryLink {
  branch_id: string;
  branch_name: string;
  token: string;
}

/** Public form (no login): the branch comes from the link token. */
export const publicEnquiryApi = {
  info: (token: string) => apiGet<EnquiryFormInfo>(`/public/enquiry/${token}`),
  submit: (token: string, body: EnquiryInput) => apiPost<EnquiryResult>(`/public/enquiry/${token}`, body),
};

export const enquiryLinkApi = {
  get: () => apiGet<EnquiryLink>("/leads/enquiry-form"),
  regenerate: () => apiPost<EnquiryLink>("/leads/enquiry-form/regenerate"),
};

export const enquiryKeys = {
  link: (branch: string | null | undefined) => ["leads", "enquiry-form", branch] as const,
};

/** Public URL of a branch's form (what the QR and the shared link open). */
export const enquiryUrl = (token: string) => `${window.location.origin}/enquiry/${token}`;
