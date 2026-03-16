import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { ShippingRoute } from '@prisma/client';

export class CreateContainerDto {
  @ApiProperty({
    description: 'Tuyến vận chuyển',
    enum: ShippingRoute,
    example: ShippingRoute.SEA,
  })
  @IsEnum(ShippingRoute, { message: 'Invalid shipping route' })
  shippingRoute: ShippingRoute;

  @ApiPropertyOptional({ description: 'Kho xuất phát (TQ)', example: 'Kho Quảng Châu' })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({ description: 'Kho đến (VN)', example: 'Kho Hà Nội' })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({ description: 'Hãng vận chuyển', example: 'COSCO Shipping' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ description: 'Mã booking (đặt chỗ)', example: 'BK-2026-001234' })
  @IsOptional()
  @IsString()
  bookingRef?: string;

  @ApiPropertyOptional({ description: 'Số chì niêm phong', example: 'SEAL123456' })
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional({ description: 'Tên tàu / xe', example: 'COSCO SHIPPING ARIES' })
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional({ description: 'Sức chứa tối đa (kg)', example: 20000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCapacity?: number;

  @ApiPropertyOptional({ description: 'Ngày khởi hành dự kiến (ISO 8601)', example: '2026-02-15T08:00:00Z' })
  @IsOptional()
  @IsDateString()
  estimatedDepartureAt?: string;

  @ApiPropertyOptional({ description: 'Ngày đến dự kiến (ISO 8601)', example: '2026-03-01T08:00:00Z' })
  @IsOptional()
  @IsDateString()
  estimatedArrivalAt?: string;

  // === THÔNG TIN CONTAINER & VẬN ĐƠN ===

  @ApiPropertyOptional({ description: 'Số container ISO (4 chữ + 7 số)', example: 'MSKU1234567' })
  @IsOptional()
  @IsString()
  containerNumber?: string;

  @ApiPropertyOptional({
    description: 'Kích thước container',
    example: '40DC',
    enum: ['20DC', '40DC', '40HC', 'LCL'],
  })
  @IsOptional()
  @IsString()
  containerSize?: string;

  @ApiPropertyOptional({ description: 'Số vận đơn (Bill of Lading / AWB)', example: 'COSU1234567890' })
  @IsOptional()
  @IsString()
  blNumber?: string;

  @ApiPropertyOptional({ description: 'Số chuyến tàu', example: '2603N' })
  @IsOptional()
  @IsString()
  voyageNumber?: string;

  @ApiPropertyOptional({ description: 'Cảng xếp hàng', example: 'Cảng Quảng Châu' })
  @IsOptional()
  @IsString()
  portOfLoading?: string;

  @ApiPropertyOptional({ description: 'Cảng dỡ hàng (VN)', example: 'Cảng Hải Phòng' })
  @IsOptional()
  @IsString()
  portOfDischarge?: string;

  @ApiPropertyOptional({ description: 'Cửa khẩu khai báo hải quan', example: 'Cảng Hải Phòng KV1' })
  @IsOptional()
  @IsString()
  customsOfficeCode?: string;

  @ApiPropertyOptional({ description: 'Khối lượng tổng đã xác nhận VGM (kg)', example: 18500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  declaredVgm?: number;
}
