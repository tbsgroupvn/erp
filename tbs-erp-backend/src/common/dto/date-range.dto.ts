import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, ValidateIf } from 'class-validator';

export class DateRangeDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601 format)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601 format)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.startDate !== undefined)
  endDate?: string;

  /**
   * Returns a Prisma-compatible date filter object for a given field name.
   * If neither date is set, returns undefined.
   *
   * @example
   * const filter = dateRange.toPrismaFilter('createdAt');
   * // { createdAt: { gte: '2025-01-01T00:00:00.000Z', lte: '2025-12-31T23:59:59.999Z' } }
   */
  toPrismaFilter(
    fieldName: string,
  ): Record<string, { gte?: Date; lte?: Date }> | undefined {
    if (!this.startDate && !this.endDate) {
      return undefined;
    }

    const filter: { gte?: Date; lte?: Date } = {};

    if (this.startDate) {
      filter.gte = new Date(this.startDate);
    }

    if (this.endDate) {
      // Set end date to the end of the day
      const endOfDay = new Date(this.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filter.lte = endOfDay;
    }

    return { [fieldName]: filter };
  }
}
