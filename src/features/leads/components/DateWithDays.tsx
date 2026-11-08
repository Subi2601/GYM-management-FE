import { Input } from "@/components/ui/Field";
import { addDays, daysUntil } from "@/features/leads/lead-meta";
import { todayISO } from "@/lib/format";

interface Props {
  id: string;
  /** `YYYY-MM-DD` or "". */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  /** Earliest pickable date (defaults to today). */
  min?: string;
}

/**
 * Date input + "in N days" input that stay in sync: type 3 days → the date becomes today + 3,
 * pick a date → the days update. Lets the desk say "call again in 3 days" without counting on a calendar.
 */
export function DateWithDays({ id, value, onChange, onBlur, invalid, min }: Props) {
  const today = todayISO();
  const days = value ? daysUntil(value, today) : "";

  return (
    <div className="flex items-center gap-2">
      <Input id={id} type="date" value={value} min={min ?? today} invalid={invalid} className="min-w-0 flex-1"
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      <div className="flex shrink-0 items-center gap-1.5">
        <Input aria-label="Days from today" type="number" inputMode="numeric" min={0} max={365} value={days}
          placeholder="0" invalid={invalid} className="w-[72px] text-center"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange("");
            const n = Math.min(365, Math.max(0, Math.trunc(Number(raw))));
            if (!Number.isNaN(n)) onChange(addDays(today, n));
          }}
          onBlur={onBlur} />
        <span className="text-xs font-semibold text-muted">days</span>
      </div>
    </div>
  );
}
