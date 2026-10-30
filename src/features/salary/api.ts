import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import type {
  Salary, SalaryCalculateInput, SalaryCalculateResult, SalaryMonth, SalaryPayInput,
} from "@/types/salary";

export interface SalaryMonthQuery {
  month: number;
  year: number;
}

export const salaryApi = {
  month: (q: SalaryMonthQuery) => apiGet<SalaryMonth>("/salary", q),
  calculate: (body: SalaryCalculateInput) => apiPost<SalaryCalculateResult>("/salary/calculate", body),
  pay: (id: string, body: SalaryPayInput) => apiPut<Salary>(`/salary/${id}/pay`, body),
};

export const salaryKeys = {
  all: ["salary"] as const,
  month: (branch: string | null | undefined, q: SalaryMonthQuery) => ["salary", "month", branch, q] as const,
};
