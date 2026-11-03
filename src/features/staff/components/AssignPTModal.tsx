import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { GRID_2 } from "@/components/ui/Section";
import { useMemberLookup, usePlanLookup } from "@/features/lookups/api";
import { FitnessGoalSelect, requiredGoalField } from "@/features/lookups/fitness-goals";
import { staffApi, staffKeys } from "@/features/staff/api";
import { formatINR, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";

const FORM_ID = "assign-pt-form";

const schema = z.object({
  member_id: z.string().min(1, "Select a member"),
  plan_id: z.string().min(1, "Select a PT plan"),
  goal: requiredGoalField("Select the training goal"),
  start_date: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

const empty = (): FormValues => ({ member_id: "", plan_id: "", goal: "", start_date: todayISO() });

interface Props {
  open: boolean;
  trainerId: string;
  trainerName?: string;
  onClose: () => void;
}

/** "Assign member for PT" — subscribes a member to a PT plan with this employee as trainer. */
export function AssignPTModal({ open, trainerId, trainerName, onClose }: Props) {
  const qc = useQueryClient();
  const members = useMemberLookup(open);
  const plans = usePlanLookup("ADD_ON", open);
  const ptPlans = (plans.data ?? []).filter((p) => p.service_type === "PERSONAL_TRAINING");
  const activeMembers = (members.data ?? []).filter((m) => m.status === "ACTIVE");

  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors, dirtyFields } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: empty(),
  });

  useEffect(() => {
    if (open) reset(empty());
  }, [open, reset]);

  // Start from the member's own goal; once the trainer picks one by hand, member changes leave it alone.
  const memberId = watch("member_id");
  const memberGoal = activeMembers.find((m) => m.id === memberId)?.fitness_goal;
  useEffect(() => {
    if (memberGoal && !dirtyFields.goal) setValue("goal", memberGoal, { shouldValidate: true });
  }, [memberGoal, dirtyFields.goal, setValue]);

  const assign = useMutation({
    mutationFn: (v: FormValues) => staffApi.assignPT({ ...v, goal: v.goal || null, trainer_id: trainerId }),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal
      open={open}
      title="Assign member for PT"
      subtitle={trainerName ? `Trainer: ${trainerName}` : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={assign.isPending}>Assign member</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => assign.mutate(v))} noValidate className="flex flex-col gap-4">
        <Field label="Member" htmlFor="pt-member" required error={errors.member_id?.message}>
          <Select id="pt-member" invalid={!!errors.member_id} {...register("member_id")}>
            <option value="">{members.isLoading ? "Loading members…" : "Select a member"}</option>
            {activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>)}
          </Select>
        </Field>
        <Field label="PT plan" htmlFor="pt-plan" required error={errors.plan_id?.message}
          hint={!plans.isLoading && ptPlans.length === 0 ? "No personal training plans in this branch." : undefined}>
          <Select id="pt-plan" invalid={!!errors.plan_id} {...register("plan_id")}>
            <option value="">{plans.isLoading ? "Loading plans…" : "Select a plan"}</option>
            {ptPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.total_sessions} sessions · {p.duration_days} days · {formatINR(p.price, true)}
              </option>
            ))}
          </Select>
        </Field>
        <div className={GRID_2}>
          <Field label="Goal" htmlFor="pt-goal" required error={errors.goal?.message}>
            <Controller name="goal" control={control} render={({ field }) => (
              <FitnessGoalSelect id="pt-goal" value={field.value} onChange={field.onChange}
                onBlur={field.onBlur} invalid={!!errors.goal} />
            )} />
          </Field>
          <Field label="Start date" htmlFor="pt-start" required error={errors.start_date?.message}>
            <Input id="pt-start" type="date" invalid={!!errors.start_date} {...register("start_date")} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
