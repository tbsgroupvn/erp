import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WarehouseCNStatus } from '@prisma/client';

export class UpdatePackageStatusDto {
  @ApiProperty({
    description: 'Trang thai moi cua kien hang',
    enum: WarehouseCNStatus,
    example: WarehouseCNStatus.CHECKED,
  })
  @IsEnum(WarehouseCNStatus)
  status: WarehouseCNStatus;
}
