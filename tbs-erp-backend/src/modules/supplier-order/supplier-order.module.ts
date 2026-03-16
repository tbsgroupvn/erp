import { Module, forwardRef } from '@nestjs/common';
import { SupplierOrderController } from './supplier-order.controller';
import { SupplierOrderService } from './supplier-order.service';
import { SupplierOrderRepository } from './supplier-order.repository';
import { SupplierOrderStatusMachine } from './domain/supplier-order-status.machine';
import { OrderModule } from '@modules/order/order.module';
import { CrmModule } from '@modules/crm/crm.module';
import { ExchangeRateModule } from '@modules/exchange-rate/exchange-rate.module';
import { FulfillmentTrackingListener } from './listeners/fulfillment-tracking.listener';
import { ShortfallWalletCreditListener } from './listeners/shortfall-wallet-credit.listener';

@Module({
  imports: [
    forwardRef(() => OrderModule),
    forwardRef(() => CrmModule),
    ExchangeRateModule,
  ],
  controllers: [SupplierOrderController],
  providers: [
    SupplierOrderService,
    SupplierOrderRepository,
    SupplierOrderStatusMachine,
    FulfillmentTrackingListener,
    ShortfallWalletCreditListener,
  ],
  exports: [SupplierOrderService],
})
export class SupplierOrderModule {}
