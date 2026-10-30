import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { staffApi, staffKeys } from "@/features/staff/api";
import { todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import type { Employee, EmployeeInput, EmployeeUpdate } from "@/types/employee";
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } from "@/types/enums";

const ID_PROOF_TYPES = ["Aadhar", "Voter ID", "Driving License", "Passport"];
/** TERMINATED is only reachable through the Terminate action (backend rejects it here). */
const FORM_STATUSES = EMPLOYEE_STATUSES.filter((s) => s !== "TERMINATED");

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
function makeSchema(original: Employee | null) {
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

type FormValues = z.infer<ReturnType<typeof makeSchema>>;
type FormKey = keyof FormValues;

function defaults(e: Employee | null): FormValues {
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
function toPayload(v: FormValues): EmployeeInput {
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

interface Props {
  open: boolean;
  /** null → Add New Employee. */
  employee: Employee | null;
  onClose: () => void;
}

/** "Add New Employee" / "Edit Employee" — the original sectioned 3-column form. */
export function EmployeeFormModal({ open, employee, onClose }: Props) {
  const qc = useQueryClient();
  const isEditing = employee !== null;
  const schema = useMemo(() => makeSchema(employee), [employee]);

  const { register, handleSubmit, reset, formState: { errors, dirtyFields } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: defaults(employee),
  });

  useEffect(() => {
    if (open) reset(defaults(employee));
  }, [open, employee, reset]);

  const save = useMutation({
    mutationFn: (req: { id: null; body: EmployeeInput } | { id: string; body: EmployeeUpdate }) =>
      req.id === null ? staffApi.create(req.body) : staffApi.update(req.id, req.body),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  const onSubmit = handleSubmit((v) => {
    const payload = toPayload(v);
    if (!employee) {
      save.mutate({ id: null, body: payload });
      return;
    }
    // Only what the user changed — masked PII the user didn't touch is never echoed back.
    const changed: EmployeeUpdate = {};
    (Object.keys(dirtyFields) as FormKey[]).forEach((k) => {
      if (dirtyFields[k]) Object.assign(changed, { [k]: payload[k] });
    });
    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }
    save.mutate({ id: employee.id, body: changed });
  });

  const idTypes = employee?.id_proof_type && !ID_PROOF_TYPES.includes(employee.id_proof_type)
    ? [...ID_PROOF_TYPES, employee.id_proof_type] : ID_PROOF_TYPES;

  const text = (name: FormKey, label: string, opts: { required?: boolean; placeholder?: string; type?: string } = {}) => (
    <Field label={label} htmlFor={`emp-${name}`} required={opts.required ?? true} error={errors[name]?.message}>
      <Input id={`emp-${name}`} type={opts.type ?? "text"} placeholder={opts.placeholder}
        invalid={!!errors[name]} className="px-3 py-2.5 text-[13px]" {...register(name)} />
    </Field>
  );

  return (
    <Modal open={open} title={isEditing ? "Edit Employee" : "Add New Employee"} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="py-2.5">
        <Section title="Personal Information" first>
          {text("name", "Full Name", { placeholder: "Name" })}
          {text("phone", "Phone", { placeholder: "10-digit phone" })}
          {text("email", "Email", { placeholder: "Email address", type: "email" })}
          {text("address", "Address", { placeholder: "Residential address" })}
          {text("education", "Education", { required: false, placeholder: "Education background" })}
          {text("experience", "Experience", { required: false, placeholder: "Work experience" })}
        </Section>

        <Section title="Identity & Safety">
          {text("aadhar_number", "Aadhar Number", { placeholder: "12-digit Aadhar" })}
          {text("pan_number", "PAN Number", { placeholder: "PAN card number" })}
          <Field label="ID Proof Type" htmlFor="emp-id_proof_type" required error={errors.id_proof_type?.message}>
            <Select id="emp-id_proof_type" invalid={!!errors.id_proof_type} className="px-3 py-2.5 text-[13px]"
              {...register("id_proof_type")}>
              {idTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          {text("id_proof_number", "ID Proof Number", { placeholder: "Selected ID number" })}
        </Section>

        <Section title="Emergency Contact">
          {text("emergency_contact_name", "Contact Name")}
          {text("emergency_contact_phone", "Contact Phone", { placeholder: "10-digit phone" })}
          {text("emergency_contact_relation", "Relation")}
        </Section>

        <Section title="Payroll & Professional">
          <Field label="Base Salary (₹)" htmlFor="emp-base_salary" required error={errors.base_salary?.message}>
            <Input id="emp-base_salary" type="number" min={0} step="0.01" invalid={!!errors.base_salary}
              className="px-3 py-2.5 text-[13px]" {...register("base_salary", { valueAsNumber: true })} />
          </Field>
          {text("bank_name", "Bank Name")}
          {text("bank_account_number", "Account Number")}
          {text("ifsc_code", "IFSC Code", { placeholder: "e.g. SBIN0001234" })}
          {text("date_of_joining", "Join Date", { type: "date" })}
          <Field label="Role" htmlFor="emp-role" required error={errors.role?.message}>
            <Select id="emp-role" invalid={!!errors.role} className="px-3 py-2.5 text-[13px]" {...register("role")}>
              {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
            </Select>
          </Field>
          <Field label="Status" htmlFor="emp-status" required error={errors.status?.message}>
            <Select id="emp-status" invalid={!!errors.status} className="px-3 py-2.5 text-[13px]" {...register("status")}>
              {FORM_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </Select>
          </Field>
        </Section>

        <div className="form-actions-modern mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>{isEditing ? "Update Employee" : "Register Employee"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <>
      <div className={`mb-4 border-b border-line-light pb-2 text-sm font-extrabold uppercase tracking-[0.05em] text-accent ${first ? "" : "mt-6"}`}>
        {title}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </>
  );
}
