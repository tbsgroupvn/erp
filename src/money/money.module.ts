import { Module } from '@nestjs/common';
import { GlService } from './gl.service';
import { GlMapService } from './gl-map.service';
import { HoldService } from './hold.service';
import { WalletService } from './wallet.service';
import { FxRateService } from './fx-rate.service';
import { TreasuryService } from './treasury.service';
import { WalletController } from './wallet.controller';

@Module({
  controllers: [WalletController],
  providers: [GlService, GlMapService, HoldService, WalletService, FxRateService, TreasuryService],
  exports: [WalletService, FxRateService, GlService, GlMapService, HoldService, TreasuryService],
})
export class MoneyModule {}
