import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierOrderStatus } from '@prisma/client';

export class ChangeSupplierOrderStatusDto {
  @ApiProperty({
    enum: SupplierOrderStatus,
    description: 'The target status to transition to',
  })
  @IsEnum(SupplierOrderStatus)
  status: SupplierOrderStatus;

  @ApiPropertyOptional({ description: 'Optional note explaining the status change' })
  @IsOptional()
  @IsString()
  note?: string;
}
