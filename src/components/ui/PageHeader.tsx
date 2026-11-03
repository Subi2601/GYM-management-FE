import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Back button (navigate(-1)); off on top-level screens reached from the sidebar. */
  showBack?: boolean;
  /** Primary / secondary buttons on the right (Add …, Export …). */
  actions?: ReactNode;
}

/** Screen title + subtitle on the left, primary actions on the right. Search and filters live in the table toolbar. */
export function PageHeader({ title, subtitle, showBack = false, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div className="flex min-w-0 items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            title="Go back"
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-surface text-secondary-grey transition-colors hover:border-line-strong hover:text-ink"
          >
            <Icon name="back" className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="section-title">{title}</h1>
          {subtitle && <p className="m-0 mt-1.5 text-sm font-medium text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto md:justify-end">{actions}</div>}
    </div>
  );
}
