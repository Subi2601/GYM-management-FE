import { StatusBadge } from "@/components/ui/StatusBadge";
import { goalLabel } from "@/features/lookups/fitness-goals";
import { StarRating } from "@/features/staff/components/StarRating";
import { formatDate } from "@/lib/format";
import type { Feedback, PTClient } from "@/types/employee";

/** One personal-training client of a trainer (original `.pt-member-card`). */
export function PTClientCard({ pt }: { pt: PTClient }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-subtle">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-[15px] font-bold text-ink">{pt.member_name}</span>
        <StatusBadge value={pt.is_paid ? "PAID" : "PENDING"} />
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-muted">Goal</dt><dd className="m-0 font-semibold text-ink">{goalLabel(pt.goal) ?? "—"}</dd>
        <dt className="text-muted">Plan</dt><dd className="m-0 font-semibold text-ink">{pt.plan_name ?? "—"}</dd>
        <dt className="text-muted">Sessions</dt>
        <dd className="m-0 font-semibold text-ink">{pt.sessions_remaining} / {pt.total_sessions} left</dd>
        <dt className="text-muted">Started</dt><dd className="m-0 font-semibold text-ink">{formatDate(pt.start_date)}</dd>
        <dt className="text-muted">Expires</dt>
        <dd className="m-0 flex items-center justify-between gap-2 font-semibold text-ink">
          {formatDate(pt.expiry_date)}
          <StatusBadge value={pt.status} />
        </dd>
      </dl>
    </div>
  );
}

/** One client feedback entry (original `.feedback-card`). */
export function FeedbackCard({ fb }: { fb: Feedback }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex justify-between gap-3">
        <strong className="truncate text-sm text-ink">{fb.client_name}</strong>
        <span className="shrink-0 text-xs text-muted">{formatDate(fb.feedback_date)}</span>
      </div>
      <StarRating value={fb.rating} />
      {fb.comment && <p className="mb-0 mt-2 text-sm italic text-secondary-grey">&ldquo;{fb.comment}&rdquo;</p>}
    </div>
  );
}
