import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

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
    return {
      [this.sortBy]: this.sortOrder.toLowerCase() as 'asc' | 'desc',
    };
  }
}
