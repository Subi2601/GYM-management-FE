import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { FormPage } from "@/components/ui/FormPage";
import { PageLoader } from "@/components/ui/Loaders";
import { GRID_2, GRID_3, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys } from "@/features/staff/api";
import { FORM_STATUSES, ID_PROOF_TYPES, makeEmployeeSchema, toEmployeeBody, toEmployeeValues,
  type EmployeeFormKey, type EmployeeFormValues } from "@/features/staff/lib/employee-form";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Employee, EmployeeInput, EmployeeUpdate } from "@/types/employee";
import { EMPLOYEE_ROLES } from "@/types/enums";

const FORM_ID = "employee-form";

/** /staff/new and /staff/:id/edit — loads the employee (GET /employees/{id}), then renders the sectioned form. */
export function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  const branch = useBranchStore((s) => s.selectedBranchId);

  const employee = useQuery({
    queryKey: staffKeys.detail(branch, id ?? ""),
    queryFn: () => staffApi.get(id!),
    enabled: !!id,
  });

  if (branch === null) {
    return (
      <FormPage title={id ? "Edit employee" : "New employee"} backTo="/staff" backLabel="Staff">
        <p className="text-sm text-muted">Select a branch to add or edit staff.</p>
      </FormPage>
    );
  }
  if (id && employee.isLoading) return <PageLoader />;
  const e = employee.data?.data ?? null;
  if (id && !e) {
    return (
      <FormPage title="Employee not found" backTo="/staff" backLabel="Staff">
        <p className="text-sm text-muted">{employee.error?.message ?? "This employee does not exist in the selected branch."}</p>
      </FormPage>
    );
  }
  if (e?.status === "TERMINATED") {
    return (
      <FormPage title={e.name} backTo="/staff?tab=archive" backLabel="Staff">
        <p className="text-sm text-muted">This employee has been terminated and can no longer be edited.</p>
      </FormPage>
    );
  }
  // key: a different employee starts the form clean.
  return <EmployeeForm key={e?.id ?? "new"} employee={e} />;
}

function EmployeeForm({ employee }: { employee: Employee | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canViewPii = useCan("pii:view");
  const schema = useMemo(() => makeEmployeeSchema(employee), [employee]);
  const toList = () => navigate("/staff");

  const { register, handleSubmit, formState: { errors, dirtyFields } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: toEmployeeValues(employee),
  });

  const save = useMutation({
    mutationFn: (req: { id: null; body: EmployeeInput } | { id: string; body: EmployeeUpdate }) =>
      req.id === null ? staffApi.create(req.body) : staffApi.update(req.id, req.body),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      toList();
    },
    onError: notify.error,
  });

  const onSubmit = (v: EmployeeFormValues) => {
    const payload = toEmployeeBody(v);
    if (!employee) {
      save.mutate({ id: null, body: payload });
      return;
    }
    // Only what the user changed — masked PII the user didn't touch is never echoed back.
    const changed: EmployeeUpdate = {};
    (Object.keys(dirtyFields) as EmployeeFormKey[]).forEach((k) => {
      if (dirtyFields[k]) Object.assign(changed, { [k]: payload[k] });
    });
    if (Object.keys(changed).length === 0) {
      toList();
      return;
    }
    save.mutate({ id: employee.id, body: changed });
  };

  const idTypes = employee?.id_proof_type && !ID_PROOF_TYPES.includes(employee.id_proof_type)
    ? [...ID_PROOF_TYPES, employee.id_proof_type] : ID_PROOF_TYPES;

  const text = (name: EmployeeFormKey, label: string,
    opts: { required?: boolean; placeholder?: string; type?: string; inputMode?: "numeric" | "email"; maxLength?: number;
      className?: string } = {}) => (
    <Field label={label} htmlFor={`emp-${name}`} required={opts.required ?? true} error={errors[name]?.message}
      className={opts.className}>
      <Input id={`emp-${name}`} type={opts.type ?? "text"} placeholder={opts.placeholder} inputMode={opts.inputMode}
        maxLength={opts.maxLength} autoComplete="off" invalid={!!errors[name]} {...register(name)} />
    </Field>
  );

  return (
    <FormPage
      title={employee ? "Edit employee" : "New employee"}
      subtitle={employee
        ? <span className="inline-flex flex-wrap items-center gap-2">{employee.name} · {employee.employee_code}
            <StatusBadge value={employee.status} /></span>
        : "Register a staff member with identity, emergency contact and payroll details"}
      backTo="/staff"
      backLabel="Staff"
      actions={
        <>
          <Button variant="secondary" onClick={toList}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>
            {employee ? "Save changes" : "Register employee"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Section title="Personal details" description="Contact information, role and joining date">
          <div className={GRID_3}>
            {text("name", "Full name", { placeholder: "Enter name" })}
            {text("phone", "Phone number", { placeholder: "10-digit mobile", inputMode: "numeric", maxLength: 10 })}
            {text("email", "Email", { placeholder: "name@example.com", type: "email", inputMode: "email" })}
            <Field label="Role" htmlFor="emp-role" required error={errors.role?.message}>
              <Select id="emp-role" invalid={!!errors.role} {...register("role")}>
                {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
              </Select>
            </Field>
            {text("date_of_joining", "Date of joining", { type: "date" })}
            <Field label="Status" htmlFor="emp-status" required error={errors.status?.message}>
              <Select id="emp-status" invalid={!!errors.status} {...register("status")}>
                {FORM_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </Field>
            {text("education", "Education", { required: false, placeholder: "e.g. B.Sc. Physical Education" })}
            {text("experience", "Experience", { required: false, placeholder: "e.g. 3 years as a trainer" })}
            <Field label="Address" htmlFor="emp-address" required error={errors.address?.message}
              className="md:col-span-2 lg:col-span-3">
              <Textarea id="emp-address" rows={2} placeholder="Full residential address" invalid={!!errors.address}
                {...register("address")} />
            </Field>
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="Identity & safety"
            description={employee && !canViewPii ? "Masked values are kept unless you replace them" : "Government ID details"}>
            <div className={GRID_2}>
              {text("aadhar_number", "Aadhar number", { placeholder: "12-digit Aadhar", inputMode: "numeric" })}
              {text("pan_number", "PAN number", { placeholder: "e.g. ABCDE1234F" })}
              <Field label="ID proof type" htmlFor="emp-id_proof_type" required error={errors.id_proof_type?.message}>
                <Select id="emp-id_proof_type" invalid={!!errors.id_proof_type} {...register("id_proof_type")}>
                  {idTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              {text("id_proof_number", "ID proof number", { placeholder: "Number on the selected ID" })}
            </div>
          </Section>

          <Section title="Emergency contact" description="Who to call in an emergency">
            <div className={GRID_2}>
              {text("emergency_contact_name", "Contact name", { placeholder: "Name of relative / friend" })}
              {text("emergency_contact_relation", "Relation", { placeholder: "e.g. Spouse, Father" })}
              {text("emergency_contact_phone", "Contact phone", { placeholder: "10-digit mobile", inputMode: "numeric",
                maxLength: 10 })}
            </div>
          </Section>
        </div>

        <Section title="Payroll & bank" description="Monthly base salary and the account it is paid into">
          <div className={GRID_2}>
            <Field label="Base salary (₹)" htmlFor="emp-base_salary" required error={errors.base_salary?.message}>
              <Input id="emp-base_salary" type="number" min={0} step="0.01" placeholder="e.g. 25000"
                invalid={!!errors.base_salary} {...register("base_salary", { valueAsNumber: true })} />
            </Field>
            {text("bank_name", "Bank name", { placeholder: "e.g. State Bank of India" })}
            {text("bank_account_number", "Account number", { placeholder: "6–20 letters / digits" })}
            {text("ifsc_code", "IFSC code", { placeholder: "e.g. SBIN0001234" })}
          </div>
        </Section>
      </form>
    </FormPage>
  );
}
