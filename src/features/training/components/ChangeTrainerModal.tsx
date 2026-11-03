import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useTrainerLookup } from "@/features/lookups/api";
import { trainingApi, trainingKeys } from "@/features/training/api";
import { notify } from "@/lib/notify";
import { useBranchStore } from "@/stores/branch-store";
import type { PTSubscription } from "@/types/training";

const FORM_ID = "pt-change-trainer-form";

const schema = z.object({ trainer_id: z.string().uuid("Select a trainer") });
type FormValues = z.infer<typeof schema>;

/** "Change trainer" — reassigns the PT subscription to another active trainer. */
export function ChangeTrainerModal({ pt, onClose }: { pt: PTSubscription; onClose: () => void }) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const trainers = useTrainerLookup();
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { trainer_id: pt.trainer_id ?? "" },
  });

  const update = useMutation({
    mutationFn: (v: FormValues) => trainingApi.changeTrainer(pt.id, v),
    onSuccess: async (res) => {
      notify.success(res.message);
      onClose();
      await qc.invalidateQueries({ queryKey: trainingKeys.all(branch) });
    },
    onError: notify.error,
  });

  return (
    <Modal
      open
      title="Change trainer"
      subtitle={`${pt.member_name} · ${pt.registration_id}`}
      onClose={onClose}
      width="460px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={update.isPending}>Change trainer</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => update.mutate(v))} noValidate>
        <Field label="New trainer" htmlFor="pt-new-trainer" required error={errors.trainer_id?.message}
          hint={`Currently ${pt.trainer_name}. Future sessions are logged against the new trainer.`}>
          <Controller control={control} name="trainer_id" render={({ field }) => (
            <Select id="pt-new-trainer" invalid={!!errors.trainer_id} value={field.value}
              onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}>
              <option value="">{trainers.isLoading ? "Loading trainers…" : "Select a trainer"}</option>
              {(trainers.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>
              ))}
            </Select>
          )} />
        </Field>
      </form>
    </Modal>
  );
}
