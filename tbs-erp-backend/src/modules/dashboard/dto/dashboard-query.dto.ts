import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { Branch } from '@prisma/client';

export enum DashboardPeriod {
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
  CUSTOM = 'CUSTOM',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Period for aggregation',
    enum: DashboardPeriod,
    default: DashboardPeriod.MONTH,
  })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;

  @ApiPropertyOptional({ description: 'Start date (for CUSTOM period)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (for CUSTOM period)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by branch', enum: Branch })
  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  /**
   * Resolve the date range from the period.
   */
  getDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start: Date;

    switch (this.period) {
      case DashboardPeriod.TODAY:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;

      case DashboardPeriod.WEEK:
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        start.setHours(0, 0, 0, 0);
        break;

      case DashboardPeriod.QUARTER:
        start = new Date(now);
        start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
        start.setHours(0, 0, 0, 0);
        break;

      case DashboardPeriod.YEAR:
        start = new Date(now.getFullYear(), 0, 1);
        break;

      case DashboardPeriod.CUSTOM:
        start = this.startDate ? new Date(this.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        if (this.endDate) {
          const customEnd = new Date(this.endDate);
          customEnd.setHours(23, 59, 59, 999);
          return { start, end: customEnd };
        }
        break;

      case DashboardPeriod.MONTH:
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return { start: start!, end };
  }
}
