import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { SanitizeHtmlStrict } from '@common/decorators/sanitize-html.decorator';

export class CreateTicketDto {
  @ApiProperty({
    description: 'Customer ID associated with this ticket',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Customer ID is required' })
  customerId: string;

  @ApiProperty({
    description: 'Ticket category',
    example: 'ORDER_ISSUE',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @ApiProperty({
    description: 'Ticket subject',
    example: 'Issue with order delivery',
    maxLength: 500,
  })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  @MaxLength(500)
  subject: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'My order arrived with missing items and damaged packaging.',
    maxLength: 5000,
  })
  @SanitizeHtmlStrict()
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({
    description: 'Ticket priority level',
    example: 'HIGH',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'User ID to assign this ticket to',
    example: 'clxyz456def',
  })
  @IsOptional()
  @IsString()
  assignedTo?: string;
}
