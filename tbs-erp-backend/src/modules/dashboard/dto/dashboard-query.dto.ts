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

  @ApiPropertyOptional({ description: 'Start date — alias: dateFrom (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date — alias: dateTo (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  // Frontend aliases: dateFrom / dateTo
  @ApiPropertyOptional({ description: 'Start date (frontend alias for startDate)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date (frontend alias for endDate)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by branch', enum: Branch })
  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  /**
   * Resolve the date range.
   * Priority: dateFrom/dateTo (frontend) → startDate/endDate → period enum → default MONTH
   */
  getDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    // Accept dateFrom/dateTo aliases from frontend
    const fromStr = this.dateFrom ?? this.startDate;
    const toStr = this.dateTo ?? this.endDate;

    if (fromStr) {
      const start = new Date(fromStr);
      start.setHours(0, 0, 0, 0);
      const customEnd = toStr ? new Date(toStr) : end;
      customEnd.setHours(23, 59, 59, 999);
      return { start, end: customEnd };
    }

    let start: Date;

    switch (this.period) {
      case DashboardPeriod.TODAY:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;

      case DashboardPeriod.WEEK:
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
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

      case DashboardPeriod.MONTH:
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return { start: start!, end };
  }
}
