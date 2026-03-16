import { IsString, IsEnum, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ResolveAction {
  RESOLVE = 'RESOLVE',   // Danh dau da giai quyet (khong xu ly tai chinh)
  PROCESS = 'PROCESS',   // Giai quyet + xu ly (credit wallet, clear AR)
  SKIP = 'SKIP',         // Bo qua dong nay
}

export class ResolveExceptionDto {
  @ApiProperty({ description: 'Ghi chu giai quyet' })
  @IsString()
  @MinLength(5)
  resolutionNote: string;

  @ApiProperty({ enum: ResolveAction, description: 'Hanh dong: RESOLVE, PROCESS, SKIP' })
  @IsEnum(ResolveAction)
  action: ResolveAction;
}
