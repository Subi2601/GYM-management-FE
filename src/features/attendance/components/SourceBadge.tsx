import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AttendanceSource } from "@/types/enums";

/** How a check-in was recorded: QR (blue) or front desk (grey). */
export function SourceBadge({ source }: { source: AttendanceSource | null | undefined }) {
  if (!source) return <span className="text-muted">—</span>;
  return source === "QR"
    ? <StatusBadge value="QR" tone="blue" label="QR" />
    : <StatusBadge value="MANUAL" tone="grey" label="Manual" />;
}

/** "Inside" pill for a visit that hasn't checked out yet. */
export function InsideBadge() {
  return <StatusBadge value="INSIDE" tone="green" label="Inside" />;
}
