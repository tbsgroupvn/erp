import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO tao moi seasonal rule
export class CreateSeasonalRuleDto {
  @ApiProperty({
    description: 'Ten quy tac mua vu',
    example: 'Tet Nguyen Dan 2026',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Ngay bat dau hieu luc (ISO 8601)',
    example: '2026-01-20',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Ngay ket thuc hieu luc (ISO 8601)',
    example: '2026-02-05',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description:
      '% dieu chinh gia: duong (+) = tang gia, am (-) = giam gia. ' +
      'Vi du: 15 = tang 15%, -5 = giam 5%.',
    example: 15,
  })
  @IsNumber()
  @Min(-100)
  @Max(200)
  @Type(() => Number)
  adjustPct: number;

  @ApiPropertyOptional({
    description: 'Kich hoat quy tac nay hay khong (mac dinh: true)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// DTO cap nhat seasonal rule (tat ca optional)
export class UpdateSeasonalRuleDto {
  @ApiPropertyOptional({ description: 'Ten quy tac mua vu', example: 'Tet 2026 cap nhat' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Ngay bat dau moi', example: '2026-01-18' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngay ket thuc moi', example: '2026-02-10' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: '% dieu chinh gia moi. Vi du: 20 = tang 20%.',
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(200)
  @Type(() => Number)
  adjustPct?: number;

  @ApiPropertyOptional({ description: 'Kich hoat/vo hieu quy tac', example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
