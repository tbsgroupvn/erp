'use client';

import { useCallback, useState } from 'react';

export interface UsePaginationReturn {
  page: number;
  limit: number;
  offset: number;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  reset: () => void;
}

/**
 * Manages pagination state (page, limit, offset).
 *
 * @example
 * const { page, limit, offset, setPage, setLimit } = usePagination();
 * const { data } = useOrders({ page, limit });
 */
export function usePagination(
  initialPage: number = 1,
  initialLimit: number = 20,
): UsePaginationReturn {
  const [page, setPageState] = useState(initialPage);
  const [limit, setLimitState] = useState(initialLimit);

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage));
  }, []);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(newLimit);
    setPageState(1);
  }, []);

  const reset = useCallback(() => {
    setPageState(initialPage);
    setLimitState(initialLimit);
  }, [initialPage, initialLimit]);

  const offset = (page - 1) * limit;

  return { page, limit, offset, setPage, setLimit, reset };
}
