import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { roleApi, useInvalidateRoles } from "@/features/roles/api";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ROLE_LEVELS, type Role, type RoleDetail } from "@/types/role";

const FORM_ID = "role-form";

const schema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(60, "Max 60 characters"),
  description: z.string().trim().max(200, "Max 200 characters"),
  level: z.number(),
  copy_from_id: z.string(),
});
type Values = z.infer<typeof schema>;

interface Props {
  /** null = add. */
  role: Role | null;
  /** Roles to copy access from when adding. */
  roles: Role[];
  onClose: () => void;
  onSaved: (role: RoleDetail) => void;
}

/** Add a gym role (name, level, start from another role's ticks) or rename / re-level one. */
export function RoleFormModal({ role, roles, onClose, onSaved }: Props) {
  const invalidate = useInvalidateRoles();
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: role?.name ?? "", description: role?.description ?? "", level: role?.level ?? 10,
      copy_from_id: "" },
  });
  const level = watch("level");

  const save = useMutation({
    mutationFn: (v: Values) => role
      ? roleApi.update(role.id, { name: v.name, description: v.description || null,
        ...(role.is_system ? {} : { level: v.level }) })
      : roleApi.create({ name: v.name, description: v.description || null, level: v.level,
        copy_from_id: v.copy_from_id || null }),
    onSuccess: async (res) => {
      notify.success(res.message);
      await invalidate();
      onSaved(res.data);
      onClose();
    },
    onError: notify.error,
  });

  return (
    <Modal
      open
      title={role ? "Edit role" : "Add role"}
      subtitle={role ? role.name : "A role is a set of ticks you give staff logins, e.g. Receptionist or Accountant"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>{role ? "Save" : "Add role"}</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="flex flex-col gap-4">
        <Field label="Role name" htmlFor="role-name" required error={errors.name?.message}>
          <Input id="role-name" maxLength={60} placeholder="e.g. Receptionist" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Description" htmlFor="role-desc" error={errors.description?.message}>
          <Textarea id="role-desc" rows={2} maxLength={200} placeholder="What this person does (optional)" {...register("description")} />
        </Field>
        {!role?.is_system && (
          <Field label="Level" required hint="Decides branch reach and who can give this role to a login">
            <Controller name="level" control={control} render={({ field }) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ROLE_LEVELS.map((l) => (
                  <button key={l.value} type="button" onClick={() => field.onChange(l.value)}
                    className={cn("cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors",
                      level === l.value ? "border-accent bg-accent-light" : "border-line bg-surface hover:border-line-accent")}>
                    <span className={cn("block text-sm font-semibold", level === l.value ? "text-accent" : "text-ink")}>{l.label}</span>
                    <span className="block text-xs text-muted">{l.hint}</span>
                  </button>
                ))}
              </div>
            )} />
          </Field>
        )}
        {!role && (
          <Field label="Start with the ticks of" htmlFor="role-copy" hint="You can change every tick after adding">
            <Select id="role-copy" {...register("copy_from_id")}>
              <option value="">The built-in role of this level</option>
              {roles.filter((r) => !r.is_owner).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
