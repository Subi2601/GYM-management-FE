import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type SortDir = "asc" | "desc";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

interface ListStateOptions {
  pageSize?: number;
  /** Default `sort_by`; undefined = the API's default order. */
  sortBy?: string;
  sortDir?: SortDir;
}

/** page / page_size / debounced search / sort state for a server-paginated list screen. */
export function useListState({ pageSize: initialPageSize = 20, sortBy: initialSortBy,
  sortDir: initialSortDir = "desc" }: ListStateOptions = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const debouncedSearch = useDebouncedValue(search.trim());

  // A new search, sort or page size starts again from page 1.
  useEffect(() => setPage(1), [debouncedSearch, pageSize, sortBy, sortDir]);

  const setSort = useCallback((by: string, dir: SortDir) => {
    setSortBy(by);
    setSortDir(dir);
  }, []);

  return {
    page,
    pageSize,
    search,
    setSearch,
    debouncedSearch,
    setPage,
    setPageSize,
    sortBy,
    sortDir,
    setSort,
    query: {
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      sort_by: sortBy,
      sort_dir: sortBy ? sortDir : undefined,
    },
    /** Props for `<DataTable sorting>`. */
    sorting: { sortBy, sortDir, onSortChange: setSort },
  };
}

/** Props for `<DataTable pagination>` from a list state + the server total. */
export function paginationProps(list: ReturnType<typeof useListState>, total: number | undefined) {
  return { page: list.page, pageSize: list.pageSize, total: total ?? 0,
    onPageChange: list.setPage, onPageSizeChange: list.setPageSize };
}

/**
 * One URL search param restricted to `allowed` (status tabs: `?tab=active`), so tabs survive reloads and
 * links from the dashboard. Unknown / missing values fall back to `fallback`.
 */
export function useUrlEnum<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const setValue = useCallback((next: T) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === fallback) p.delete(key);
      else p.set(key, next);
      return p;
    }, { replace: true });
  }, [key, fallback, setParams]);
  return [value, setValue] as const;
}

/** Runs `onAdd` once when the URL carries `?action=add` (dashboard quick links), then clears the param. */
export function useAddAction(onAdd: () => void, enabled = true) {
  const [params, setParams] = useSearchParams();
  const wantsAdd = params.get("action") === "add";
  useEffect(() => {
    if (!wantsAdd) return;
    if (enabled) onAdd();
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete("action");
      return p;
    }, { replace: true });
  }, [wantsAdd, enabled, onAdd, setParams]);
}
