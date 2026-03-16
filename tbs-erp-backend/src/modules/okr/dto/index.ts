import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OKRPeriod, OKRLevel, OKRStatus, KeyResultStatus } from '@prisma/client';

export class CreateObjectiveDto {
  @ApiProperty({ description: 'Tieu de muc tieu' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Mo ta chi tiet' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: OKRPeriod, description: 'Chu ky OKR' })
  @IsEnum(OKRPeriod)
  period: OKRPeriod;

  @ApiProperty({ description: 'Nam (VD: 2026)', minimum: 2020, maximum: 2099 })
  @IsInt()
  @Min(2020)
  @Max(2099)
  year: number;

  @ApiProperty({ enum: OKRLevel, description: 'Cap do OKR' })
  @IsEnum(OKRLevel)
  level: OKRLevel;

  @ApiPropertyOptional({ description: 'Ten phong ban' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'ID muc tieu cha (neu co)' })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateObjectiveDto {
  @ApiPropertyOptional({ description: 'Tieu de muc tieu' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Mo ta chi tiet' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: OKRStatus, description: 'Trang thai' })
  @IsOptional()
  @IsEnum(OKRStatus)
  status?: OKRStatus;
}

export class CreateKeyResultDto {
  @ApiProperty({ description: 'Tieu de ket qua then chot' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Mo ta chi tiet' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Loai chi so: PERCENTAGE, NUMBER, BOOLEAN, CURRENCY',
    default: 'PERCENTAGE',
  })
  @IsString()
  metricType: string;

  @ApiProperty({ description: 'Gia tri muc tieu' })
  @IsNumber()
  targetValue: number;

  @ApiPropertyOptional({ description: 'Don vi (%%, VND, don hang, ...)' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Han hoan thanh (ISO date)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateKeyResultDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ enum: KeyResultStatus })
  @IsOptional()
  @IsEnum(KeyResultStatus)
  status?: KeyResultStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CheckInDto {
  @ApiProperty({ description: 'Gia tri cap nhat hien tai' })
  @IsNumber()
  value: number;

  @ApiPropertyOptional({ description: 'Ghi chu cap nhat' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class OKRQueryDto {
  @ApiPropertyOptional({ enum: OKRPeriod })
  @IsOptional()
  @IsEnum(OKRPeriod)
  period?: OKRPeriod;

  @ApiPropertyOptional({ description: 'Nam (VD: 2026)' })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  year?: number;

  @ApiPropertyOptional({ enum: OKRLevel })
  @IsOptional()
  @IsEnum(OKRLevel)
  level?: OKRLevel;

  @ApiPropertyOptional({ description: 'Loc theo owner ID' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ enum: OKRStatus })
  @IsOptional()
  @IsEnum(OKRStatus)
  status?: OKRStatus;
}
