import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import type { SortDir } from "@/hooks/use-list-state";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** CSS width for the column, e.g. "120px". */
    width?: string;
    align?: "left" | "right" | "center";
    /** Server sort key (the API's `sort_by` value); makes the header clickable. */
    sortKey?: string;
  }
}

/** Left-edge status markers carried over from the original stag-table. */
export const ROW_MARKER = {
  expired: "[&>td:first-child]:shadow-[inset_3px_0_0_rgb(var(--accent))]",
  nearExpiry: "[&>td:first-child]:shadow-[inset_3px_0_0_rgb(var(--warning))]",
  new: "[&>td:first-child]:shadow-[inset_3px_0_0_rgb(var(--info))]",
  followup: "[&>td:first-child]:shadow-[inset_3px_0_0_rgb(var(--warning))]",
  joined: "[&>td:first-child]:shadow-[inset_3px_0_0_rgb(var(--success))]",
  rejected: "[&>td:first-child]:shadow-[inset_3px_0_0_rgb(var(--danger))]",
  muted: "[&>td]:opacity-70",
} as const;

export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export interface ServerSorting {
  sortBy: string | undefined;
  sortDir: SortDir;
  onSortChange: (sortBy: string, sortDir: SortDir) => void;
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  loading?: boolean;
  /** Background refetch (filters / page change) — dims the rows instead of showing skeletons. */
  fetching?: boolean;
  emptyMessage?: string;
  emptyHint?: ReactNode;
  emptyIcon?: IconName;
  rowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  pagination?: ServerPagination;
  sorting?: ServerSorting;
  /** Tabs + toolbar rendered inside the card, above the table (see ListToolbar / FilterTabs). */
  toolbar?: ReactNode;
  /** Tailwind max-height class for the scroll area (table owns the scroll). */
  maxHeightClass?: string;
  getRowId?: (row: T) => string;
}

/** Card table: optional toolbar, sticky header with server sorting, skeleton rows, empty state, numbered pagination. */
export function DataTable<T>({ columns, data, loading = false, fetching = false, emptyMessage = "No records found.",
  emptyHint, emptyIcon = "folder", rowClassName, onRowClick, pagination, sorting, toolbar,
  maxHeightClass = "max-h-[calc(100vh-300px)]", getRowId }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });
  const colCount = columns.length;

  const alignClass = (align: "left" | "right" | "center" | undefined) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : undefined;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-premium">
      {toolbar}
      <div className={cn("relative overflow-auto", maxHeightClass)}>
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const isActions = header.column.id === "actions";
                  const sortKey = sorting && meta?.sortKey;
                  const sorted = sortKey && sorting.sortBy === sortKey ? sorting.sortDir : undefined;
                  const label = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      style={{ width: meta?.width, minWidth: meta?.width }}
                      className={cn(
                        "h-11 select-none whitespace-nowrap border-b border-line bg-subtle px-4 first:pl-6 last:pr-6",
                        "text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted",
                        isActions && "sticky right-0 text-center",
                        alignClass(meta?.align),
                      )}
                    >
                      {sortKey ? (
                        <button
                          type="button"
                          onClick={() => sorting.onSortChange(sortKey, sorted === "asc" ? "desc" : "asc")}
                          className={cn(
                            "group/sort inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] uppercase tracking-[inherit] transition-colors hover:text-ink",
                            sorted ? "text-ink" : "text-muted",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {label}
                          <Icon
                            name={sorted === "asc" ? "arrowUp" : sorted === "desc" ? "arrowDown" : "sort"}
                            className={cn("h-3.5 w-3.5", sorted ? "text-accent" : "opacity-0 group-hover/sort:opacity-60")}
                            strokeWidth={2.5}
                          />
                        </button>
                      ) : label}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={cn("transition-opacity", fetching && !loading && "opacity-60")}>
            {loading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((_, c) => (
                    <td key={c} className="border-b border-line-light px-4 py-4 first:pl-6 last:pr-6">
                      <div className="h-3.5 animate-pulse rounded bg-hover" style={{ width: `${55 + ((i * 7 + c * 13) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn("group", onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isActions = cell.column.id === "actions";
                    return (
                      <td
                        key={cell.id}
                        onClick={isActions ? (e) => e.stopPropagation() : undefined}
                        className={cn(
                          "border-b border-line-light bg-surface px-4 py-3 text-sm text-ink transition-colors first:pl-6 last:pr-6",
                          // opaque wash (sticky cells sit over scrolled content)
                          "group-hover:[background:linear-gradient(var(--row-hover),var(--row-hover)),rgb(var(--surface))]",
                          isActions && "sticky right-0 text-center",
                          alignClass(cell.column.columnDef.meta?.align),
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={colCount}>
                  <div className="flex flex-col items-center justify-center px-10 py-16 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-subtle text-muted">
                      <Icon name={emptyIcon} className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                    <p className="m-0 text-[15px] font-bold text-ink">{emptyMessage}</p>
                    {emptyHint && <p className="m-0 mt-1 text-[13px] text-muted">{emptyHint}</p>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pagination && pagination.total > 0 && <PaginationBar {...pagination} />}
    </div>
  );
}

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
function pageWindow(page: number, last: number): (number | "gap")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= last - 2) [last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export const PAGE_SIZES = [10, 20, 50, 100] as const;

function PaginationBar({ page, pageSize, total, onPageChange, onPageSizeChange }: ServerPagination) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const btn = "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border px-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const idle = "border-transparent bg-transparent text-secondary-grey hover:enabled:border-line hover:enabled:bg-surface hover:enabled:text-ink";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3 text-[13px] text-muted">
      <div className="flex items-center gap-3">
        <span>
          Showing <b className="font-bold text-ink">{from}–{to}</b> of <b className="font-bold text-ink">{total}</b>
        </span>
        <span className="h-4 w-px bg-line max-sm:hidden" />
        <label className="flex items-center gap-2 max-sm:hidden">
          Rows
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="toolbar-control h-8 cursor-pointer px-2">
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button type="button" className={cn(btn, idle)} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        {pageWindow(page, lastPage).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-muted">…</span>
          ) : (
            <button key={p} type="button" aria-current={p === page ? "page" : undefined} onClick={() => onPageChange(p)}
              className={cn(btn, p === page ? "border-line-accent bg-accent-light text-accent" : idle)}>
              {p}
            </button>
          ),
        )}
        <button type="button" className={cn(btn, idle)} disabled={page >= lastPage} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

interface ActionButtonProps {
  kind: "view" | "edit" | "delete" | "print";
  title?: string;
  onClick: () => void;
}

const ACTION_ICON = { view: "eye", edit: "edit", delete: "trash", print: "print" } as const;

/** Square icon buttons used in the Actions column. */
export function ActionIcon({ kind, title, onClick }: ActionButtonProps) {
  const label = title ?? kind[0]!.toUpperCase() + kind.slice(1);
  return (
    <button type="button" className={cn("action-icon", kind)} title={label} aria-label={label} onClick={onClick}>
      <Icon name={ACTION_ICON[kind]} className="h-4 w-4" />
    </button>
  );
}

/** Buttons of one row, centred under the "Actions" heading. */
export function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-center gap-1.5">{children}</div>;
}
