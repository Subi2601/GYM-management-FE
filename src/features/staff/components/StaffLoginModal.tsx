import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { staffApi, staffKeys } from "@/features/staff/api";
import { LoginCredentialsModal, type Credentials } from "@/features/staff/components/LoginCredentialsModal";
import { PasswordField } from "@/features/staff/components/PasswordField";
import { generatePassword, passwordField } from "@/features/staff/lib/staff-login";
import { RoleSelect } from "@/features/roles/components/RoleSelect";
import { notify } from "@/lib/notify";
import type { Employee, StaffLogin } from "@/types/employee";

const FORM_ID = "staff-login-form";

interface Props {
  employee: Employee;
  login: StaffLogin;
  onClose: () => void;
}

/** Give a staff login / change its access (gym role) / reset its password. Login ID = their email. */
export function StaffLoginModal({ employee, login, onClose }: Props) {
  const qc = useQueryClient();
  const isNew = !login.has_login;
  const [creds, setCreds] = useState<Credentials | null>(null);
  const schema = z.object({
    password: isNew ? passwordField : z.union([z.literal(""), passwordField]),
  });
  // The server fills role_id with the login's role, or the default one for a new login.
  const [roleId, setRoleId] = useState(login.role_id ?? "");
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: isNew ? generatePassword() : "" },
  });

  const save = useMutation({
    mutationFn: (v: Values) => staffApi.saveLogin(employee.id, { role_id: roleId || null, password: v.password || null }),
    onSuccess: async (res, v) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      if (v.password) {
        setCreds({ name: employee.name, phone: employee.phone, email: res.data.email ?? employee.email ?? "",
          password: v.password, branch: res.data.branch_name });
      } else {
        onClose();
      }
    },
    onError: notify.error,
  });

  if (creds) return <LoginCredentialsModal creds={creds} onClose={onClose} />;

  return (
    <Modal
      open
      title={isNew ? "Give app login" : login.enabled ? "Reset password" : "Enable login"}
      subtitle={`${employee.name} · Login ID ${login.email ?? employee.email ?? "—"} · ${login.branch_name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>
            {isNew ? "Create login" : login.enabled ? "Save" : "Enable login"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="flex flex-col gap-4">
        <Field label="Access (role)" htmlFor="sl-role" required hint="What each role can do is set on Roles & Access">
          <RoleSelect id="sl-role" value={roleId} currentName={login.role_name} onChange={setRoleId} />
        </Field>
        <Field label={isNew ? "Password" : "New password"} htmlFor="sl-password" required={isNew}
          error={errors.password?.message}
          hint={isNew ? "You'll share this with them; they can change it after signing in" : "Leave empty to keep the current password"}>
          <PasswordField id="sl-password" maxLength={72} placeholder={isNew ? "" : "Type or generate a new password"}
            invalid={!!errors.password} {...register("password")}
            onGenerate={() => setValue("password", generatePassword(), { shouldValidate: true })} />
        </Field>
      </form>
    </Modal>
  );
}
