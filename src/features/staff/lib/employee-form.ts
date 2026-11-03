import { z } from "zod";

import { todayISO } from "@/lib/format";
import type { Employee, EmployeeInput } from "@/types/employee";
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } from "@/types/enums";

export const ID_PROOF_TYPES = ["Aadhar", "Voter ID", "Driving License", "Passport"];
/** TERMINATED is only reachable through the Terminate action (backend rejects it here). */
export const FORM_STATUSES = EMPLOYEE_STATUSES.filter((s) => s !== "TERMINATED");

const PHONE = /^\d{10}$/;
const AADHAR = /^\d{12}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACCOUNT = /^[0-9A-Za-z]{6,20}$/;

/** Same normalisation the backend applies before its pattern checks. */
const upperCompact = (v: string) => v.replace(/\s/g, "").toUpperCase();
const digitsOnly = (v: string) => v.replace(/[\s-]/g, "");

type PiiField = "aadhar_number" | "pan_number" | "id_proof_number" | "bank_account_number";

/**
 * Built per employee: PII arrives masked (XXXX-XXXX-1234) for users without `pii:view`, so an
 * unchanged masked value passes validation and is never sent back (only dirty fields go to PUT).
 */
export function makeEmployeeSchema(original: Employee | null) {
  const unchanged = (field: PiiField, v: string) => original !== null && v === (original[field] ?? "");
  const pii = (field: PiiField, test: (v: string) => boolean, message: string, max = 40) =>
    z.string().trim().min(1, "Required").max(max)
      .refine((v) => unchanged(field, v) || test(v), message);
  const required = (max: number) => z.string().trim().min(1, "Required").max(max);

  return z.object({
    name: required(120),
    phone: z.string().trim().regex(PHONE, "Invalid (10 digits)"),
    email: z.string().trim().min(1, "Required").email("Invalid email"),
    address: required(300),
    education: z.string().trim().max(150),
    experience: z.string().trim().max(150),
    aadhar_number: pii("aadhar_number", (v) => AADHAR.test(digitsOnly(v)), "12-digit Aadhar required"),
    pan_number: pii("pan_number", (v) => PAN.test(upperCompact(v)), "Invalid PAN (e.g. ABCDE1234F)"),
    id_proof_type: required(40),
    id_proof_number: pii("id_proof_number", () => true, "Required"),
    emergency_contact_name: required(120),
    emergency_contact_phone: z.string().trim().regex(PHONE, "Invalid (10 digits)"),
    emergency_contact_relation: required(60),
    base_salary: z.number({ invalid_type_error: "Required" }).min(0, "Must be ≥ 0").max(10_000_000),
    bank_name: required(120),
    bank_account_number: pii("bank_account_number", (v) => BANK_ACCOUNT.test(digitsOnly(v)),
      "6–20 letters / digits", 60),
    ifsc_code: z.string().trim().min(1, "Required")
      .refine((v) => IFSC.test(upperCompact(v)), "Invalid IFSC (e.g. SBIN0001234)"),
    date_of_joining: z.string().min(1, "Required"),
    role: z.enum(EMPLOYEE_ROLES),
    status: z.enum(EMPLOYEE_STATUSES),
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
    id_proof_type: e?.id_proof_type ?? "Aadhar",
    id_proof_number: e?.id_proof_number ?? "",
    emergency_contact_name: e?.emergency_contact_name ?? "",
    emergency_contact_phone: e?.emergency_contact_phone ?? "",
    emergency_contact_relation: e?.emergency_contact_relation ?? "",
    base_salary: e?.base_salary ?? 0,
    bank_name: e?.bank_name ?? "",
    bank_account_number: e?.bank_account_number ?? "",
    ifsc_code: e?.ifsc_code ?? "",
    date_of_joining: e?.date_of_joining ?? todayISO(),
    role: e?.role ?? "TRAINER",
    status: e && e.status !== "TERMINATED" ? e.status : "ACTIVE",
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
    aadhar_number: digitsOnly(v.aadhar_number.trim()),
    pan_number: upperCompact(v.pan_number),
    id_proof_number: v.id_proof_number.trim(),
    emergency_contact_name: v.emergency_contact_name.trim(),
    emergency_contact_phone: v.emergency_contact_phone.trim(),
    emergency_contact_relation: v.emergency_contact_relation.trim(),
    bank_name: v.bank_name.trim(),
    bank_account_number: digitsOnly(v.bank_account_number.trim()),
    ifsc_code: upperCompact(v.ifsc_code),
  };
}
