import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQCInspectionDto {
  @ApiProperty({ description: 'Order ID to create QC inspection for' })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ description: 'Package ID (optional, links QC to a specific package)' })
  @IsOptional()
  @IsString()
  packageId?: string;
}
