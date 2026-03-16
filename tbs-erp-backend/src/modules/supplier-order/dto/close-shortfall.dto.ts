import { IsNumber, IsString, IsArray, IsOptional, Min, MinLength, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloseShortfallDto {
  @ApiProperty({ description: 'So tien NCC hoan lai (CNY)', minimum: 0 })
  @IsNumber()
  @Min(0)
  supplierRefundCNY: number;

  @ApiProperty({ description: 'Ly do NCC khong giao du hang', minLength: 10 })
  @IsString()
  @MinLength(10)
  shortfallReason: string;

  @ApiProperty({
    description: 'Bang chung tu NCC (screenshots, chat logs)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  attachments: string[];

  @ApiPropertyOptional({ description: 'Ghi chu bo sung' })
  @IsOptional()
  @IsString()
  note?: string;
}
