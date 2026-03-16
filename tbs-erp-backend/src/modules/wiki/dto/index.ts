import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { WikiAccess } from '@prisma/client';

// ============================================================
// CreateSpaceDto
// ============================================================
export class CreateSpaceDto {
  @ApiProperty({ description: 'Tên space', example: 'Hướng dẫn vận hành' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    description: 'Slug duy nhất (lowercase, dấu gạch ngang)',
    example: 'huong-dan-van-hanh',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang',
  })
  slug: string;

  @ApiPropertyOptional({ description: 'Mô tả space' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Emoji hoặc tên icon', example: '📚' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ description: 'Màu accent (#hex)', example: '#3b82f6' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Màu phải theo định dạng #RRGGBB' })
  color?: string;

  @ApiPropertyOptional({
    description: 'Phạm vi truy cập',
    enum: WikiAccess,
    default: WikiAccess.PUBLIC,
  })
  @IsOptional()
  @IsEnum(WikiAccess)
  access?: WikiAccess;

  @ApiPropertyOptional({ description: 'Tên nhóm/phòng ban (khi access = TEAM)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  teamScope?: string;
}

// ============================================================
// UpdateSpaceDto
// ============================================================
export class UpdateSpaceDto extends PartialType(CreateSpaceDto) {}

// ============================================================
// CreatePageDto
// ============================================================
export class CreatePageDto {
  @ApiProperty({ description: 'ID của space' })
  @IsString()
  @IsNotEmpty()
  spaceId: string;

  @ApiProperty({ description: 'Tiêu đề trang', example: 'Quy trình nhận hàng kho TQ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Nội dung HTML (đã sanitize phía client)' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'ID trang cha (để tạo subtree)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Vị trí trong cùng cấp (0-based)', default: 0 })
  @IsOptional()
  @IsInt()
  position?: number;
}

// ============================================================
// UpdatePageDto
// ============================================================
export class UpdatePageDto {
  @ApiPropertyOptional({ description: 'Tiêu đề mới' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Nội dung HTML mới' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Publish/unpublish trang' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'ID trang cha mới' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Vị trí mới trong cùng cấp' })
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiPropertyOptional({ description: 'Ghi chú thay đổi (hiện trong version history)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeSummary?: string;
}

// ============================================================
// MovePageDto
// ============================================================
export class MovePageDto {
  @ApiPropertyOptional({ description: 'ID trang cha mới (null = root)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ description: 'Vị trí mới trong cùng cấp' })
  @IsInt()
  position: number;
}

// ============================================================
// WikiQueryDto
// ============================================================
export class WikiQueryDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên/nội dung trang' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo space ID' })
  @IsOptional()
  @IsString()
  spaceId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tác giả ID' })
  @IsOptional()
  @IsString()
  authorId?: string;
}
