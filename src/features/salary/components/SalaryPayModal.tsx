import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { GRID_2, InfoRow } from "@/components/ui/Section";
import { salaryApi, salaryKeys } from "@/features/salary/api";
import { PAYMENT_LABELS } from "@/features/salary/lib/salary";
import { formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import { PAYMENT_MODES } from "@/types/enums";
import type { Salary } from "@/types/salary";

const FORM_ID = "salary-pay-form";

const paySchema = z.object({
  payment_method: z.enum(PAYMENT_MODES),
  paid_date: z.string().min(1, "Required"),
});
type PayValues = z.infer<typeof paySchema>;

/** "Record payment" for one PENDING salary row (PUT /salary/{id}/pay). */
export function SalaryPayModal({ salary, onClose }: { salary: Salary; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<PayValues>({
    resolver: zodResolver(paySchema),
    defaultValues: { payment_method: "CASH", paid_date: todayISO() },
  });

  const pay = useMutation({
    mutationFn: (v: PayValues) => salaryApi.pay(salary.id, v),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: salaryKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal
      open
      title="Record payment"
      subtitle={`${salary.employee_name} · ${salary.employee_code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={pay.isPending}>Confirm payment</Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-4 rounded-xl border border-line-light bg-subtle px-4 py-3.5">
        <InfoRow label="Net salary" value={<span className="text-lg font-extrabold text-success">{formatINR(salary.net_salary)}</span>} />
        <InfoRow label="Month" value={salary.month_year} />
      </div>
      <form id={FORM_ID} onSubmit={handleSubmit((v) => pay.mutate(v))} noValidate className={GRID_2}>
        <Field label="Payment method" htmlFor="pay-method" required error={errors.payment_method?.message}>
          <Select id="pay-method" {...register("payment_method")}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_LABELS[m]}</option>)}
          </Select>
        </Field>
        <Field label="Paid date" htmlFor="pay-date" required error={errors.paid_date?.message}>
          <Input id="pay-date" type="date" invalid={!!errors.paid_date} {...register("paid_date")} />
        </Field>
      </form>
    </Modal>
  );
}
