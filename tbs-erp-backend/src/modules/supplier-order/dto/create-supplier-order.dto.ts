import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsArray,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierOrderDto {
  @ApiProperty({ description: 'The parent order ID' })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ description: 'The specific order item ID (if linked to a single item)' })
  @IsOptional()
  @IsString()
  orderItemId?: string;

  @ApiPropertyOptional({ description: 'The vendor ID (internal vendor record)' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiProperty({ description: 'Supplier name (e.g. Taobao store name)' })
  @IsString()
  supplierName: string;

  @ApiPropertyOptional({ description: 'Supplier platform (e.g. Taobao, 1688, Pinduoduo)' })
  @IsOptional()
  @IsString()
  supplierPlatform?: string;

  @ApiPropertyOptional({ description: 'Supplier-side order number' })
  @IsOptional()
  @IsString()
  supplierOrderNumber?: string;

  @ApiPropertyOptional({ description: 'URL to the product or store on the supplier platform' })
  @IsOptional()
  @IsString()
  supplierUrl?: string;

  @ApiPropertyOptional({ description: 'Quoted price in CNY' })
  @IsOptional()
  @IsNumber()
  quotedPriceCNY?: number;

  @ApiPropertyOptional({ description: 'Domestic shipping fee in CNY' })
  @IsOptional()
  @IsNumber()
  shippingFeeCNY?: number;

  @ApiPropertyOptional({ description: 'Quantity ordered from supplier' })
  @IsOptional()
  @IsInt()
  quantityOrdered?: number;

  @ApiPropertyOptional({ description: 'Estimated delivery date from supplier' })
  @IsOptional()
  @IsDateString()
  estimatedDelivery?: string;

  @ApiPropertyOptional({ description: 'Note visible to relevant staff' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Internal note (only visible to XNK team)' })
  @IsOptional()
  @IsString()
  internalNote?: string;

  @ApiPropertyOptional({ description: 'Array of attachment URLs', type: [String] })
  @IsOptional()
  @IsArray()
  attachments?: string[];
}
