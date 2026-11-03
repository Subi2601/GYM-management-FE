import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { GRID_2, InfoRow, Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { shortDate } from "@/features/salary/lib/salary";
import { staffApi, staffKeys } from "@/features/staff/api";
import { FeedbackCard, PTClientCard } from "@/features/staff/components/ProfileCards";
import { AverageRating } from "@/features/staff/components/StarRating";
import { formatDate, formatINR } from "@/lib/format";
import { humanize } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Salary } from "@/types/salary";

/** Salary breakdown for one month + the employee's info, PT clients and feedback. */
export function SalaryDetailsDrawer({ salary, onClose }: { salary: Salary; onClose: () => void }) {
  const branch = useBranchStore((s) => s.selectedBranchId);
  const canListStaff = useCan("employee:list");
  const profile = useQuery({
    queryKey: staffKeys.profile(branch, salary.employee_id),
    queryFn: () => staffApi.profile(salary.employee_id),
    enabled: canListStaff,
  });
  const p = profile.data?.data;

  return (
    <Drawer
      open
      width="640px"
      title={salary.employee_name}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          {salary.employee_code} · {humanize(salary.employee_role)} · {salary.month_year}
          <StatusBadge value={salary.status} />
        </span>
      }
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-info-line bg-info-soft px-5 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.06em] text-info">Earned till now</div>
            <div className="mt-1 text-2xl font-extrabold text-info">{formatINR(salary.till_now_salary)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-muted">Net payable</div>
            <div className="mt-1 text-lg font-extrabold text-ink">{formatINR(salary.net_salary)}</div>
          </div>
        </div>

        <Section title="Attendance & pay">
          <div className={GRID_2}>
            <InfoRow label="Base salary" value={formatINR(salary.base_salary)} />
            <InfoRow label="Days present" value={<StatusBadge value="PRESENT" label={`${salary.days_present} days`} />} />
            <InfoRow label="Days absent" value={<StatusBadge value="ABSENT" label={`${salary.days_absent} days`} />} />
            <InfoRow label="Days late" value={salary.days_late} />
            <InfoRow label="Deductions" value={<span className="text-danger">− {formatINR(salary.deductions)}</span>} />
            {salary.bonus > 0 && (
              <InfoRow label="Bonus" value={<span className="text-success">+ {formatINR(salary.bonus)}</span>} />
            )}
            {salary.status === "PAID" && (
              <>
                <InfoRow label="Paid on" value={formatDate(salary.paid_date)} />
                <InfoRow label="Payment method" value={salary.payment_method ? humanize(salary.payment_method) : null} />
              </>
            )}
          </div>
          {salary.absent_dates.length > 0 && (
            <div className="mt-4">
              <span className="mb-2 block text-xs font-semibold text-muted">Absent on</span>
              <div className="flex flex-wrap gap-1.5">
                {salary.absent_dates.map((d) => <StatusBadge key={d} value="ABSENT" label={shortDate(d)} />)}
              </div>
            </div>
          )}
        </Section>

        <Section title="Employee info">
          {!canListStaff && <p className="m-0 text-sm text-muted">Not available.</p>}
          {canListStaff && profile.isLoading && <p className="m-0 text-sm text-muted">Loading…</p>}
          {p && (
            <div className={GRID_2}>
              <InfoRow label="Employee ID" value={p.employee.employee_code} />
              <InfoRow label="Role" value={humanize(p.employee.role)} />
              <InfoRow label="Phone" value={p.employee.phone} />
              <InfoRow label="Joined" value={formatDate(p.employee.date_of_joining)} />
              <InfoRow label="Bank" value={p.employee.bank_name} />
              <InfoRow label="Account number" value={p.employee.bank_account_number} />
              <InfoRow label="IFSC" value={p.employee.ifsc_code} />
              <InfoRow label="UPI ID" value={p.employee.upi_id} />
              <InfoRow label="PAN" value={p.employee.pan_number} />
            </div>
          )}
        </Section>

        {/* Personal training and feedback only exist for trainers (`training` is null otherwise). */}
        {p?.training && (
          <Section title="Personal training">
            {p.training.pt_clients.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {p.training.pt_clients.map((pt) => <PTClientCard key={pt.id} pt={pt} />)}
              </div>
            ) : <p className="m-0 text-sm text-muted">No PT members assigned.</p>}
          </Section>
        )}

        {p?.training && (
          <Section title="Client feedback"
            aside={p.training.average_rating != null && (
              <div className="flex items-center gap-2">
                <AverageRating value={p.training.average_rating} />
                <span className="text-sm text-muted">({p.training.feedbacks.length} reviews)</span>
              </div>
            )}>
            {p.training.feedbacks.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {p.training.feedbacks.map((fb) => <FeedbackCard key={fb.id} fb={fb} />)}
              </div>
            ) : <p className="m-0 text-sm text-muted">No feedback yet.</p>}
          </Section>
        )}
      </div>
    </Drawer>
  );
}
