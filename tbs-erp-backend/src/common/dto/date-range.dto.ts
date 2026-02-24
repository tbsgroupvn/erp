import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { BadRequestException } from '@nestjs/common';

/** Maximum allowed date range in days (365 days = ~1 year). */
const MAX_DATE_RANGE_DAYS = 365;

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
  endDate?: string;

  /**
   * Validates that startDate is before endDate and the range does not exceed
   * the maximum allowed days. Throws BadRequestException on invalid ranges.
   */
  validate(): void {
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);

      if (start > end) {
        throw new BadRequestException(
          'startDate must be before or equal to endDate',
        );
      }

      const diffMs = end.getTime() - start.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > MAX_DATE_RANGE_DAYS) {
        throw new BadRequestException(
          `Date range must not exceed ${MAX_DATE_RANGE_DAYS} days. Requested range: ${Math.ceil(diffDays)} days`,
        );
      }
    }
  }

  /**
   * Returns a Prisma-compatible date filter object for a given field name.
   * If neither date is set, returns undefined.
   * Validates the date range before building the filter.
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

    this.validate();

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
