import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BatchScanDto {
  @ApiProperty({ description: 'Danh sach ma van don can scan (toi da 50)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'Phai co it nhat 1 ma van don' })
  @ArrayMaxSize(50, { message: 'Khong duoc scan qua 50 ma van don cung luc' })
  trackingNumbers: string[];
}
