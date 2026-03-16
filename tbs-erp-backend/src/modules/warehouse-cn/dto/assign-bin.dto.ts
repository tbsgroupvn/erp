import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO gan kien hang vao o hang cu the.
 * Nhan vao ID kien hang va ID o hang.
 */
export class AssignBinDto {
  @ApiProperty({
    description: 'ID cua kien hang can gan vao o hang',
    example: 'clxyz1234567890',
  })
  @IsString()
  @IsNotEmpty({ message: 'packageId khong duoc de trong' })
  packageId: string;

  @ApiProperty({
    description: 'ID cua o hang se nhan kien',
    example: 'clxyz0987654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'binId khong duoc de trong' })
  binId: string;
}
