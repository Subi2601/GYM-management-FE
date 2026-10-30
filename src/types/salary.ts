import type { EmployeeRole, PaymentMode, SalaryStatus } from "@/types/enums";

/** see backend app/schemas/salary.py (SalaryResponse). `month_year` is `MM-YYYY`. */
export interface Salary {
  id: string;
  branch_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  employee_role: EmployeeRole;
  month_year: string;
  base_salary: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  deductions: number;
  bonus: number;
  till_now_salary: number;
  net_salary: number;
  status: SalaryStatus;
  paid_date: string | null;
  payment_method: string | null;
  absent_dates: string[];
  created_at: string;
  updated_at: string;
}

/** GET /salary?month=&year= */
export interface SalaryMonth {
  month_year: string;
  items: Salary[];
  total_payout: number;
}

/** POST /salary/calculate */
export interface SalaryCalculateInput {
  month: number;
  year: number;
  employee_id?: string | null;
}

export interface SalaryCalcResult {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  outcome: "CALCULATED" | "SKIPPED_PAID";
  salary: Salary;
}

export interface SalaryCalculateResult {
  month_year: string;
  calculated: number;
  skipped_paid: number;
  results: SalaryCalcResult[];
}

/** PUT /salary/{id}/pay */
export interface SalaryPayInput {
  payment_method: PaymentMode;
  paid_date?: string | null;
}
