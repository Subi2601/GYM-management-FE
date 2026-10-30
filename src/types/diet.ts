import type { DietCategory, DietTier, FoodCategory, Gender, MealTime } from "@/types/enums";

/** Activity multipliers accepted by DietPlanUpsert.activity_level. */
export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Sedentary (Office job)" },
  { value: 1.375, label: "Lightly Active (Gym 1-3 days)" },
  { value: 1.55, label: "Moderately Active (Gym 3-5 days)" },
  { value: 1.725, label: "Very Active (Hard Gym 6-7 days)" },
  { value: 1.9, label: "Extra Active (Athlete/Physical work)" },
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]["value"];

/** GET /diet-plans/eligible-members — EligibleMemberResponse */
export interface EligibleMember {
  member_id: string;
  registration_id: string;
  name: string;
  phone: string;
  gender: Gender;
  eligible_tier: DietTier;
  has_plan: boolean;
  plan_id: string | null;
  plan_tier: DietTier | null;
  last_modified_date: string | null;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface DietPlanItem {
  id: string;
  food_item_id: string;
  food_name: string;
  quantity: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface DietMeal {
  meal_time: MealTime;
  items: DietPlanItem[];
  totals: MacroTotals;
}

/** GET/PUT /diet-plans/member/{member_id} — DietPlanResponse */
export interface DietPlan {
  id: string;
  branch_id: string;
  member_id: string;
  member_name: string;
  registration_id: string;
  tier: DietTier;
  category: DietCategory;
  weight: number | null;
  height: number | null;
  age: number | null;
  activity_level: number;
  bmi: number | null;
  bmi_status: string | null;
  bmr: number | null;
  tdee: number | null;
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fats: number | null;
  modification_count: number;
  /** null = unlimited */
  monthly_update_limit: number | null;
  /** false for BASIC */
  items_editable: boolean;
  last_modified_date: string | null;
  notes: string | null;
  meals: DietMeal[];
  totals: MacroTotals;
  created_at: string;
  updated_at: string;
}

/** PUT /diet-plans/member/{member_id} — DietPlanUpsert */
export interface DietPlanUpsert {
  tier: DietTier;
  category: DietCategory;
  weight: number;
  height: number;
  age: number;
  activity_level: ActivityLevel;
  notes?: string | null;
}

/** POST /diet-plans/member/{member_id}/items — DietPlanItemCreate */
export interface DietPlanItemCreate {
  food_item_id: string;
  meal_time: MealTime;
  quantity: number;
}

/** GET /diet-plans/member/{member_id}/share-text */
export interface DietShareText {
  phone: string;
  text: string;
  whatsapp_url: string;
}

/** GET /food-items — FoodItemResponse (values per 100 g / serving unit) */
export interface FoodItem {
  id: string;
  organization_id: string | null;
  is_platform: boolean;
  name: string;
  category: FoodCategory;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number | null;
  serving_unit: string;
  nutritional_benefits: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}
