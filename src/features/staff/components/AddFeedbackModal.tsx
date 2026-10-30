import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { staffApi, staffKeys } from "@/features/staff/api";
import { todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";

const RATINGS = [
  { value: 5, label: "5 - Excellent" },
  { value: 4, label: "4 - Very Good" },
  { value: 3, label: "3 - Good" },
  { value: 2, label: "2 - Fair" },
  { value: 1, label: "1 - Poor" },
];

const schema = z.object({
  client_name: z.string().trim().min(1, "Required").max(120),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1, "Required").max(2000),
  feedback_date: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

const empty = (): FormValues => ({ client_name: "", rating: 5, comment: "", feedback_date: todayISO() });

interface Props {
  open: boolean;
  employeeId: string;
  onClose: () => void;
}

/** "Add Client Feedback" — client name, 1–5 rating, comment, date. */
export function AddFeedbackModal({ open, employeeId, onClose }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: empty(),
  });

  useEffect(() => {
    if (open) reset(empty());
  }, [open, reset]);

  const save = useMutation({
    mutationFn: (v: FormValues) => staffApi.addFeedback(employeeId, {
      ...v, client_name: v.client_name.trim(), comment: v.comment.trim(),
    }),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal open={open} title="Add Client Feedback" onClose={onClose} width="500px">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="flex flex-col gap-4 py-2">
        <Field label="Client Name" htmlFor="fb-client" required error={errors.client_name?.message}>
          <Input id="fb-client" placeholder="Name of the client" invalid={!!errors.client_name} {...register("client_name")} />
        </Field>
        <Field label="Rating (1-5)" htmlFor="fb-rating" required error={errors.rating?.message}>
          <Select id="fb-rating" {...register("rating", { setValueAs: (v: string | number) => Number(v) })}>
            {RATINGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Comment" htmlFor="fb-comment" required error={errors.comment?.message}>
          <Textarea id="fb-comment" rows={4} placeholder="Write the feedback here..." invalid={!!errors.comment}
            {...register("comment")} />
        </Field>
        <Field label="Date" htmlFor="fb-date" required error={errors.feedback_date?.message}>
          <Input id="fb-date" type="date" max={todayISO()} invalid={!!errors.feedback_date} {...register("feedback_date")} />
        </Field>
        <div className="form-actions-modern mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save Feedback</Button>
        </div>
      </form>
    </Modal>
  );
}
