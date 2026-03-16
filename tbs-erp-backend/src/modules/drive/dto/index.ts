import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { DrivePermission } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ description: 'Tên thư mục' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'ID thư mục cha (null = root)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Scope phòng ban / nhóm' })
  @IsOptional()
  @IsString()
  teamScope?: string;
}

export class RenameFolderDto {
  @ApiProperty({ description: 'Tên mới' })
  @IsString()
  name: string;
}

export class RequestUploadDto {
  @ApiProperty({ description: 'Tên file gốc' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'MIME type, ví dụ application/pdf' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'Kích thước file theo byte' })
  @IsInt()
  @Min(1)
  @Max(524288000) // 500MB max
  size: number;

  @ApiPropertyOptional({ description: 'ID thư mục đích' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Mô tả file' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], description: 'Danh sách tag' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ConfirmUploadDto {
  @ApiProperty({ description: 'Storage key trả về từ requestUpload' })
  @IsString()
  storageKey: string;

  @ApiProperty({ description: 'Tên file hiển thị' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'MIME type' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'Kích thước file theo byte' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiPropertyOptional({ description: 'ID thư mục đích' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Mô tả file' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class MoveFileDto {
  @ApiPropertyOptional({ description: 'ID thư mục đích, null = root' })
  @IsOptional()
  @IsString()
  folderId?: string;
}

export class ShareFileDto {
  @ApiPropertyOptional({ description: 'ID user được chia sẻ (null = public link)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: DrivePermission })
  @IsEnum(DrivePermission)
  permission: DrivePermission;

  @ApiPropertyOptional({ description: 'Ngày hết hạn ISO 8601' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Tạo public share token' })
  @IsOptional()
  @IsBoolean()
  generateLink?: boolean;
}

export class RequestNewVersionDto {
  @ApiProperty({ description: 'Tên file mới' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'MIME type' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'Kích thước file theo byte' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiPropertyOptional({ description: 'Ghi chú thay đổi' })
  @IsOptional()
  @IsString()
  changeNote?: string;
}

export class ConfirmNewVersionDto {
  @ApiProperty({ description: 'Storage key từ presigned URL' })
  @IsString()
  storageKey: string;

  @ApiProperty({ description: 'Kích thước file theo byte' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiProperty({ description: 'MIME type' })
  @IsString()
  mimeType: string;

  @ApiPropertyOptional({ description: 'Ghi chú thay đổi' })
  @IsOptional()
  @IsString()
  changeNote?: string;
}

export class FileQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo folder ID' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo MIME type prefix, vd image/' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SearchFilesDto {
  @ApiProperty({ description: 'Từ khoá tìm kiếm' })
  @IsString()
  q: string;

  @ApiPropertyOptional({ description: 'Lọc theo MIME type prefix' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
