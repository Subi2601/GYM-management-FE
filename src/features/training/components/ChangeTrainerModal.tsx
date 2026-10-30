import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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

const schema = z.object({ trainer_id: z.string().uuid("Select a trainer") });
type FormValues = z.infer<typeof schema>;

/** "Update Trainer" — reassigns the PT subscription to another active trainer. */
export function ChangeTrainerModal({ pt, onClose }: { pt: PTSubscription | null; onClose: () => void }) {
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const trainers = useTrainerLookup(pt !== null);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (pt) reset({ trainer_id: pt.trainer_id ?? "" });
  }, [pt, reset]);

  const update = useMutation({
    mutationFn: (v: FormValues) => trainingApi.changeTrainer(pt!.id, v),
    onSuccess: async (res) => {
      notify.success(res.message);
      close();
      await qc.invalidateQueries({ queryKey: trainingKeys.all(branch) });
    },
    onError: notify.error,
  });

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal open={pt !== null} title={`Update Trainer: ${pt?.member_name ?? ""}`} onClose={close} width="500px">
      <form onSubmit={handleSubmit((v) => update.mutate(v))} noValidate>
        <Field label="Select New Trainer" htmlFor="pt-new-trainer" required error={errors.trainer_id?.message}
          hint="This will reassign all future sessions to this trainer.">
          <Controller control={control} name="trainer_id" render={({ field }) => (
            <Select id="pt-new-trainer" invalid={!!errors.trainer_id} value={field.value ?? ""}
              onChange={field.onChange} onBlur={field.onBlur} ref={field.ref}>
              <option value="">{trainers.isLoading ? "Loading trainers…" : "Select trainer"}</option>
              {(trainers.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.employee_code})</option>
              ))}
            </Select>
          )} />
        </Field>
        <div className="form-actions-modern">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" loading={update.isPending}>Update Trainer</Button>
        </div>
      </form>
    </Modal>
  );
}
