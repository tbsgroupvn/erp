import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

export enum ExpenseCategory {
  TRAVEL = 'TRAVEL',
  MEAL = 'MEAL',
  TRANSPORT = 'TRANSPORT',
  OFFICE = 'OFFICE',
  PHONE = 'PHONE',
  OTHER = 'OTHER',
}

export class CreateExpenseItemDto {
  @ApiProperty({ enum: ExpenseCategory, description: 'Danh mục chi phí' })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ description: 'Mô tả khoản chi' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Số tiền (VND)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Ngày phát sinh (ISO date string)', example: '2026-03-01' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'URL hóa đơn/biên lai' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class CreateExpenseDto {
  @ApiProperty({ description: 'Tiêu đề đề nghị thanh toán' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Ghi chú / mô tả thêm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tiền tệ', default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Danh sách khoản chi', type: [CreateExpenseItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseItemDto)
  items?: CreateExpenseItemDto[];
}
