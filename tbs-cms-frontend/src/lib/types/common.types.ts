// ============================================
// COMMON TYPES — Shared response / request wrappers
// ============================================

/** Standard API response envelope */
export interface BaseResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errorCode?: string;
}

/** Pagination metadata returned by list endpoints */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

/** Base query parameters for list endpoints */
export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
