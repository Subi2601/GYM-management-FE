import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** page / page_size / search state for a server-paginated list screen. */
export function useListState(initialPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());

  // A new search or page size starts again from page 1.
  useEffect(() => setPage(1), [debouncedSearch, pageSize]);

  return {
    page,
    pageSize,
    search,
    setSearch,
    debouncedSearch,
    setPage,
    setPageSize,
    query: { page, page_size: pageSize, search: debouncedSearch || undefined },
  };
}
