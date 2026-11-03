import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";

interface FormPageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Where Back / Cancel goes (the list screen). */
  backTo: string;
  backLabel?: string;
  /** Steps, tabs or a status pill under the title. */
  header?: ReactNode;
  children: ReactNode;
  /** Sticky action bar at the bottom of the page (Cancel / Save). Submit buttons use `form="<id>"`. */
  actions?: ReactNode;
}

/** Full-page layout for long forms (member, employee, diet plan): breadcrumb back link, section cards, sticky actions. */
export function FormPage({ title, subtitle, backTo, backLabel = "Back", header, children, actions }: FormPageProps) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <button type="button" onClick={() => navigate(backTo)}
        className="mb-3 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-semibold text-muted transition-colors hover:text-accent">
        <Icon name="back" className="h-4 w-4" strokeWidth={2.5} />
        {backLabel}
      </button>
      <div className="mb-6">
        <h1 className="section-title">{title}</h1>
        {subtitle && <p className="m-0 mt-1.5 text-sm font-medium text-muted">{subtitle}</p>}
      </div>
      {header}
      <div className="flex flex-col gap-5">{children}</div>
      {actions && (
        // Floating card aligned with the section cards, so it sits on the page the same way in both themes.
        <div className="sticky bottom-4 z-20 mt-5 flex flex-col-reverse justify-end gap-2.5 rounded-2xl border border-line bg-surface/95 px-5 py-3 shadow-premium backdrop-blur-[12px] sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  );
}
