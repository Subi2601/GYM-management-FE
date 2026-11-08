/** Backend app/schemas/referral.py */
export interface ReferralTier {
  min_referrals: number;
  reward: string;
}

export interface ReferralProgram {
  /** "2026-11" */
  month_key: string;
  /** "November 2026" */
  month_label: string;
  /** false = no reward set for that month. */
  is_set: boolean;
  title: string | null;
  notes: string | null;
  tiers: ReferralTier[];
}

export interface ReferralStatus {
  current: ReferralProgram;
  next: ReferralProgram;
  days_left: number;
}

export interface PersonBrief {
  member_id: string;
  name: string;
  registration_id: string;
  phone: string;
  plan_name: string | null;
  plan_end: string | null;
  joining_date: string;
}

export interface EligibleRow extends PersonBrief {
  referral_count: number;
  reward: string | null;
  eligible: boolean;
  given: boolean;
  next_reward: string | null;
  needed_for_next: number | null;
  referred: PersonBrief[];
}

export interface EligibleList {
  month_key: string;
  month_label: string;
  is_set: boolean;
  rows: EligibleRow[];
}

export type RewardStatus = "PENDING" | "GIVEN";

export interface RewardRow {
  id: string;
  member_id: string;
  name: string;
  registration_id: string;
  phone: string;
  month_key: string;
  month_label: string;
  referral_count: number;
  reward: string;
  status: RewardStatus;
  given_on: string | null;
  note: string | null;
  referred: PersonBrief[];
}

export interface ReferralCounts {
  eligible: number;
  pending: number;
  rewarded: number;
}

export interface TreeNode extends PersonBrief {
  /** People they referred directly. */
  referral_count: number;
  /** Paid for a plan (only paid referrals count for rewards). */
  paid: boolean;
  rewarded: boolean;
  reward_due: boolean;
  counted: boolean;
  /** The reward they were counted for: given or still pending. */
  counted_status: RewardStatus | null;
  children: TreeNode[];
}

export interface TreeReward {
  id: string;
  month_key: string;
  month_label: string;
  reward: string;
  status: RewardStatus;
  given_on: string | null;
  referral_count: number;
  note: string | null;
  referred: PersonBrief[];
}

export interface ReferralTree {
  root: TreeNode;
  referred_by: PersonBrief | null;
  total_referred: number;
  rewards: TreeReward[];
}

export interface ProgramInput {
  month_key: string;
  title: string | null;
  notes: string | null;
  tiers: ReferralTier[];
}
