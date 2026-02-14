import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentCategory } from '@prisma/client';
import { PaginationDto } from '@common/dto/pagination.dto';

export class DocumentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by entity type' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Filter by entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by category', enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;
}
