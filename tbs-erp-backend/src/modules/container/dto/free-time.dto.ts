import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * DTO để cập nhật thông tin miễn phí lưu container tại cảng (Free Time).
 *
 * Free time: Số ngày được lưu container tại cảng/bãi miễn phí.
 * Sau free time sẽ tính phí demurrage (lưu cont) và detention (lưu rỗng).
 *
 * Thông thường:
 *  - FCL: 7–14 ngày free time tại cảng (tùy hãng tàu & cảng)
 *  - LCL: Tính từ ngày hàng về CFS
 */
export class UpdateFreeTimeDto {
  @ApiProperty({
    description: 'Ngày hết miễn phí lưu container tại cảng (ISO 8601)',
    example: '2026-03-13T23:59:59Z',
  })
  @IsDateString()
  freeTimeExpiry: string;

  @ApiPropertyOptional({
    description: 'Ghi chú về lưu bãi / lưu cont (demurrage/detention)',
    example: 'Free time 10 ngày theo hợp đồng với COSCO, bắt đầu từ ngày 04/03/2026',
  })
  @IsOptional()
  @IsString()
  demurrageNote?: string;
}
