import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceReadService } from './finance-read.service';
import { OrderModule } from '../order/order.module';
import { DashboardResolver } from './dashboard.resolver';

@Module({
  imports: [OrderModule],
  controllers: [DashboardController],
  providers: [DashboardService, FinanceReadService, DashboardResolver],
  exports: [DashboardService, FinanceReadService],
})
export class DashboardModule { }
