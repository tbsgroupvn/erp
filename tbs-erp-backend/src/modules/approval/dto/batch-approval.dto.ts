import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class BatchApproveDto {
  @ApiProperty({ type: [String], description: 'Danh sách approval IDs cần duyệt' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  approvalIds: string[];

  @ApiPropertyOptional({ description: 'Ghi chú chung cho tất cả' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BatchRejectDto {
  @ApiProperty({ type: [String], description: 'Danh sách approval IDs cần từ chối' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  approvalIds: string[];

  @ApiPropertyOptional({ description: 'Lý do từ chối chung' })
  @IsOptional()
  @IsString()
  comment?: string;
}
