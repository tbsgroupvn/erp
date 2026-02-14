import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { CODStatus } from '@prisma/client';

export class CodQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: CODStatus })
  @IsOptional()
  @IsEnum(CODStatus)
  status?: CODStatus;

  @ApiPropertyOptional({ description: 'Filter by driver ID' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
