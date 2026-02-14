import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * DTO for receiving packages at Warehouse VN.
 * Used when a container arrives and its packages are unloaded.
 */
export class ReceiveVNDto {
  @ApiProperty({
    description: 'Container ID from which packages are being received',
    example: 'clxyz123abc',
  })
  @IsString()
  @IsNotEmpty({ message: 'Container ID is required' })
  containerId: string;

  @ApiProperty({
    description: 'Package IDs being received from the container',
    example: ['clpkg001', 'clpkg002', 'clpkg003'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  packageIds: string[];

  @ApiPropertyOptional({
    description: 'Notes about the receiving (e.g., damage, missing items)',
    example: 'All packages in good condition',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
