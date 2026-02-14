import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateNettingRequestDto {
  @ApiProperty({ description: 'Counterparty ID (customer or vendor)', example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  counterpartyId: string;

  @ApiProperty({ description: 'Counterparty name', example: 'ABC Trading Co.' })
  @IsString()
  @IsNotEmpty()
  counterpartyName: string;

  @ApiProperty({ description: 'Accounts receivable IDs to include', type: [String] })
  @IsArray()
  @IsString({ each: true })
  arIds: string[];

  @ApiProperty({ description: 'Accounts payable IDs to include', type: [String] })
  @IsArray()
  @IsString({ each: true })
  apIds: string[];

  @ApiProperty({ description: 'Netting amount', example: 15000000 })
  @IsNumber()
  @Min(0)
  nettingAmount: number;

  @ApiPropertyOptional({ description: 'Notes', example: 'Monthly netting for ABC Trading' })
  @IsOptional()
  @IsString()
  notes?: string;
}
