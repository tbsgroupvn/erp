import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
import brandingConfig from '@config/branding.config';
import { sentryConfig } from '@config/sentry.config';
import integrationsConfig from '@config/integrations.config';
import vaultConfig from '@config/vault.config';
import { envValidationSchema } from '@config/env.validation';

// Core
import { DatabaseModule } from '@core/database/database.module';
import { ReadReplicaModule } from '@core/database/read-replica.module';
import { DatabaseMonitorModule } from '@core/database/db-monitor.module';
import { AuthModule } from '@core/auth/auth.module';
import { RbacModule } from '@core/rbac/rbac.module';
import { EventBusModule } from '@core/event-bus/event-bus.module';
import { CacheModule } from '@core/cache/cache.module';
import { HealthModule } from '@core/health/health.module';
import { SmsModule } from '@core/sms/sms.module';
import { MetricsModule } from '@core/metrics/metrics.module';
import { LoggerModule } from '@core/logger/logger.module';
import { EncryptionModule } from '@core/encryption/encryption.module';
import { VaultModule } from '@core/vault/vault.module';
import { StorageModule } from '@core/storage/storage.module';
import { ExportModule } from '@core/export/export.module';
import { EmailModule } from '@core/email/email.module';

import { QueueModule } from '@core/queue/queue.module';
import { BullBoardModule } from '@core/queue/bull-board.module';
import { WsModule } from '@core/websocket/ws.module';

// Middleware
import { RequestIdMiddleware } from '@common/middleware/request-id.middleware';

// Modules — Nhóm A: Vận hành Logistics
import { OrderModule } from '@modules/order/order.module';
import { OrderProjectModule } from '@modules/order-project/order-project.module';
import { QuotationModule } from '@modules/quotation/quotation.module';
import { RateCardModule } from '@modules/rate-card/rate-card.module';
import { ContainerModule } from '@modules/container/container.module';
import { WarehouseCNModule } from '@modules/warehouse-cn/warehouse-cn.module';
import { WarehouseVNModule } from '@modules/warehouse-vn/warehouse-vn.module';
import { WarehouseSyncModule } from '@modules/warehouse-sync/warehouse-sync.module';
import { TrackingModule } from '@modules/tracking/tracking.module';
import { ComplaintModule } from '@modules/complaint/complaint.module';
import { OperationCostModule } from '@modules/operation-cost/operation-cost.module';
import { SupplierOrderModule } from '@modules/supplier-order/supplier-order.module';
import { QCModule } from '@modules/qc/qc.module';
import { CustomsDeclarationModule } from '@modules/customs-declaration/customs-declaration.module';

// Modules — Nhóm B: Quan hệ Khách hàng
import { CrmModule } from '@modules/crm/crm.module';
import { VendorModule } from '@modules/vendor/vendor.module';
import { ContractModule } from '@modules/contract/contract.module';
// MarketingModule removed — empty stub, will be implemented when needed

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
import { UnallocatedFundsModule } from '@modules/unallocated-funds/unallocated-funds.module';
import { CostAdjustmentModule } from '@modules/cost-adjustment/cost-adjustment.module';

// Modules — Nhóm D: Vận tải
import { FleetModule } from '@modules/fleet/fleet.module';
import { DriverModule } from '@modules/driver/driver.module';

// Modules — Nhóm E: Nhân sự
import { EmployeeModule } from '@modules/employee/employee.module';
import { AttendanceModule } from '@modules/attendance/attendance.module';
import { PayrollModule } from '@modules/payroll/payroll.module';
import { RecruitmentModule } from '@modules/recruitment/recruitment.module';
import { OnboardingModule } from '@modules/onboarding/onboarding.module';
import { ExpenseModule } from '@modules/expense/expense.module';
// PerformanceModule, TrainingModule removed — empty stubs, will be implemented when needed

// Modules — Nhóm F: Hệ thống
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { ApprovalModule } from '@modules/approval/approval.module';
import { TaskModule } from '@modules/task/task.module';
import { CalendarModule } from '@modules/calendar/calendar.module';
// MessageModule, EmailModule removed — empty stubs, will be implemented when needed
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
import { SupportTicketModule } from '@modules/support-ticket/support-ticket.module';
import { CarrierReconciliationModule } from '@modules/carrier-reconciliation/carrier-reconciliation.module';
import { ChatModule } from '@modules/chat/chat.module';
import { CompanyFeedModule } from '@modules/company-feed/company-feed.module';
import { DriveModule } from '@modules/drive/drive.module';
import { OKRModule } from '@modules/okr/okr.module';
import { WikiModule } from '@modules/wiki/wiki.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { BatchModule } from '@modules/batch/batch.module';
import { VideoModule } from '@modules/video/video.module';
import { SearchModule } from '@modules/search/search.module';
import { AiAssistantModule } from '@modules/ai-assistant/ai-assistant.module';
import { EmailComposeModule } from '@modules/email-compose/email-compose.module';
import { EmojiModule } from '@modules/emoji/emoji.module';
import { AutomationModule } from '@modules/automation/automation.module';

// Modules — Nhóm H: CMS (Content Management System)
import { CmsPagesModule } from '@modules/cms-pages/cms-pages.module';
import { CmsMediaModule } from '@modules/cms-media/cms-media.module';
import { CmsMenuModule } from '@modules/cms-menu/cms-menu.module';
import { CmsSettingsModule } from '@modules/cms-settings/cms-settings.module';
import { ContactsModule } from '@modules/cms-contacts/contacts.module';
import { NewsletterModule } from '@modules/cms-newsletter/newsletter.module';
import { FaqModule } from '@modules/cms-faq/faq.module';
import { CmsBlogModule } from '@modules/cms-blog/cms-blog.module';

// Modules — Nhóm I: External Integrations
import { IntegrationModule } from '@modules/integration/integration.module';

// Modules — Nhóm J: Compliance & Data Governance
import { DataRetentionModule } from '@modules/data-retention/data-retention.module';
import { ConsentModule } from '@modules/consent/consent.module';

// Common Services
import { SLAMonitorService } from '@common/services/sla-monitor.service';
import { CsrfGuard } from '@common/guards/csrf.guard';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@common/filters/prisma-exception.filter';
import { SentryExceptionFilter } from '@common/filters/sentry-exception.filter';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

@Module({
  providers: [
    SLAMonitorService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    // Filter registration order: registered first = runs last (NestJS reverses order)
    // HttpExceptionFilter (fallback) -> PrismaExceptionFilter -> SentryExceptionFilter (catch-all, runs first)
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: SentryExceptionFilter,
    },
  ],
  imports: [
    // ─── Global Config ───
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        storageConfig,
        businessConfig,
        brandingConfig,
        sentryConfig,
        integrationsConfig,
        vaultConfig,
      ],
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    ScheduleModule.forRoot(),

    // ─── Core Infrastructure ───
    DatabaseModule,
    ReadReplicaModule,
    DatabaseMonitorModule,
    AuthModule,
    RbacModule,
    EventBusModule,
    CacheModule,
    HealthModule,
    SmsModule,
    MetricsModule,
    LoggerModule,
    EncryptionModule,
    VaultModule,
    StorageModule,
    ExportModule,
    EmailModule,

    // ─── Architecture: Event Queues, WebSocket ───
    QueueModule,
    BullBoardModule,
    WsModule,

    // ─── Nhóm A: Vận hành Logistics ───
    OrderModule,
    OrderProjectModule,
    QuotationModule,
    RateCardModule,
    ContainerModule,
    WarehouseCNModule,
    WarehouseVNModule,
    WarehouseSyncModule,
    TrackingModule,
    ComplaintModule,
    OperationCostModule,
    SupplierOrderModule,
    QCModule,
    CustomsDeclarationModule,

    // ─── Nhóm B: Quan hệ Khách hàng ───
    CrmModule,
    VendorModule,
    ContractModule,

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
    UnallocatedFundsModule,
    CostAdjustmentModule,

    // ─── Nhóm D: Vận tải ───
    FleetModule,
    DriverModule,

    // ─── Nhóm E: Nhân sự ───
    EmployeeModule,
    AttendanceModule,
    PayrollModule,
    RecruitmentModule,
    OnboardingModule,
    ExpenseModule,

    // ─── Nhóm F: Hệ thống ───
    DashboardModule,
    ApprovalModule,
    TaskModule,
    CalendarModule,
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
    SupportTicketModule,
    CarrierReconciliationModule,
    ChatModule,
    CompanyFeedModule,
    DriveModule,
    OKRModule,
    WikiModule,
    ReportsModule,
    BatchModule,
    VideoModule,
    SearchModule,
    AiAssistantModule,
    EmailComposeModule,
    EmojiModule,
    AutomationModule,

    // ─── Nhóm H: CMS ───
    CmsPagesModule,
    CmsMediaModule,
    CmsMenuModule,
    CmsSettingsModule,
    ContactsModule,
    NewsletterModule,
    FaqModule,
    CmsBlogModule,

    // ─── Nhóm I: External Integrations ───
    IntegrationModule.forRoot(),

    // ─── Nhóm J: Compliance & Data Governance ───
    DataRetentionModule,
    ConsentModule,

    // ─── Public API (No Auth) ───
    PublicModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
