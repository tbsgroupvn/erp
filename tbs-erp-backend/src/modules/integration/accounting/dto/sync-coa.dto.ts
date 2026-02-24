import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum AccountingProvider {
  MISA = 'MISA',
  FAST = 'FAST',
}

export class SyncChartOfAccountsDto {
  @ApiProperty({
    description: 'Accounting provider to sync with',
    enum: AccountingProvider,
    example: AccountingProvider.MISA,
  })
  @IsEnum(AccountingProvider)
  provider: AccountingProvider;
}
