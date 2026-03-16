import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VALID_METRICS, MetricKey } from './metric-history.dto';

// Metric ho tro drill-down
export const DRILLDOWN_METRICS = [
  'total_orders',
  'ar_outstanding',
  'containers_in_transit',
  'active_customers',
] as const;

export type DrillDownMetricKey = (typeof DRILLDOWN_METRICS)[number];

export class DrillDownQueryDto {
  @ApiProperty({
    description: 'Ten metric can xem chi tiet',
    enum: DRILLDOWN_METRICS,
    example: 'total_orders',
  })
  @IsString()
  @IsIn(DRILLDOWN_METRICS)
  metric: DrillDownMetricKey;

  @ApiPropertyOptional({
    description: 'So trang (bat dau tu 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'So ban ghi moi trang (toi da 100)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Loc theo chi nhanh',
    example: 'HN',
  })
  @IsOptional()
  @IsString()
  branch?: string;
}
