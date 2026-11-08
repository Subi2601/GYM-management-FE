import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, Input, READONLY_INPUT, Select, Textarea } from "@/components/ui/Field";
import { FormPage } from "@/components/ui/FormPage";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { GRID_2, GRID_3, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys } from "@/features/staff/api";
import { LoginCredentialsModal, type Credentials } from "@/features/staff/components/LoginCredentialsModal";
import { PasswordField } from "@/features/staff/components/PasswordField";
import { FORM_STATUSES, makeEmployeeSchema, toEmployeeBody, toEmployeeValues,
  type EmployeeFormKey, type EmployeeFormValues } from "@/features/staff/lib/employee-form";
import { generatePassword, NO_LOGIN_ROLES, passwordField } from "@/features/staff/lib/staff-login";
import { defaultRoleCode, useAssignableRoles } from "@/features/roles/api";
import { RoleSelect } from "@/features/roles/components/RoleSelect";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { humanize } from "@/lib/utils";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Employee, EmployeeInput, EmployeeUpdate } from "@/types/employee";
import { EMPLOYEE_ROLES } from "@/types/enums";

const FORM_ID = "employee-form";

/** /staff/new and /staff/:id/edit — loads the employee (GET /employees/{id}), then renders the sectioned form. */
export function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  const branch = useBranchStore((s) => s.selectedBranchId);

  const employee = useQuery({
    queryKey: staffKeys.detail(branch, id ?? ""),
    queryFn: () => staffApi.get(id!),
    enabled: !!id,
  });

  // Adding works from "All Branches" (the form asks for the branch); editing needs the employee's branch selected.
  if (id && branch === null) {
    return (
      <FormPage title="Edit employee" backTo="/staff" backLabel="Staff">
        <p className="text-sm text-muted">Select a branch to edit staff.</p>
      </FormPage>
    );
  }
  if (id && employee.isLoading) return <PageLoader />;
  const e = employee.data?.data ?? null;
  if (id && !e) {
    return (
      <FormPage title="Employee not found" backTo="/staff" backLabel="Staff">
        <p className="text-sm text-muted">{employee.error?.message ?? "This employee does not exist in the selected branch."}</p>
      </FormPage>
    );
  }
  if (e?.status === "TERMINATED") {
    return (
      <FormPage title={e.name} backTo="/staff?tab=archive" backLabel="Staff">
        <p className="text-sm text-muted">This employee has been terminated and can no longer be edited.</p>
      </FormPage>
    );
  }
  // key: a different employee starts the form clean.
  return <EmployeeForm key={e?.id ?? "new"} employee={e} />;
}

function EmployeeForm({ employee }: { employee: Employee | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canViewPii = useCan("pii:view");
  const schema = useMemo(() => makeEmployeeSchema(employee), [employee]);
  const toList = () => navigate("/staff");

  const { register, handleSubmit, setError, watch, formState: { errors, dirtyFields } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: toEmployeeValues(employee),
  });

  // ── branch (new staff): picked when "All Branches" is selected, otherwise fixed to the selected branch ──
  const me = useAuthStore((s) => s.me);
  const branch = useBranchStore((s) => s.selectedBranchId);
  const [branchId, setBranchId] = useState(branch ?? "");
  const [branchError, setBranchError] = useState<string>();
  const branchName = me?.branches.find((b) => b.id === (branch ?? branchId))?.branch_name;

  // ── app login ──
  // Login ID = the staff email; access = a gym role (Roles & Access) picked here, defaulting from the staff role.
  // Add: optional new login. Edit: give one, reset the password (empty = keep), or switch it off.
  const canLogin = useCan("employee:login");
  const existing = useQuery({
    queryKey: staffKeys.login(branch, employee?.id ?? ""),
    queryFn: async () => (await staffApi.login(employee!.id)).data,
    enabled: canLogin && !!employee,
  });
  const current = existing.data;            // edit only
  const hasLogin = !!current?.has_login;
  const [login, setLogin] = useState({ on: false, password: employee ? "" : generatePassword() });
  const [loginError, setLoginError] = useState<string>();
  const [creds, setCreds] = useState<Credentials | null>(null);
  const staffRole = watch("role");
  const assignable = useAssignableRoles(canLogin);
  const [roleId, setRoleId] = useState("");
  const [roleTouched, setRoleTouched] = useState(false);
  // Edit: the login's role. Add: follow the staff role (Manager / Staff) until the owner picks one.
  useEffect(() => {
    if (roleTouched) return;
    if (current?.has_login && current.role_id) setRoleId(current.role_id);
    else {
      const code = defaultRoleCode(staffRole);
      const fallback = assignable.data?.find((r) => r.code === code) ?? assignable.data?.[assignable.data.length - 1];
      setRoleId(fallback?.id ?? "");
    }
  }, [roleTouched, current, staffRole, assignable.data]);
  // Add: desk / trainers usually sign in, cleaners don't — follow the role until the owner flips the switch.
  // Edit: start from the login as it is.
  const [loginTouched, setLoginTouched] = useState(false);
  useEffect(() => {
    if (loginTouched) return;
    if (!employee) setLogin((l) => ({ ...l, on: !NO_LOGIN_ROLES.includes(staffRole) }));
    else if (current) setLogin({ on: current.has_login && current.enabled, password: "" });
  }, [staffRole, loginTouched, employee, current]);
  const editLogin = (patch: Partial<typeof login>) => {
    setLoginTouched(true);
    setLoginError(undefined);
    setLogin((l) => {
      const next = { ...l, ...patch };
      // Turning on a brand-new login → start with a generated password.
      if (patch.on && !hasLogin && !next.password) next.password = generatePassword();
      return next;
    });
  };

  /** What the login part of this save must do (null = nothing). */
  const loginAction = (): "save" | "disable" | null => {
    if (!canLogin) return null;
    if (!employee) return login.on ? "save" : null;
    if (!current) return null;
    if (login.on) {
      return !current.has_login || !current.enabled || login.password || (roleId && roleId !== current.role_id)
        ? "save" : null;
    }
    return current.has_login && current.enabled ? "disable" : null;
  };

  const save = useMutation({
    mutationFn: async (req: { id: null; body: EmployeeInput } | { id: string; body: EmployeeUpdate | null }) => {
      if (req.id === null) return (await staffApi.create(req.body, branchId || undefined));
      return req.body ? staffApi.update(req.id, req.body) : null;   // null = only the login changed
    },
    onSuccess: async (res) => {
      if (res) notify.success(res.message);
      const emp = res?.data ?? employee!;
      const action = loginAction();
      let shared = false;
      try {
        if (action === "save") {
          const made = await staffApi.saveLogin(emp.id, { role_id: roleId || null, password: login.password || null },
            employee ? undefined : branchId || undefined);
          notify.success(made.message);
          if (login.password) {
            setCreds({ name: emp.name, phone: emp.phone, email: made.data.email ?? emp.email ?? "",
              password: login.password, branch: made.data.branch_name });
            shared = true;
          }
        } else if (action === "disable") {
          notify.success((await staffApi.disableLogin(emp.id)).message);
        }
      } catch (err) {
        notify.error(err);   // staff saved; the login can be fixed from the details page
        await qc.invalidateQueries({ queryKey: staffKeys.all });
        navigate(`/staff/${emp.id}`);
        return;
      }
      await qc.invalidateQueries({ queryKey: staffKeys.all });
      if (!shared) toList();
    },
    onError: (err) => {
      notify.error(err);
      // A phone already used by another employee (409) is also shown on the field itself.
      if (/phone number already exists/i.test(err.message)) setError("phone", { message: err.message }, { shouldFocus: true });
    },
  });

  const onSubmit = async (v: EmployeeFormValues) => {
    const payload = toEmployeeBody(v);
    const action = loginAction();
    if (action === "save" && (login.password || !hasLogin)) {
      const check = passwordField.safeParse(login.password);
      if (!check.success) {
        setLoginError(check.error.issues[0]?.message);
        return;
      }
    }
    if (!employee) {
      if (!branchId) {
        setBranchError("Choose the branch this staff member works at");
        return;
      }
      save.mutate({ id: null, body: payload });
      return;
    }
    if (action === "disable" && !(await confirm(`Switch off ${employee.name}'s login? They'll be signed out right away.`))) {
      return;
    }
    // Only what the user changed — masked PII the user didn't touch is never echoed back.
    const changed: EmployeeUpdate = {};
    (Object.keys(dirtyFields) as EmployeeFormKey[]).forEach((k) => {
      if (dirtyFields[k]) Object.assign(changed, { [k]: payload[k] });
    });
    const profileChanged = Object.keys(changed).length > 0;
    if (!profileChanged && !action) {
      toList();
      return;
    }
    save.mutate({ id: employee.id, body: profileChanged ? changed : null });
  };

  const shiftError = (from: EmployeeFormKey, to: EmployeeFormKey) => errors[from]?.message ?? errors[to]?.message;

  const text = (name: EmployeeFormKey, label: string,
    opts: { required?: boolean; placeholder?: string; type?: string; inputMode?: "numeric" | "email"; maxLength?: number;
      className?: string } = {}) => (
    <Field label={label} htmlFor={`emp-${name}`} required={opts.required ?? true} error={errors[name]?.message}
      className={opts.className}>
      <Input id={`emp-${name}`} type={opts.type ?? "text"} placeholder={opts.placeholder} inputMode={opts.inputMode}
        maxLength={opts.maxLength} autoComplete="off" invalid={!!errors[name]} {...register(name)} />
    </Field>
  );

  return (
    <FormPage
      title={employee ? "Edit employee" : "New employee"}
      subtitle={employee
        ? <span className="inline-flex flex-wrap items-center gap-2">{employee.name} · {employee.employee_code}
            <StatusBadge value={employee.status} /></span>
        : "Register a staff member with identity, emergency contact and work timings. Set payroll from the staff list."}
      backTo="/staff"
      backLabel="Staff"
      actions={
        <>
          <Button variant="secondary" onClick={toList}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending}>
            {employee ? "Save changes" : "Register employee"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Section title="Personal details" description="Contact information, role and joining date">
          <div className={GRID_3}>
            {!employee && (
              <Field label="Branch" htmlFor="emp-branch" required error={branchError}
                hint={branch ? "Selected in the sidebar" : "Staff and their login belong to this branch"}>
                {branch ? (
                  <Select id="emp-branch" value={branch} disabled className={READONLY_INPUT}>
                    <option value={branch}>{branchName ?? "Current branch"}</option>
                  </Select>
                ) : (
                  <Select id="emp-branch" value={branchId} invalid={!!branchError}
                    onChange={(e) => { setBranchId(e.target.value); setBranchError(undefined); }}>
                    <option value="">Select a branch</option>
                    {(me?.branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                  </Select>
                )}
              </Field>
            )}
            {text("name", "Full name", { placeholder: "Enter name", maxLength: 120 })}
            {text("phone", "Phone number", { placeholder: "10-digit mobile", inputMode: "numeric", maxLength: 10 })}
            {text("email", "Email", { placeholder: "name@example.com", type: "email", inputMode: "email", maxLength: 150 })}
            <Field label="Role" htmlFor="emp-role" required error={errors.role?.message}>
              <Select id="emp-role" invalid={!!errors.role} {...register("role")}>
                {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
              </Select>
            </Field>
            {text("date_of_joining", "Date of joining", { type: "date" })}
            <Field label="Status" htmlFor="emp-status" required error={errors.status?.message}>
              <Select id="emp-status" invalid={!!errors.status} {...register("status")}>
                {FORM_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            </Field>
            {text("education", "Education", { required: false, placeholder: "e.g. B.Sc. Physical Education", maxLength: 150 })}
            {text("experience", "Experience", { required: false, placeholder: "e.g. 3 years as a trainer", maxLength: 150 })}
            <Field label="Address" htmlFor="emp-address" required error={errors.address?.message}
              className="md:col-span-2 lg:col-span-3">
              <Textarea id="emp-address" rows={2} maxLength={300} placeholder="Full residential address" invalid={!!errors.address}
                {...register("address")} />
            </Field>
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="Identity & safety"
            description={employee && !canViewPii ? "Optional. Masked values are kept unless you replace them" : "Optional government ID details"}>
            <div className={GRID_2}>
              {text("aadhar_number", "Aadhar number", { required: false, placeholder: "12-digit Aadhar", inputMode: "numeric",
                maxLength: 14 })}
              {text("pan_number", "PAN number", { required: false, placeholder: "e.g. ABCDE1234F", maxLength: 14 })}
            </div>
          </Section>

          <Section title="Emergency contact" description="Optional. Who to call in an emergency">
            <div className={GRID_2}>
              {text("emergency_contact_name", "Contact name", { required: false, placeholder: "Name of relative / friend",
                maxLength: 120 })}
              {text("emergency_contact_relation", "Relation", { required: false, placeholder: "e.g. Spouse, Father", maxLength: 60 })}
              {text("emergency_contact_phone", "Contact phone", { required: false, placeholder: "10-digit mobile",
                inputMode: "numeric", maxLength: 10 })}
            </div>
          </Section>
        </div>

        <Section title="Work timings"
          description="The gym runs a morning and an evening session. Enter both shift timings.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {([
              ["Morning shift", "morning_start", "morning_end", "sun", "e.g. 6:00 AM – 10:00 AM"],
              ["Evening shift", "evening_start", "evening_end", "moon", "e.g. 5:00 PM – 9:00 PM"],
            ] as const).map(([label, from, to, icon, hint]) => (
              <div key={from} className="rounded-xl border border-line bg-subtle p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                  <Icon name={icon} className="h-4 w-4 text-accent" />
                  {label}
                </div>
                <div className={GRID_2}>
                  <Field label="From" htmlFor={`emp-${from}`} required error={errors[from]?.message}>
                    <Input id={`emp-${from}`} type="time" invalid={!!errors[from]} {...register(from)} />
                  </Field>
                  <Field label="To" htmlFor={`emp-${to}`} required error={errors[to]?.message}>
                    <Input id={`emp-${to}`} type="time" invalid={!!errors[to]} {...register(to)} />
                  </Field>
                </div>
                {!shiftError(from, to) && <p className="m-0 mt-2 text-xs text-muted">{hint}</p>}
              </div>
            ))}
          </div>
        </Section>

        {canLogin && (!employee || current) && (
          <Section title="App login"
            description={hasLogin
              ? `${current?.enabled ? "Active" : "Switched off"} · last sign-in ${current?.last_login_at ? formatDateTime(current.last_login_at) : "never"}`
              : "Optional. The owner sets the password and shares it; you can reset it any time."}
            aside={<Checkbox checked={login.on} onChange={(on) => editLogin({ on })} label={hasLogin ? "Login on" : "Give login"} />}>
            {login.on ? (
              <>
                <div className={GRID_3}>
                  <Field label={hasLogin ? "New password" : "Password"} htmlFor="emp-login-password" required={!hasLogin}
                    error={loginError}
                    hint={hasLogin ? "Leave empty to keep the current password" : "They can change it after signing in"}>
                    <PasswordField id="emp-login-password" maxLength={72} value={login.password} invalid={!!loginError}
                      placeholder={hasLogin ? "Type or generate to reset" : ""}
                      onChange={(e) => editLogin({ password: e.target.value })}
                      onGenerate={() => editLogin({ password: generatePassword() })} />
                  </Field>
                  <Field label="Access (role)" htmlFor="emp-login-role" required
                    hint={<>What they can do: set on <b>Roles &amp; Access</b>. Defaults from the staff role</>}>
                    <RoleSelect id="emp-login-role" value={roleId} currentName={current?.role_name}
                      onChange={(id) => { setRoleTouched(true); setRoleId(id); }} />
                  </Field>
                </div>
                <p className="m-0 mt-3 text-xs text-muted">
                  Login ID: <b className="text-ink">{watch("email") || "the email above"}</b>
                  {" · "}Branch: <b className="text-ink">{current?.branch_name ?? branchName ?? "the branch above"}</b> only
                </p>
              </>
            ) : (
              <p className="m-0 text-[13px] text-muted">
                {hasLogin && current?.enabled
                  ? `Saving will switch off ${watch("name") || "this"}'s login and sign them out.`
                  : `No login: ${watch("name") || "this staff member"} won't sign in to the app. Turn it on for trainers and front-desk staff.`}
              </p>
            )}
          </Section>
        )}
      </form>
      {creds && <LoginCredentialsModal creds={creds} onClose={() => { setCreds(null); toList(); }} />}
    </FormPage>
  );
}
