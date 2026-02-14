/**
 * Metadata for paginated results.
 */
export interface IPaginationMeta {
  /** Current page number */
  page: number;

  /** Number of items per page */
  limit: number;

  /** Total number of items across all pages */
  total: number;

  /** Total number of pages */
  totalPages: number;
}

/**
 * Generic interface for paginated query results.
 * Used by services to return paginated data in a consistent format.
 *
 * @example
 * async findAll(pagination: PaginationDto): Promise<IPaginatedResult<Order>> {
 *   const [data, total] = await Promise.all([
 *     this.prisma.order.findMany({ skip: pagination.skip, take: pagination.limit }),
 *     this.prisma.order.count(),
 *   ]);
 *   return {
 *     data,
 *     meta: {
 *       page: pagination.page,
 *       limit: pagination.limit,
 *       total,
 *       totalPages: Math.ceil(total / pagination.limit),
 *     },
 *   };
 * }
 */
export interface IPaginatedResult<T> {
  /** Array of items for the current page */
  data: T[];

  /** Pagination metadata */
  meta: IPaginationMeta;
}
