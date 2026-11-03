import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Loaders";
import { Section } from "@/components/ui/Section";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { staffApi, staffKeys } from "@/features/staff/api";
import { AddFeedbackModal } from "@/features/staff/components/AddFeedbackModal";
import { AssignPTModal } from "@/features/staff/components/AssignPTModal";
import { AttendanceMonthCard } from "@/features/staff/components/AttendanceMonthCard";
import { PayrollDrawer } from "@/features/staff/components/PayrollDrawer";
import { FeedbackCard, PTClientCard } from "@/features/staff/components/ProfileCards";
import { AverageRating } from "@/features/staff/components/StarRating";
import { shiftRanges } from "@/features/staff/lib/shifts";
import { formatDate, formatINR, MONTHS } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn, humanize, initials } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Employee, EmployeeProfile } from "@/types/employee";

/** "2 yrs 3 mos" since the joining date. */
function tenure(joined: string): string {
  const [y, m] = joined.split("-").map(Number) as [number, number];
  const now = new Date();
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (months < 1) return "New";
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  return [yrs && `${yrs} yr${yrs > 1 ? "s" : ""}`, mos && `${mos} mo${mos > 1 ? "s" : ""}`].filter(Boolean).join(" ");
}

/** /staff/:id — one page per employee; sections follow the profile data (training only for trainers). */
export function EmployeeDetailsPage() {
  const { id = "" } = useParams<{ id: string }>();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const isCurrentMonth = period.month === now.getMonth() + 1 && period.year === now.getFullYear();

  const profile = useQuery({
    queryKey: staffKeys.profile(branch, id, period.month, period.year),
    queryFn: async () => (await staffApi.profile(id, period.month, period.year)).data,
    placeholderData: keepPreviousData,
  });

  const shiftMonth = (delta: number) => setPeriod(({ month, year }) => {
    const d = new Date(year, month - 1 + delta, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  if (profile.isLoading) return <PageLoader />;
  if (!profile.data) {
    return (
      <div className="mx-auto max-w-[1180px]">
        <BackLink />
        <p className="text-sm text-muted">{profile.error?.message ?? "This employee does not exist in the selected branch."}</p>
      </div>
    );
  }
  return (
    <EmployeeDetails profile={profile.data} loadingMonth={profile.isFetching}
      onPrevMonth={() => shiftMonth(-1)} onNextMonth={() => shiftMonth(1)} canNextMonth={!isCurrentMonth} />
  );
}

function BackLink() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/staff")}
      className="mb-3 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-semibold text-muted transition-colors hover:text-accent">
      <Icon name="back" className="h-4 w-4" strokeWidth={2.5} />
      Staff
    </button>
  );
}

interface EmployeeDetailsProps {
  profile: EmployeeProfile;
  loadingMonth: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canNextMonth: boolean;
}

function EmployeeDetails({ profile, loadingMonth, onPrevMonth, onNextMonth, canNextMonth }: EmployeeDetailsProps) {
  const { employee: emp, attendance, payroll, training } = profile;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canUpdate = useCan("employee:update");
  const canTerminate = useCan("employee:terminate");
  const canAssignPT = useCan("pt:create");
  const canFeedback = useCan("feedback:create");
  const active = emp.status !== "TERMINATED";
  const writable = branch !== null && active;
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const terminate = useMutation({
    mutationFn: () => staffApi.terminate(emp.id),
    onSuccess: async (res) => {
      notify.success(res.message);
      await qc.invalidateQueries({ queryKey: staffKeys.all });
    },
    onError: notify.error,
  });

  const shifts = shiftRanges(emp);
  const lastPayout = payroll?.last_payout;
  const [payoutMonth, payoutYear] = (lastPayout?.month_year.split("-").map(Number) ?? []) as number[];

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      <div>
        <BackLink />
        {/* Profile header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-subtle md:flex-row md:items-center">
          <span className="side-avatar h-14 w-14 text-base">{initials(emp.name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-[22px] font-extrabold tracking-[-0.01em] text-ink">{emp.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span className="font-mono">{emp.employee_code}</span>
              <span>·</span><span className="font-semibold text-secondary-grey">{humanize(emp.role)}</span>
              <StatusBadge value={emp.status} />
              <span>·</span>
              <span>Since {formatDate(emp.date_of_joining)} ({tenure(emp.date_of_joining)})</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <a href={`tel:${emp.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-ink no-underline hover:text-accent">
                <Icon name="phone" className="h-3.5 w-3.5 text-muted" />{emp.phone}
              </a>
              {emp.email && (
                <a href={`mailto:${emp.email}`} className="inline-flex items-center gap-1.5 font-semibold text-ink no-underline hover:text-accent">
                  <Icon name="mail" className="h-3.5 w-3.5 text-muted" />{emp.email}
                </a>
              )}
            </div>
          </div>
          {writable && (
            <div className="flex flex-wrap gap-2">
              {canUpdate && <Button variant="secondary" icon={<Icon name="wallet" className="h-4 w-4" />} onClick={() => setPayrollOpen(true)}>Payroll</Button>}
              {canUpdate && <Button variant="secondary" icon={<Icon name="edit" className="h-4 w-4" />} onClick={() => navigate(`/staff/${emp.id}/edit`)}>Edit</Button>}
              {canTerminate && (
                <Button variant="danger" loading={terminate.isPending} onClick={async () => {
                  if (await confirm(`Are you sure you want to terminate ${emp.name}? This action cannot be undone.`)) terminate.mutate();
                }}>Terminate</Button>
              )}
            </div>
          )}
        </div>
        {!active && (
          <p className="m-0 mt-3 rounded-xl border border-danger-line bg-danger-soft px-4 py-2.5 text-[13px] font-semibold text-danger">
            Terminated on {formatDate(emp.date_of_termination)} — this profile is read-only.
          </p>
        )}
      </div>

      {/* KPI tiles — attendance for everyone, then training (trainers) or payroll */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Present" icon="check" tone="success" value={`${attendance.present + attendance.late} / ${attendance.days_elapsed}`}
          hint="Days this month" />
        <StatCard label="Late" icon="clock" tone="warning" value={attendance.late} hint={`Absent ${attendance.absent} · Leave ${attendance.on_leave}`} />
        {training ? (
          <>
            <StatCard label="PT clients" icon="dumbbell" tone="accent" value={training.active_clients} hint={`${training.pt_clients.length} in total`} />
            <StatCard label="Rating" icon="star" tone="warning" value={training.average_rating?.toFixed(1) ?? "—"}
              hint={`${training.feedbacks.length} review${training.feedbacks.length === 1 ? "" : "s"}`} />
          </>
        ) : (
          <>
            <StatCard label="Base salary" icon="wallet" tone="info" value={emp.base_salary > 0 ? formatINR(emp.base_salary, true) : "Not set"} hint="Per month" />
            <StatCard label="Last payout" icon="money" tone="neutral"
              value={lastPayout ? formatINR(lastPayout.net_salary, true) : "—"}
              hint={lastPayout ? `${MONTHS[(payoutMonth ?? 1) - 1]} ${payoutYear} · ${humanize(lastPayout.status)}` : payroll ? "No payroll yet" : "Needs payroll access"} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Work timings">
            {shifts.length === 0 ? (
              <p className="m-0 text-sm font-semibold text-warning">Not set — edit the employee to add the morning and evening shifts.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {shifts.map((s) => (
                  <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light text-accent">
                      <Icon name={s.label === "Morning" ? "sun" : "moon"} className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-muted">{s.label} shift</div>
                      <div className="text-[15px] font-bold text-ink">{s.range}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <AttendanceMonthCard attendance={attendance} loading={loadingMonth}
            onPrev={onPrevMonth} onNext={onNextMonth} canNext={canNextMonth} />

          {training && (
            <Section title="Personal training clients" description={`${training.active_clients} active`}
              aside={canAssignPT && writable && emp.status === "ACTIVE" && (
                <Button icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setAssignOpen(true)}>Assign member</Button>
              )}>
              {training.pt_clients.length === 0 ? <Empty>No PT members assigned yet.</Empty> : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {training.pt_clients.map((pt) => <PTClientCard key={pt.id} pt={pt} />)}
                </div>
              )}
            </Section>
          )}

          {training && (
            <Section title="Client feedback"
              description={training.average_rating != null ? undefined : "No ratings yet"}
              aside={
                <div className="flex items-center gap-3">
                  {training.average_rating != null && <AverageRating value={training.average_rating} />}
                  {canFeedback && writable && (
                    <Button variant="secondary" icon={<Icon name="plus" className="h-4 w-4" />} onClick={() => setFeedbackOpen(true)}>Add feedback</Button>
                  )}
                </div>
              }>
              {training.feedbacks.length === 0 ? <Empty>No feedback yet.</Empty> : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {training.feedbacks.map((fb) => <FeedbackCard key={fb.id} fb={fb} />)}
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Payroll & bank"
            aside={canUpdate && writable && <LinkButton onClick={() => setPayrollOpen(true)}>Edit</LinkButton>}>
            <Rows rows={[
              ["Base salary", emp.base_salary > 0 ? `${formatINR(emp.base_salary)} / month` : <Muted>Not set</Muted>],
              ...(payroll ? [["Last payout", lastPayout
                ? <span className={lastPayout.status === "PAID" ? "text-success" : "text-warning"}>
                    {formatINR(lastPayout.net_salary)} · {humanize(lastPayout.status)}
                  </span>
                : <Muted>None yet</Muted>] as [string, ReactNode]] : []),
              ["Bank", emp.bank_name ?? <Muted>Paid in cash / not added</Muted>],
              ["Account", emp.bank_account_number ?? <Muted>—</Muted>],
              ["IFSC", emp.ifsc_code ?? <Muted>—</Muted>],
              ["UPI ID", emp.upi_id ?? <Muted>Not added</Muted>],
            ]} />
          </Section>

          <Section title="Personal">
            <Rows rows={[
              ["Address", emp.address ?? <Muted>Not added</Muted>],
              ["Education", emp.education ?? <Muted>Not added</Muted>],
              ["Experience", emp.experience ?? <Muted>Not added</Muted>],
            ]} />
          </Section>

          <Section title="Emergency & identity">
            <Rows rows={[
              ["Emergency", emergencyLabel(emp) ?? <Muted>Not added</Muted>],
              ["Aadhar", emp.aadhar_number ?? <Muted>Not added</Muted>],
              ["PAN", emp.pan_number ?? <Muted>Not added</Muted>],
            ]} />
          </Section>
        </div>
      </div>

      {payrollOpen && <PayrollDrawer employee={emp} onClose={() => setPayrollOpen(false)} />}
      {training && (
        <AssignPTModal open={assignOpen} trainerId={emp.id} trainerName={emp.name} onClose={() => setAssignOpen(false)} />
      )}
      {training && (
        <AddFeedbackModal open={feedbackOpen} employeeId={emp.id} employeeName={emp.name} onClose={() => setFeedbackOpen(false)} />
      )}
    </div>
  );
}

function emergencyLabel(e: Employee): ReactNode | null {
  if (!e.emergency_contact_name && !e.emergency_contact_phone) return null;
  return (
    <span>
      {e.emergency_contact_name ?? "—"}{e.emergency_contact_relation ? ` (${e.emergency_contact_relation})` : ""}
      {e.emergency_contact_phone && <span className="block text-xs font-medium text-muted">{e.emergency_contact_phone}</span>}
    </span>
  );
}

/** Label / value rows for the side cards. */
function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 flex flex-col">
      {rows.map(([label, value], i) => (
        <div key={label} className={cn("flex items-start justify-between gap-4 py-2.5 text-[13px]", i > 0 && "border-t border-line-light")}>
          <dt className="shrink-0 text-muted">{label}</dt>
          <dd className="m-0 min-w-0 break-words text-right font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-medium text-muted">{children}</span>;
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold text-accent hover:underline">
      {children}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-xl border-2 border-dashed border-line bg-subtle p-6 text-center text-sm text-muted">{children}</p>;
}
