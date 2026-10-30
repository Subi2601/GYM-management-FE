/** Unwrapped backend envelope as delivered by the axios interceptor. */
export interface Envelope<T> {
  message: string | null;
  data: T;
}

/**
 * Normalized paginated payload. The backend returns
 * `{ success, message, data: [...], total, page, page_size }`; the interceptor folds it into this shape.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PageQuery {
  page?: number;
  page_size?: number;
  search?: string;
}

/** Fetch "everything" for dropdowns / lookups (backend cap is 500). */
export const ALL_ROWS = { page: 1, page_size: 500 } as const;
