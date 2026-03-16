import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Danh sach metric hop le
export const VALID_METRICS = [
  'total_orders',
  'total_orders_today',
  'revenue_month',
  'ar_outstanding',
  'ar_overdue',
  'containers_in_transit',
  'packages_in_warehouse_cn',
  'packages_in_warehouse_vn',
  'active_customers',
] as const;

export type MetricKey = (typeof VALID_METRICS)[number];

export class MetricHistoryQueryDto {
  @ApiProperty({
    description: 'Ten metric can xem lich su',
    enum: VALID_METRICS,
    example: 'total_orders',
  })
  @IsString()
  @IsIn(VALID_METRICS)
  metric: MetricKey;

  @ApiPropertyOptional({
    description: 'So ngay lay lich su (mac dinh 30, toi da 365)',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;

  @ApiPropertyOptional({
    description: 'Loc theo chi nhanh (bo trong = tat ca)',
    example: 'HN',
  })
  @IsOptional()
  @IsString()
  branch?: string;
}
