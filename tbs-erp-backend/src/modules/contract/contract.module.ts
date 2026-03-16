import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractExportService } from './contract-export.service';

@Module({
  imports: [ConfigModule],
  controllers: [ContractController],
  providers: [ContractService, ContractExportService],
  exports: [ContractService],
})
export class ContractModule {}
