import { Module } from '@nestjs/common';
import { SupplierOrderController } from './supplier-order.controller';
import { SupplierOrderService } from './supplier-order.service';
import { SupplierOrderRepository } from './supplier-order.repository';
import { SupplierOrderStatusMachine } from './domain/supplier-order-status.machine';

@Module({
  controllers: [SupplierOrderController],
  providers: [
    SupplierOrderService,
    SupplierOrderRepository,
    SupplierOrderStatusMachine,
  ],
  exports: [SupplierOrderService],
})
export class SupplierOrderModule {}
