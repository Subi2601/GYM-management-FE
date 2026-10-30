import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useMemberLookup, usePlanLookup } from "@/features/lookups/api";
import { staffApi, staffKeys } from "@/features/staff/api";
import { formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";

const schema = z.object({
  member_id: z.string().min(1, "Select a member"),
  plan_id: z.string().min(1, "Select a PT plan"),
  goal: z.string().trim().min(1, "Required").max(200),
  start_date: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

const empty = (): FormValues => ({ member_id: "", plan_id: "", goal: "", start_date: todayISO() });

interface Props {
  open: boolean;
  trainerId: string;
  onClose: () => void;
}

/** "Assign Member for PT" — subscribes a member to a PT plan with this employee as trainer. */
export function AssignPTModal({ open, trainerId, onClose }: Props) {
  const qc = useQueryClient();
  const members = useMemberLookup(open);
  const plans = usePlanLookup("ADD_ON", open);
  const ptPlans = (plans.data ?? []).filter((p) => p.service_type === "PERSONAL_TRAINING");
  const activeMembers = (members.data ?? []).filter((m) => m.status === "ACTIVE");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: empty(),
  });

  useEffect(() => {
    if (open) reset(empty());
  }, [open, reset]);

  const assign = useMutation({
    mutationFn: (v: FormValues) => staffApi.assignPT({ ...v, goal: v.goal.trim(), trainer_id: trainerId }),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal open={open} title="Assign Member for PT" onClose={onClose} width="500px">
      <form onSubmit={handleSubmit((v) => assign.mutate(v))} noValidate className="flex flex-col gap-4 py-2">
        <Field label="Select Member" htmlFor="pt-member" required error={errors.member_id?.message}>
          <Select id="pt-member" invalid={!!errors.member_id} {...register("member_id")}>
            <option value="">{members.isLoading ? "Loading members…" : "Select a member"}</option>
            {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>)}
          </Select>
        </Field>
        <Field label="PT Plan" htmlFor="pt-plan" required error={errors.plan_id?.message}
          hint={!plans.isLoading && ptPlans.length === 0 ? "No Personal Training plans in this branch." : undefined}>
          <Select id="pt-plan" invalid={!!errors.plan_id} {...register("plan_id")}>
            <option value="">{plans.isLoading ? "Loading plans…" : "Select a plan"}</option>
            {ptPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.total_sessions} sessions · {p.duration_days} days · {formatINR(p.price, true)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Goal" htmlFor="pt-goal" required error={errors.goal?.message}>
          <Input id="pt-goal" placeholder="e.g. Weight Loss, Muscle Gain" invalid={!!errors.goal} {...register("goal")} />
        </Field>
        <Field label="Start Date" htmlFor="pt-start" required error={errors.start_date?.message}>
          <Input id="pt-start" type="date" invalid={!!errors.start_date} {...register("start_date")} />
        </Field>
        <div className="form-actions-modern mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={assign.isPending}>Assign</Button>
        </div>
      </form>
    </Modal>
  );
}
