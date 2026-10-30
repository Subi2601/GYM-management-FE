import type { PlanServiceType, PlanType } from "@/types/enums";

/** GET /plans — see backend app/schemas/plan.py */
export interface Plan {
  id: string;
  branch_id: string;
  name: string;
  type: PlanType;
  service_type: PlanServiceType;
  duration_days: number;
  price: number;
  total_sessions: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanInput {
  name: string;
  type: PlanType;
  service_type: PlanServiceType;
  duration_days: number;
  price: number;
  total_sessions: number;
  description?: string | null;
}

/** GET /employees/trainers */
export interface TrainerBrief {
  id: string;
  employee_code: string;
  name: string;
  phone: string;
}
