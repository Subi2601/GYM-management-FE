import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  /** Badge count; undefined hides it (still loading / not known). */
  count?: number;
}

interface FilterTabsProps<T extends string> {
  tabs: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Status tabs across the top of a table card (All / Active / Expiring …). */
export function FilterTabs<T extends string>({ tabs, value, onChange }: FilterTabsProps<T>) {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value}
          className={cn("tab-item", t.value === value && "active")} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export interface ActiveFilter {
  label: ReactNode;
  onRemove: () => void;
}

interface ListToolbarProps {
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  /** Filter controls (FilterSelect / DateRangeFilter) shown after the search box. */
  filters?: ReactNode;
  /** Right-aligned buttons (refresh, export …). */
  actions?: ReactNode;
  /** Applied filters shown as removable chips with "Clear all". */
  active?: ActiveFilter[];
}

/** Search + filters + actions row inside a table card, with removable chips for applied filters. */
export function ListToolbar({ search, filters, actions, active = [] }: ListToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-6 py-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {search && <ToolbarSearch {...search} />}
        {filters}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted">Filtered by</span>
          {active.map((f, i) => (
            <span key={i} className="filter-chip">
              {f.label}
              <button type="button" onClick={f.onRemove} aria-label="Remove filter"
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-accent hover:bg-accent/15">
                <Icon name="x" className="h-3 w-3" strokeWidth={3} />
              </button>
            </span>
          ))}
          {active.length > 1 && (
            <button type="button" onClick={() => active.forEach((f) => f.onRemove())}
              className="cursor-pointer border-0 bg-transparent text-xs font-bold text-muted underline-offset-2 hover:text-accent hover:underline">
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarSearch({ value, onChange, placeholder = "Search…" }: NonNullable<ListToolbarProps["search"]>) {
  return (
    <label className="relative flex w-full items-center sm:w-[300px]">
      <Icon name="search" className="pointer-events-none absolute left-3 h-4 w-4 text-muted" strokeWidth={2.5} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        aria-label={placeholder} className="toolbar-control w-full pl-9 pr-8 font-medium placeholder:font-normal placeholder:text-muted/80" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-hover text-muted hover:text-ink">
          <Icon name="x" className="h-3 w-3" strokeWidth={3} />
        </button>
      )}
    </label>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  /** Shown as the "all" option: "All plans", "Any mode" … */
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  className?: string;
}

/** Compact select for a toolbar; "" means not filtered. */
export function FilterSelect({ placeholder, value, onChange, options, ariaLabel, className }: FilterSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel ?? placeholder}
      className={cn("toolbar-control min-w-[150px] cursor-pointer", !value && "text-muted", className)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

interface DateRangeFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
}

/** From – To date pair for a toolbar (ISO yyyy-mm-dd; "" = open). */
export function DateRangeFilter({ from, to, onChange, label = "Date" }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`${label} range`}>
      <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)}
        aria-label={`${label} from`} className={cn("toolbar-control w-[140px]", !from && "text-muted")} />
      <span className="text-xs font-semibold text-muted">to</span>
      <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)}
        aria-label={`${label} to`} className={cn("toolbar-control w-[140px]", !to && "text-muted")} />
    </div>
  );
}
