import { Module, forwardRef } from '@nestjs/common';
import { SupplierOrderController } from './supplier-order.controller';
import { SupplierOrderService } from './supplier-order.service';
import { SupplierOrderRepository } from './supplier-order.repository';
import { SupplierOrderStatusMachine } from './domain/supplier-order-status.machine';
import { OrderModule } from '@modules/order/order.module';

@Module({
  imports: [forwardRef(() => OrderModule)],
  controllers: [SupplierOrderController],
  providers: [
    SupplierOrderService,
    SupplierOrderRepository,
    SupplierOrderStatusMachine,
  ],
  exports: [SupplierOrderService],
})
export class SupplierOrderModule {}
