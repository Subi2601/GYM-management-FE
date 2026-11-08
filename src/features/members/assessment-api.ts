import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import { useBranchStore } from "@/stores/branch-store";

/** Backend app/schemas/assessment.py */
export const LIFESTYLES = ["SEDENTARY", "LIGHTLY_ACTIVE", "ACTIVE", "VERY_ACTIVE"] as const;
export type Lifestyle = (typeof LIFESTYLES)[number];
export const LIFESTYLE_LABEL: Record<Lifestyle, string> = {
  SEDENTARY: "Sedentary (desk job)", LIGHTLY_ACTIVE: "Lightly active", ACTIVE: "Active", VERY_ACTIVE: "Very active (physical job / sport)",
};

export const MOVEMENT_TESTS = ["OVERHEAD_SQUAT", "LUNGE", "PUSH_UP", "HIP_HINGE", "SINGLE_LEG_BALANCE", "SHOULDER_MOBILITY"] as const;
export type MovementTest = (typeof MOVEMENT_TESTS)[number];
export const MOVEMENT_LABEL: Record<MovementTest, string> = {
  OVERHEAD_SQUAT: "Overhead squat", LUNGE: "Lunge", PUSH_UP: "Push-up", HIP_HINGE: "Hip hinge",
  SINGLE_LEG_BALANCE: "Single-leg balance", SHOULDER_MOBILITY: "Shoulder mobility",
};
export const RATINGS = ["GOOD", "FAIR", "POOR"] as const;
export type Rating = (typeof RATINGS)[number];

export interface AssessmentInput {
  assessed_on: string;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  resting_heart_rate: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  lifestyle: Lifestyle | null;
  medical_conditions: string | null;
  past_injuries: string | null;
  surgeries: string | null;
  static_notes: string | null;
  movements: Partial<Record<MovementTest, Rating>>;
  dynamic_notes: string | null;
  notes: string | null;
}

export interface Assessment extends AssessmentInput {
  id: string;
  member_id: string;
  bmi: number | null;
  assessed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const assessmentApi = {
  list: (memberId: string) => apiGet<Assessment[]>(`/assessments/member/${memberId}`),
  create: (memberId: string, body: AssessmentInput) => apiPost<Assessment>(`/assessments/member/${memberId}`, body),
  update: (id: string, body: AssessmentInput) => apiPut<Assessment>(`/assessments/${id}`, body),
  remove: (id: string) => apiDelete<null>(`/assessments/${id}`),
};

export const assessmentKeys = {
  list: (branch: string | null | undefined, memberId: string) => ["assessments", branch, memberId] as const,
};

export function useAssessments(memberId: string) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  return useQuery({ queryKey: assessmentKeys.list(branch, memberId),
    queryFn: async () => (await assessmentApi.list(memberId)).data });
}

export function useInvalidateAssessments() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["assessments"] }), qc.invalidateQueries({ queryKey: ["members"] })]);
}
