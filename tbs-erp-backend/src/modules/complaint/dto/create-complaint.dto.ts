import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ComplaintType, ComplaintSeverity, ComplaintStatus, ResolutionType } from '@prisma/client';

// Re-export for convenience
export { ComplaintType, ComplaintSeverity, ComplaintStatus, ResolutionType };

export class CreateComplaintDto {
  @ApiProperty({
    description: 'Order ID related to this complaint',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @ApiProperty({
    description: 'Customer ID who filed the complaint',
    example: 'clxyz456def',
  })
  @IsString()
  @IsNotEmpty({ message: 'Customer ID is required' })
  customerId: string;

  @ApiProperty({
    description: 'Type of complaint',
    enum: ComplaintType,
    example: ComplaintType.DAMAGE,
  })
  @IsEnum(ComplaintType, { message: 'Invalid complaint type' })
  type: ComplaintType;

  @ApiProperty({
    description: 'Severity level of the complaint',
    enum: ComplaintSeverity,
    example: ComplaintSeverity.MEDIUM,
  })
  @IsEnum(ComplaintSeverity, { message: 'Invalid severity level' })
  severity: ComplaintSeverity;

  @ApiProperty({
    description: 'Detailed description of the complaint',
    example: 'Items arrived with damaged packaging and broken parts',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Description must be at least 10 characters',
  })
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({
    description: 'URLs of attachment images/documents',
    type: [String],
    example: ['https://storage.example.com/complaint/image1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Package ID related to this complaint',
    example: 'clxyz789ghi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  packageId?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Customer is very upset and requesting urgent resolution',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
