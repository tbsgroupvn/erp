import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Config
import appConfig from '@config/app.config';
import databaseConfig from '@config/database.config';
import jwtConfig from '@config/jwt.config';
import redisConfig from '@config/redis.config';
import storageConfig from '@config/storage.config';
import businessConfig from '@config/business.config';

// Core
import { DatabaseModule } from '@core/database/database.module';
import { AuthModule } from '@core/auth/auth.module';
import { RbacModule } from '@core/rbac/rbac.module';
import { EventBusModule } from '@core/event-bus/event-bus.module';
import { CacheModule } from '@core/cache/cache.module';
import { HealthModule } from '@core/health/health.module';

// Modules — Nhóm A: Vận hành Logistics
import { OrderModule } from '@modules/order/order.module';
import { QuotationModule } from '@modules/quotation/quotation.module';
import { ContainerModule } from '@modules/container/container.module';
import { WarehouseCNModule } from '@modules/warehouse-cn/warehouse-cn.module';
import { WarehouseVNModule } from '@modules/warehouse-vn/warehouse-vn.module';
import { TrackingModule } from '@modules/tracking/tracking.module';
import { ComplaintModule } from '@modules/complaint/complaint.module';
import { OperationCostModule } from '@modules/operation-cost/operation-cost.module';
import { SupplierOrderModule } from '@modules/supplier-order/supplier-order.module';
import { QCModule } from '@modules/qc/qc.module';

// Modules — Nhóm B: Quan hệ Khách hàng
import { CrmModule } from '@modules/crm/crm.module';
import { VendorModule } from '@modules/vendor/vendor.module';
import { ContractModule } from '@modules/contract/contract.module';
import { MarketingModule } from '@modules/marketing/marketing.module';

// Modules — Nhóm C: Tài chính Kế toán
import { GeneralLedgerModule } from '@modules/general-ledger/general-ledger.module';
import { AccountsReceivableModule } from '@modules/accounts-receivable/accounts-receivable.module';
import { AccountsPayableModule } from '@modules/accounts-payable/accounts-payable.module';
import { CashModule } from '@modules/cash/cash.module';
import { AssetModule } from '@modules/asset/asset.module';
import { InvoiceModule } from '@modules/invoice/invoice.module';
import { BudgetModule } from '@modules/budget/budget.module';
import { PurchaseModule } from '@modules/purchase/purchase.module';
import { InventoryModule } from '@modules/inventory/inventory.module';

// Modules — Nhóm D: Vận tải
import { FleetModule } from '@modules/fleet/fleet.module';
import { DriverModule } from '@modules/driver/driver.module';

// Modules — Nhóm E: Nhân sự
import { EmployeeModule } from '@modules/employee/employee.module';
import { AttendanceModule } from '@modules/attendance/attendance.module';
import { PayrollModule } from '@modules/payroll/payroll.module';
import { PerformanceModule } from '@modules/performance/performance.module';
import { TrainingModule } from '@modules/training/training.module';

// Modules — Nhóm F: Hệ thống
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { ApprovalModule } from '@modules/approval/approval.module';
import { TaskModule } from '@modules/task/task.module';
import { CalendarModule } from '@modules/calendar/calendar.module';
import { MessageModule } from '@modules/message/message.module';
import { EmailModule } from '@modules/email/email.module';
import { DocumentModule } from '@modules/document/document.module';
import { NotificationModule } from '@modules/notification/notification.module';

// Modules — Nhóm G: Mở rộng
import { ExchangeRateModule } from '@modules/exchange-rate/exchange-rate.module';
import { CommissionModule } from '@modules/commission/commission.module';
import { CustomerPortalModule } from '@modules/customer-portal/customer-portal.module';
import { CodModule } from '@modules/cod/cod.module';
import { LostAndFoundModule } from '@modules/lost-and-found/lost-and-found.module';
import { DebtNettingModule } from '@modules/debt-netting/debt-netting.module';
import { BlogModule } from '@modules/blog/blog.module';
import { PublicModule } from '@modules/public/public.module';

// Modules — Nhóm H: CMS (Content Management System)
import { CmsPagesModule } from '@modules/cms-pages/cms-pages.module';
import { CmsMediaModule } from '@modules/cms-media/cms-media.module';
import { CmsMenuModule } from '@modules/cms-menu/cms-menu.module';
import { CmsSettingsModule } from '@modules/cms-settings/cms-settings.module';
import { ContactsModule } from '@modules/cms-contacts/contacts.module';
import { NewsletterModule } from '@modules/cms-newsletter/newsletter.module';
import { FaqModule } from '@modules/cms-faq/faq.module';
import { CmsBlogModule } from '@modules/cms-blog/cms-blog.module';

// Common Services
import { SLAMonitorService } from '@common/services/sla-monitor.service';
import { CsrfGuard } from '@common/guards/csrf.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [
    SLAMonitorService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
  imports: [
    // ─── Global Config ───
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, storageConfig, businessConfig],
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    ScheduleModule.forRoot(),

    // ─── Core Infrastructure ───
    DatabaseModule,
    AuthModule,
    RbacModule,
    EventBusModule,
    CacheModule,
    HealthModule,

    // ─── Nhóm A: Vận hành Logistics ───
    OrderModule,
    QuotationModule,
    ContainerModule,
    WarehouseCNModule,
    WarehouseVNModule,
    TrackingModule,
    ComplaintModule,
    OperationCostModule,
    SupplierOrderModule,
    QCModule,

    // ─── Nhóm B: Quan hệ Khách hàng ───
    CrmModule,
    VendorModule,
    ContractModule,
    MarketingModule,

    // ─── Nhóm C: Tài chính Kế toán ───
    GeneralLedgerModule,
    AccountsReceivableModule,
    AccountsPayableModule,
    CashModule,
    AssetModule,
    InvoiceModule,
    BudgetModule,
    PurchaseModule,
    InventoryModule,

    // ─── Nhóm D: Vận tải ───
    FleetModule,
    DriverModule,

    // ─── Nhóm E: Nhân sự ───
    EmployeeModule,
    AttendanceModule,
    PayrollModule,
    PerformanceModule,
    TrainingModule,

    // ─── Nhóm F: Hệ thống ───
    DashboardModule,
    ApprovalModule,
    TaskModule,
    CalendarModule,
    MessageModule,
    EmailModule,
    DocumentModule,
    NotificationModule,

    // ─── Nhóm G: Mở rộng ───
    ExchangeRateModule,
    CommissionModule,
    CustomerPortalModule,
    CodModule,
    LostAndFoundModule,
    DebtNettingModule,
    BlogModule,

    // ─── Nhóm H: CMS ───
    CmsPagesModule,
    CmsMediaModule,
    CmsMenuModule,
    CmsSettingsModule,
    ContactsModule,
    NewsletterModule,
    FaqModule,
    CmsBlogModule,

    // ─── Public API (No Auth) ───
    PublicModule,
  ],
})
export class AppModule {}
