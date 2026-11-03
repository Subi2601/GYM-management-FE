import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Responsive field grids for forms (3 → 2 → 1 and 2 → 1 columns). */
export const GRID_3 = "grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 lg:grid-cols-3";
export const GRID_2 = "grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2";

interface SectionProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right side of the section header (a toggle, a small button). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Bordered card that groups related fields or details (form pages, profile views). */
export function Section({ title, description, aside, children, className }: SectionProps) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface shadow-subtle", className)}>
      <header className="flex items-start justify-between gap-4 border-b border-line-light px-6 py-4">
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] font-bold text-ink">{title}</h3>
          {description && <p className="m-0 mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

/** Section heading inside a drawer / modal form: title, then a hairline to the edge. */
export function FormDivider({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 mt-7 flex items-center gap-3 first:mt-0", className)}>
      <span className="whitespace-nowrap text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

interface InfoRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

/** Label / value pair for detail views; empty values show a dash. */
export function InfoRow({ label, value, className }: InfoRowProps) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="break-words text-sm font-semibold text-ink">{empty ? "—" : value}</span>
    </div>
  );
}
