import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of items', example: 150 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;
}

export class BaseResponse<T> {
  @ApiProperty({ description: 'Whether the request was successful' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Response message' })
  message?: string;

  @ApiPropertyOptional({ description: 'Response data' })
  data?: T;

  constructor(data?: T, message?: string, success = true) {
    this.success = success;
    this.message = message;
    this.data = data;
  }

  static ok<T>(data: T, message?: string): BaseResponse<T> {
    return new BaseResponse(data, message, true);
  }

  static error<T>(message: string, data?: T): BaseResponse<T> {
    return new BaseResponse(data, message, false);
  }
}

export class PaginatedResponse<T> extends BaseResponse<T[]> {
  @ApiProperty({ description: 'Pagination metadata', type: PaginationMeta })
  meta: PaginationMeta;

  constructor(data: T[], meta: PaginationMeta, message?: string) {
    super(data, message, true);
    this.meta = meta;
  }

  static paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string,
  ): PaginatedResponse<T> {
    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
    return new PaginatedResponse(data, meta, message);
  }
}
