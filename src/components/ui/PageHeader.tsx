import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Back button (navigate(-1)) as on every original screen. */
  showBack?: boolean;
  /** Search box bound to a value — screens debounce/forward it to the API. */
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  actions?: ReactNode;
}

/** ".table-header-section": back button + title on the left, search + actions on the right. */
export function PageHeader({ title, subtitle, showBack = true, search, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="mb-[30px] flex flex-col items-start justify-between gap-4 md:flex-row md:flex-wrap md:items-center md:gap-5">
      <div className="flex items-center gap-4">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            title="Go Back"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-secondary-grey shadow-subtle transition-all duration-200 hover:-translate-x-1 hover:border-secondary-grey hover:bg-subtle hover:text-ink"
          >
            <Icon name="back" className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
        <div>
          <h1 className="section-title">{title}</h1>
          {subtitle && <p className="m-0 mt-1 text-sm font-medium text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
        {search && <SearchBox {...search} />}
        {actions}
      </div>
    </div>
  );
}

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBox({ value, onChange, placeholder = "Search..." }: SearchBoxProps) {
  return (
    <div className="min-w-[300px]">
      <div className="flex h-[42px] items-center rounded-[10px] border border-line bg-subtle px-3.5 transition-all duration-200 focus-within:min-w-[350px] focus-within:border-accent focus-within:bg-surface focus-within:shadow-[0_0_0_3px_var(--accent-red-light)]">
        <span className="mr-2.5 flex items-center text-muted">
          <Icon name="search" strokeWidth={2.5} />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full w-full border-none bg-transparent text-sm font-medium text-ink outline-none"
        />
      </div>
    </div>
  );
}
