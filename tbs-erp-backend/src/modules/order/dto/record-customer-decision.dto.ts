import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordCustomerDecisionDto {
  @ApiProperty({
    description: 'Customer decision on the MHH issue',
    enum: ['KEEP', 'RETURN', 'EXCHANGE'],
    example: 'KEEP',
  })
  @IsString()
  @IsNotEmpty({ message: 'Customer decision is required' })
  @IsIn(['KEEP', 'RETURN', 'EXCHANGE'], {
    message: 'Decision must be one of: KEEP, RETURN, EXCHANGE',
  })
  decision: string;

  @ApiPropertyOptional({
    description: 'Optional note from the customer explaining their decision',
    example: 'I will keep the item with a price adjustment',
  })
  @IsOptional()
  @IsString()
  customerNote?: string;
}
