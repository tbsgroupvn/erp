import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, MinLength } from 'class-validator';

/**
 * DTO để ghi nhận lệnh giao hàng (D/O — Delivery Order).
 *
 * D/O là chứng từ bắt buộc để nhận container từ cảng sau khi:
 * - Đã hoàn thành thủ tục hải quan (tờ khai thông quan)
 * - Đã thanh toán đầy đủ cước tàu và các phụ phí cho đại lý tàu
 */
export class RecordDeliveryOrderDto {
  @ApiProperty({
    description: 'Số lệnh giao hàng (D/O)',
    example: 'DO-EG-2026-001234',
  })
  @IsString()
  @MinLength(2)
  doNumber: string;

  @ApiPropertyOptional({
    description: 'Ngày nhận D/O từ đại lý tàu (ISO 8601). Mặc định: ngày hiện tại.',
    example: '2026-03-06T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  doReceivedAt?: string;

  @ApiPropertyOptional({
    description: 'Ngày hết hạn D/O (thường 7–14 ngày từ ngày phát hành)',
    example: '2026-03-13T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  doExpiryAt?: string;

  @ApiPropertyOptional({
    description: 'Đại lý tàu phát hành D/O',
    example: 'Evergreen Shipping Agency VN',
  })
  @IsOptional()
  @IsString()
  doIssuedBy?: string;
}
