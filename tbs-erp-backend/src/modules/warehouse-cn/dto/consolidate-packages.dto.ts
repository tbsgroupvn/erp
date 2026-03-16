import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsNotEmpty, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class ConsolidatePackagesDto {
  @ApiProperty({ description: 'ID khach hang chu so huu cac kien hang' })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Danh sach ID kien hang can gop', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2, { message: 'Phai chon it nhat 2 kien hang de gop' })
  @ArrayMaxSize(200, { message: 'Khong duoc gop qua 200 kien hang cung luc' })
  packageIds: string[];
}
