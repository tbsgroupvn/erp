import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { CarrierReconStatus } from '@prisma/client';

export class CarrierReconQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CarrierReconStatus })
  @IsOptional()
  @IsEnum(CarrierReconStatus)
  status?: CarrierReconStatus;

  @ApiPropertyOptional({ description: 'Filter by carrier name' })
  @IsOptional()
  @IsString()
  carrierName?: string;

  @ApiPropertyOptional({ description: 'Ngay bat dau' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngay ket thuc' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
