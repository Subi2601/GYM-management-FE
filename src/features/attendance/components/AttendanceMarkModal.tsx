import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { attendanceApi, attendanceKeys } from "@/features/attendance/api";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import type { UnmarkedEmployee } from "@/types/attendance";
import { ATTENDANCE_STATUSES } from "@/types/enums";

const FORM_ID = "attendance-mark-form";

const markSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  notes: z.string().trim().max(300, "Max 300 characters"),
});
type MarkValues = z.infer<typeof markSchema>;

interface Props {
  employee: UnmarkedEmployee;
  date: string;
  onClose: () => void;
}

/** Mark one employee's attendance for the selected date (POST /attendance/mark). */
export function AttendanceMarkModal({ employee, date, onClose }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<MarkValues>({
    resolver: zodResolver(markSchema),
    defaultValues: { status: "PRESENT", notes: "" },
  });

  const mark = useMutation({
    mutationFn: (v: MarkValues) => attendanceApi.mark({
      employee_id: employee.id, status: v.status, notes: v.notes.trim() || null, date,
    }),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: attendanceKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal
      open
      title="Mark attendance"
      subtitle={`${employee.name} · ${employee.employee_code} · ${formatDate(date)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={mark.isPending}>Mark attendance</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => mark.mutate(v))} noValidate className="flex flex-col gap-4">
        <Field label="Status" htmlFor="att-status" required error={errors.status?.message}>
          <Select id="att-status" {...register("status")}>
            {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="att-notes" error={errors.notes?.message}>
          <Textarea id="att-notes" rows={3} placeholder="Any comments (optional)" invalid={!!errors.notes} {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
