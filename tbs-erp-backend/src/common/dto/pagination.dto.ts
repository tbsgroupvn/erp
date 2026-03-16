import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BadRequestException, Logger } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Cursor-based Pagination
// ---------------------------------------------------------------------------

/**
 * DTO for cursor-based pagination requests.
 * More efficient than offset pagination for large datasets and real-time feeds
 * because it avoids the "skip N rows" overhead in the database.
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Cursor for next page (last item ID)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Generic result shape for cursor-paginated queries.
 */
export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Offset-based Pagination
// ---------------------------------------------------------------------------

const paginationLogger = new Logger('PaginationDto');

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'code',
  'name',
  'fullName',
  'status',
  'amount',
  'totalAmount',
  'date',
  'dueDate',
  'id',
];

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;

  /**
   * Returns the number of records to skip for Prisma pagination.
   */
  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  /**
   * Returns the Prisma-compatible orderBy object.
   */
  get orderBy(): Record<string, 'asc' | 'desc'> {
    if (this.sortBy && !ALLOWED_SORT_FIELDS.includes(this.sortBy)) {
      paginationLogger.warn(
        `Rejected invalid sortBy field '${this.sortBy}'. Allowed fields: ${ALLOWED_SORT_FIELDS.join(', ')}`,
      );
      throw new BadRequestException(
        `Invalid sortBy field '${this.sortBy}'. Allowed fields: ${ALLOWED_SORT_FIELDS.join(', ')}`,
      );
    }
    return {
      [this.sortBy]: this.sortOrder.toLowerCase() as 'asc' | 'desc',
    };
  }
}
