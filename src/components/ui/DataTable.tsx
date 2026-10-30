import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** CSS width for the column, e.g. "120px". */
    width?: string;
    align?: "left" | "right" | "center";
  }
}

/** Left-edge status markers carried over from the original stag-table. */
export const ROW_MARKER = {
  expired: "[&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-accent",
  nearExpiry: "[&>td:first-child]:border-l-[3px] [&>td:first-child]:border-l-warning",
  new: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-accent",
  followup: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-warning",
  joined: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-success",
  rejected: "[&>td:first-child]:border-l-4 [&>td:first-child]:border-l-danger",
  muted: "[&>td]:opacity-70",
} as const;

export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  pagination?: ServerPagination;
  /** Tailwind max-height class for the scroll area (table owns the scroll). */
  maxHeightClass?: string;
  getRowId?: (row: T) => string;
}

/** The original `app-stag-table`: sticky grey header, uppercase labels, hover rows, folder empty state. */
export function DataTable<T>({ columns, data, loading = false, emptyMessage = "No records found.",
  rowClassName, onRowClick, pagination, maxHeightClass = "max-h-[calc(100vh-260px)]", getRowId }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });
  const colCount = columns.length;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-premium">
      <div className={cn("relative overflow-auto bg-surface", maxHeightClass)}>
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10 bg-subtle">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const isActions = header.column.id === "actions";
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.column.columnDef.meta?.width, minWidth: header.column.columnDef.meta?.width }}
                      className={cn(
                        "h-14 select-none whitespace-nowrap border-b-2 border-r border-line bg-subtle px-6",
                        "text-[13px] font-extrabold uppercase tracking-[0.06em] text-secondary-grey",
                        isActions && "sticky right-0 border-r-0 text-right",
                        header.column.columnDef.meta?.align === "right" && "text-right",
                        header.column.columnDef.meta?.align === "center" && "text-center",
                      )}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading &&
              [1, 2, 3].map((i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={colCount} className="border-b border-line-light px-6 py-4">
                    <div className="h-5 animate-shimmer rounded bg-[linear-gradient(90deg,#f1f5f9_0px,#e2e8f0_40px,#f1f5f9_80px)] bg-[length:800px_100%]" />
                  </td>
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
                          "border-b border-r border-line-light bg-surface px-6 py-4 text-sm text-ink transition-colors",
                          // opaque wash (sticky cells sit over scrolled content) + accent bar on the first cell
                          "group-hover:[background:linear-gradient(var(--row-hover),var(--row-hover)),rgb(var(--surface))]",
                          "group-hover:first:shadow-[inset_3px_0_0_rgb(var(--accent))]",
                          isActions && "sticky right-0 border-r-0 text-right",
                          cell.column.columnDef.meta?.align === "right" && "text-right",
                          cell.column.columnDef.meta?.align === "center" && "text-center",
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
                  <div className="flex flex-col items-center justify-center bg-surface px-10 py-20 text-muted">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-subtle text-secondary-grey">
                      <Icon name="folder" className="h-8 w-8" strokeWidth={1.5} />
                    </div>
                    <p className="m-0 text-[15px] font-semibold">{emptyMessage}</p>
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

function PaginationBar({ page, pageSize, total, onPageChange, onPageSizeChange }: ServerPagination) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const navBtn = "flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-secondary-grey transition-all hover:enabled:border-secondary-grey hover:enabled:text-ink disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-6 py-3 text-[13px] font-semibold text-muted">
      <span>Showing {from}–{to} of {total} records</span>
      <div className="flex items-center gap-3">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold text-ink outline-none focus:border-secondary-grey"
        >
          {[20, 50, 100].map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>
        <button type="button" className={navBtn} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <Icon name="back" className="h-4 w-4" />
        </button>
        <span className="text-ink">{page} / {lastPage}</span>
        <button type="button" className={navBtn} disabled={page >= lastPage} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
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
  return (
    <button type="button" className={cn("action-icon", kind)} title={title ?? kind[0]!.toUpperCase() + kind.slice(1)} onClick={onClick}>
      <Icon name={ACTION_ICON[kind]} />
    </button>
  );
}

export function ActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}
