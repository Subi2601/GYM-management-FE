import type { PageQuery } from "@/types/api";

/** GET /offers — see backend app/schemas/offer.py */
export interface Offer {
  id: string;
  name: string;
  /** 0 = no money off (extra time / free item only). */
  discount_percent: number;
  /** Extra membership time added to the plans it covers. */
  extra_months: number;
  extra_days: number;
  /** Free item handed over, e.g. "Protein shaker". */
  free_item: string | null;
  /** "10% off · +1 month · Free Protein shaker" */
  summary: string;
  valid_from: string | null;
  valid_to: string | null;
  description: string | null;
  is_active: boolean;
  /** Switched on and today inside the date window — what billing screens offer. */
  available: boolean;
  /** Plan categories the % applies to; empty = every plan. */
  category_ids: string[];
  /** null = common offer. */
  branch_id: string | null;
  /** Common offer: available in every branch (only all-branch roles change it). */
  common: boolean;
  created_at: string;
  updated_at: string;
}

export const OFFER_TABS = ["active", "inactive", "all"] as const;
export type OfferTab = (typeof OFFER_TABS)[number];

export interface OfferListQuery extends PageQuery {
  tab?: OfferTab;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

/** POST /offers, PUT /offers/{id} */
export interface OfferInput {
  name: string;
  discount_percent: number;
  extra_months: number;
  extra_days: number;
  free_item: string | null;
  valid_from: string | null;
  valid_to: string | null;
  description: string | null;
  is_active: boolean;
  category_ids: string[];
  /** true = every branch (all-branch roles only); false = the selected branch. */
  common?: boolean;
}
