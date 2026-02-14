import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerDecisionDto {
  @ApiProperty({ description: 'Whether the customer approved the QC results' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: 'Customer feedback or note' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}
