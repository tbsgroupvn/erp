import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDeclarationDto {
  @ApiProperty({
    description: 'Container ID to create customs declaration from',
    example: 'clxyz1234567890',
  })
  @IsNotEmpty({ message: 'Container ID is required' })
  @IsString()
  containerId: string;
}
