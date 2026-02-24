import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { CustomsDeclarationStatus, CustomsChannel } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class DeclarationQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by declaration status',
    enum: CustomsDeclarationStatus,
    example: CustomsDeclarationStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(CustomsDeclarationStatus, { message: 'Invalid declaration status' })
  status?: CustomsDeclarationStatus;

  @ApiPropertyOptional({
    description: 'Filter by customs channel',
    enum: CustomsChannel,
    example: CustomsChannel.GREEN,
  })
  @IsOptional()
  @IsEnum(CustomsChannel, { message: 'Invalid customs channel' })
  channel?: CustomsChannel;

  @ApiPropertyOptional({
    description: 'Filter by container ID',
    example: 'clxyz1234567890',
  })
  @IsOptional()
  @IsString()
  containerId?: string;

  @ApiPropertyOptional({
    description: 'Search by declaration code, importer name, or BL/AWB number',
    example: 'CD-202501',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Start date for date range filter (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for date range filter (ISO 8601)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  @ValidateIf((o) => o.startDate !== undefined)
  endDate?: string;
}
