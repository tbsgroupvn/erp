import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator';

export class GroupItemsDto {
  @ApiProperty({
    description: 'Array of line IDs to group together',
    example: ['clxyz1234', 'clxyz5678'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'At least 2 lines must be selected for grouping' })
  @IsString({ each: true })
  lineIds: string[];

  @ApiProperty({
    description: 'Declared description for the grouped line',
    example: 'Mixed cotton garments',
  })
  @IsNotEmpty({ message: 'Declared description is required' })
  @IsString()
  declaredDescription: string;

  @ApiProperty({
    description: 'Declared HS code for the grouped line',
    example: '6204.43.00',
  })
  @IsNotEmpty({ message: 'Declared HS code is required' })
  @IsString()
  declaredHsCode: string;

  @ApiProperty({
    description: 'Declared unit for the grouped line',
    example: 'KG',
  })
  @IsNotEmpty({ message: 'Declared unit is required' })
  @IsString()
  declaredUnit: string;
}
