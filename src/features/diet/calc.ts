import type { DietTier, Gender } from "@/types/enums";

/**
 * Client-side mirror of backend app/services/diet_service.py — used ONLY for the live preview
 * in the builder. The saved plan always shows the server's numbers.
 */
export const TIER_RANK: Record<DietTier, number> = { BASIC: 1, STANDARD: 2, PREMIUM: 3 };
export const STANDARD_MONTHLY_LIMIT = 2;
const PROTEIN_PCT = 0.4;
const CARBS_PCT = 0.3;
const FATS_PCT = 0.3;

/** Python's round(): half-to-even ("banker's rounding"), so previews match the server exactly. */
export function pyRound(value: number, digits = 0): number {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return (floor % 2 === 0 ? floor : floor + 1) / factor;
  return Math.round(scaled) / factor;
}

export function bmiStatus(bmi: number | null | undefined): string | null {
  if (bmi === null || bmi === undefined) return null;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export interface DietTargets {
  bmi: number;
  bmi_status: string | null;
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
}

/** BMI, Mifflin-St Jeor BMR (+5 male / −161 otherwise), TDEE, 40/30/30 macro split. */
export function calculateTargets(weight: number, heightCm: number, age: number, activity: number,
  gender: Gender): DietTargets {
  const meters = heightCm / 100;
  const bmi = weight / (meters * meters);
  const base = 10 * weight + 6.25 * heightCm - 5 * age;
  const bmr = gender === "MALE" ? base + 5 : base - 161;
  const tdee = bmr * activity;
  const roundedBmi = pyRound(bmi, 1);
  return {
    bmi: roundedBmi,
    bmi_status: bmiStatus(roundedBmi),
    bmr: pyRound(bmr),
    tdee: pyRound(tdee),
    target_calories: pyRound(tdee),
    target_protein: pyRound((tdee * PROTEIN_PCT) / 4),
    target_carbs: pyRound((tdee * CARBS_PCT) / 4),
    target_fats: pyRound((tdee * FATS_PCT) / 9),
  };
}

export function sameMonth(isoDate: string | null | undefined, todayIso: string): boolean {
  return !!isoDate && isoDate.slice(0, 7) === todayIso.slice(0, 7);
}

/** Display number like the original (1 decimal max, no trailing .0). */
export function num(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return String(pyRound(value, 1));
}
