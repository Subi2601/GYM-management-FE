import type { Employee } from "@/types/employee";

/** "17:30:00" → "5:30 PM" */
export function formatTime12(value: string): string {
  const [h = "0", m = "00"] = value.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour < 12 ? "AM" : "PM"}`;
}

type Shifts = Pick<Employee, "morning_start" | "morning_end" | "evening_start" | "evening_end">;

/** Set shifts as display rows, e.g. [{ label: "Morning", range: "6:00 AM – 10:00 AM" }]. */
export function shiftRanges(e: Shifts): { label: "Morning" | "Evening"; range: string }[] {
  const out: { label: "Morning" | "Evening"; range: string }[] = [];
  if (e.morning_start && e.morning_end) {
    out.push({ label: "Morning", range: `${formatTime12(e.morning_start)} – ${formatTime12(e.morning_end)}` });
  }
  if (e.evening_start && e.evening_end) {
    out.push({ label: "Evening", range: `${formatTime12(e.evening_start)} – ${formatTime12(e.evening_end)}` });
  }
  return out;
}
