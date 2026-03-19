import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class ChangeStatusDto {
  @ApiProperty({
    description: 'New order status',
    enum: OrderStatus,
  })
  @IsEnum(OrderStatus, { message: 'Invalid order status' })
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Note for the status change',
  })
  @SanitizeHtmlStrict()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelOrderDto {
  @ApiProperty({
    description: 'Reason for cancellation (minimum 10 characters)',
    example: 'Customer requested cancellation due to price change',
  })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @MinLength(10, { message: 'Cancellation reason must be at least 10 characters' })
  reason: string;
}
