import type { FitnessGoal, Gender, MemberStatus, MembershipState } from "@/types/enums";

/** GET /members, /members/{id} — see backend app/schemas/member.py */
export interface Member {
  id: string;
  branch_id: string;
  registration_id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: Gender;
  dob: string | null;
  address: string | null;
  blood_group: string | null;
  weight: number | null;
  height: number | null;
  fitness_goal: FitnessGoal | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  joining_date: string;
  id_proof_type: string | null;
  /** Plain for pii:view, masked (XXXX-XXXX-1234) otherwise. */
  id_proof_number: string | null;
  status: MemberStatus;
  membership_state: MembershipState;
  current_plan_id: string | null;
  current_plan_name: string | null;
  expiry_date: string | null;
  /** Last check-in (null = never came). */
  last_visit_date: string | null;
  days_since_visit: number | null;
  /** The member who referred them. */
  referred_by_id: string | null;
  referred_by_name: string | null;
  /** Members this one referred (0 = no referral tree). */
  referral_count: number;
  created_at: string;
  updated_at: string;
}

export type MemberInput = Partial<Omit<Member, "id" | "branch_id" | "registration_id" | "membership_state" |
  "current_plan_id" | "current_plan_name" | "expiry_date" | "last_visit_date" | "days_since_visit" | "referred_by_name" | "referral_count" | "created_at" | "updated_at">>;
