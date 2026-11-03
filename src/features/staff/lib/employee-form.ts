import { z } from "zod";

import { todayISO } from "@/lib/format";
import type { Employee, EmployeeInput, EmployeePayrollInput } from "@/types/employee";
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } from "@/types/enums";

/** TERMINATED is only reachable through the Terminate action (backend rejects it here). */
export const FORM_STATUSES = EMPLOYEE_STATUSES.filter((s) => s !== "TERMINATED");

const PHONE = /^\d{10}$/;
const AADHAR = /^\d{12}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACCOUNT = /^[0-9A-Za-z]{6,20}$/;
/** UPI virtual payment address (same rule as the backend `UpiId`), checked lower-cased. */
const UPI = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,31}$/;

/** Same normalisation the backend applies before its pattern checks. */
const upperCompact = (v: string) => v.replace(/\s/g, "").toUpperCase();
const digitsOnly = (v: string) => v.replace(/[\s-]/g, "");

/** "06:00:00" (API) → "06:00" (`<input type="time">`). */
const toHHMM = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");

type ShiftKey = "morning_start" | "morning_end" | "evening_start" | "evening_end";

/**
 * Built per employee: PII arrives masked (XXXX-XXXX-1234) for users without `pii:view`, so an
 * unchanged masked value passes validation and is never sent back (only dirty fields go to PUT).
 */
export function makeEmployeeSchema(original: Employee | null) {
  const unchanged = (field: "aadhar_number" | "pan_number", v: string) =>
    original !== null && v === (original[field] ?? "");
  // Optional: empty is fine; anything typed must be valid (an untouched masked value passes).
  const pii = (field: "aadhar_number" | "pan_number", test: (v: string) => boolean, message: string) =>
    z.string().trim().max(40)
      .refine((v) => v === "" || unchanged(field, v) || test(v), message);
  const required = (max: number) => z.string().trim().min(1, "Required").max(max);
  const time = (message: string) => z.string().min(1, message);

  return z.object({
    name: required(120),
    phone: z.string().trim().regex(PHONE, "Enter a valid 10-digit mobile number"),
    email: z.string().trim().min(1, "Required").max(150, "Max 150 characters").email("Enter a valid email address"),
    address: required(300),
    education: z.string().trim().max(150),
    experience: z.string().trim().max(150),
    aadhar_number: pii("aadhar_number", (v) => AADHAR.test(digitsOnly(v)), "12-digit Aadhar required"),
    pan_number: pii("pan_number", (v) => PAN.test(upperCompact(v)), "Invalid PAN (e.g. ABCDE1234F)"),
    // Emergency contact is optional; a phone, when given, must be 10 digits.
    emergency_contact_name: z.string().trim().max(120),
    emergency_contact_phone: z.string().trim().refine((v) => v === "" || PHONE.test(v), "Enter a valid 10-digit mobile number"),
    emergency_contact_relation: z.string().trim().max(60),
    date_of_joining: z.string().min(1, "Required"),
    role: z.enum(EMPLOYEE_ROLES),
    status: z.enum(EMPLOYEE_STATUSES),
    morning_start: time("Enter the start time"),
    morning_end: time("Enter the end time"),
    evening_start: time("Enter the start time"),
    evening_end: time("Enter the end time"),
  }).superRefine((v, ctx) => {
    // Mirrors EmployeeService._check_shifts. "HH:MM" strings compare correctly as text.
    const issue = (path: ShiftKey, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const shifts: [string, ShiftKey, ShiftKey][] = [
      ["Morning", "morning_start", "morning_end"], ["Evening", "evening_start", "evening_end"],
    ];
    for (const [label, from, to] of shifts) {
      if (v[from] && v[to] && v[from] >= v[to]) issue(to, `${label} shift must end after it starts`);
    }
    if (v.morning_end && v.evening_start && v.morning_end > v.evening_start) {
      issue("evening_start", "Must be after the morning shift ends");
    }
  });
}

export type EmployeeFormValues = z.infer<ReturnType<typeof makeEmployeeSchema>>;
export type EmployeeFormKey = keyof EmployeeFormValues;

export function toEmployeeValues(e: Employee | null): EmployeeFormValues {
  return {
    name: e?.name ?? "",
    phone: e?.phone ?? "",
    email: e?.email ?? "",
    address: e?.address ?? "",
    education: e?.education ?? "",
    experience: e?.experience ?? "",
    aadhar_number: e?.aadhar_number ?? "",
    pan_number: e?.pan_number ?? "",
    emergency_contact_name: e?.emergency_contact_name ?? "",
    emergency_contact_phone: e?.emergency_contact_phone ?? "",
    emergency_contact_relation: e?.emergency_contact_relation ?? "",
    date_of_joining: e?.date_of_joining ?? todayISO(),
    role: e?.role ?? "TRAINER",
    status: e && e.status !== "TERMINATED" ? e.status : "ACTIVE",
    morning_start: toHHMM(e?.morning_start),
    morning_end: toHHMM(e?.morning_end),
    evening_start: toHHMM(e?.evening_start),
    evening_end: toHHMM(e?.evening_end),
  };
}

/** Trimmed / normalised request payload. */
export function toEmployeeBody(v: EmployeeFormValues): EmployeeInput {
  return {
    ...v,
    name: v.name.trim(),
    phone: v.phone.trim(),
    email: v.email.trim(),
    address: v.address.trim(),
    education: v.education.trim() || null,
    experience: v.experience.trim() || null,
    aadhar_number: digitsOnly(v.aadhar_number.trim()) || null,
    pan_number: upperCompact(v.pan_number) || null,
    emergency_contact_name: v.emergency_contact_name.trim() || null,
    emergency_contact_phone: v.emergency_contact_phone.trim() || null,
    emergency_contact_relation: v.emergency_contact_relation.trim() || null,
  };
}

// ── payroll & bank (separate form) ─────────────────────────────────────

/**
 * Base salary is required; bank name, account number and IFSC go together or stay empty (paid in cash).
 * A masked account number (no `pii:view`) that the user didn't touch counts as filled and is not sent.
 */
export function makePayrollSchema(original: Employee) {
  const maskedAccount = original.bank_account_number ?? "";
  return z.object({
    base_salary: z.number({ invalid_type_error: "Enter the monthly salary" }).min(0, "Must be ≥ 0").max(10_000_000),
    bank_name: z.string().trim().max(120),
    bank_account_number: z.string().trim().max(60)
      .refine((v) => v === "" || v === maskedAccount || BANK_ACCOUNT.test(digitsOnly(v)), "6–20 letters / digits"),
    ifsc_code: z.string().trim()
      .refine((v) => v === "" || IFSC.test(upperCompact(v)), "Invalid IFSC (e.g. SBIN0001234)"),
    upi_id: z.string().trim().max(100)
      .refine((v) => v === "" || UPI.test(v.toLowerCase()), "Invalid UPI ID (e.g. name@okaxis)"),
  }).superRefine((v, ctx) => {
    const filled = [v.bank_name, v.bank_account_number, v.ifsc_code].filter(Boolean).length;
    if (filled > 0 && filled < 3) {
      (["bank_name", "bank_account_number", "ifsc_code"] as const).forEach((path) => {
        if (!v[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Required with the other bank details" });
      });
    }
  });
}

export type PayrollFormValues = z.infer<ReturnType<typeof makePayrollSchema>>;

export function toPayrollValues(e: Employee): PayrollFormValues {
  return {
    base_salary: e.base_salary,
    bank_name: e.bank_name ?? "",
    bank_account_number: e.bank_account_number ?? "",
    ifsc_code: e.ifsc_code ?? "",
    upi_id: e.upi_id ?? "",
  };
}

/** `accountChanged` false → the stored account number is kept (it may only be visible masked). */
export function toPayrollBody(v: PayrollFormValues, accountChanged: boolean): EmployeePayrollInput {
  const body: EmployeePayrollInput = {
    base_salary: v.base_salary,
    bank_name: v.bank_name.trim() || null,
    ifsc_code: v.ifsc_code ? upperCompact(v.ifsc_code) : null,
    upi_id: v.upi_id.trim().toLowerCase() || null,
  };
  if (accountChanged) body.bank_account_number = v.bank_account_number ? digitsOnly(v.bank_account_number) : null;
  return body;
}
