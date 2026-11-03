import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Modal";
import { FormDivider, GRID_2 } from "@/components/ui/Section";
import { staffApi, staffKeys } from "@/features/staff/api";
import { makePayrollSchema, toPayrollBody, toPayrollValues, type PayrollFormValues } from "@/features/staff/lib/employee-form";
import { notify } from "@/lib/notify";
import { useCan } from "@/stores/auth-store";
import type { Employee } from "@/types/employee";

const FORM_ID = "employee-payroll-form";

interface PayrollDrawerProps {
  employee: Employee;
  onClose: () => void;
}

/** Payroll & bank details of one employee (PUT /employees/{id}/payroll), opened from the staff list actions. */
export function PayrollDrawer({ employee, onClose }: PayrollDrawerProps) {
  const qc = useQueryClient();
  const canViewPii = useCan("pii:view");
  const schema = useMemo(() => makePayrollSchema(employee), [employee]);
  const { register, handleSubmit, formState: { errors, dirtyFields } } = useForm<PayrollFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: toPayrollValues(employee),
  });

  const save = useMutation({
    mutationFn: (v: PayrollFormValues) => staffApi.payroll(employee.id, toPayrollBody(v, !!dirtyFields.bank_account_number)),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  const masked = !canViewPii && !!employee.bank_account_number;

  return (
    <Drawer
      open
      title="Payroll & bank details"
      subtitle={`${employee.name} · ${employee.employee_code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>Save payroll</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        <FormDivider>Salary</FormDivider>
        <Field label="Base salary (₹ per month)" htmlFor="pay-salary" required error={errors.base_salary?.message}
          hint="Used to calculate the monthly payroll from attendance">
          <Input id="pay-salary" type="number" min={0} step="0.01" placeholder="e.g. 25000" invalid={!!errors.base_salary}
            {...register("base_salary", { valueAsNumber: true })} />
        </Field>

        <FormDivider>Bank account</FormDivider>
        <p className="m-0 mb-4 text-[13px] text-muted">
          Leave all three empty if this person is paid in cash.
          {masked && " The account number is masked; it's kept unless you type a new one."}
        </p>
        <div className={GRID_2}>
          <Field label="Bank name" htmlFor="pay-bank" error={errors.bank_name?.message} className="md:col-span-2">
            <Input id="pay-bank" placeholder="e.g. State Bank of India" invalid={!!errors.bank_name} {...register("bank_name")} />
          </Field>
          <Field label="Account number" htmlFor="pay-account" error={errors.bank_account_number?.message}>
            <Input id="pay-account" placeholder="6–20 letters / digits" autoComplete="off" invalid={!!errors.bank_account_number}
              {...register("bank_account_number")} />
          </Field>
          <Field label="IFSC code" htmlFor="pay-ifsc" error={errors.ifsc_code?.message}>
            <Input id="pay-ifsc" placeholder="e.g. SBIN0001234" autoComplete="off" invalid={!!errors.ifsc_code}
              {...register("ifsc_code")} />
          </Field>
        </div>

        <FormDivider>UPI</FormDivider>
        <Field label="UPI ID" htmlFor="pay-upi" error={errors.upi_id?.message}
          hint="Optional — for paying salary by UPI (GPay, PhonePe, Paytm)">
          <Input id="pay-upi" placeholder="e.g. ravi.kumar@okaxis" autoComplete="off" inputMode="email"
            invalid={!!errors.upi_id} {...register("upi_id")} />
        </Field>
      </form>
    </Drawer>
  );
}
