import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationModule } from '@modules/notification/notification.module';
import { CustomsDeclarationController } from './customs-declaration.controller';
import { CustomsDeclarationService } from './customs-declaration.service';
import { CustomsDeclarationRepository } from './customs-declaration.repository';
import { CustomsStatusMachine } from './domain/customs-status.machine';
import { DutyCalculatorService } from './domain/duty-calculator.service';
import { GroupingService } from './domain/grouping.service';
import { HsCodeSuggestionService } from './domain/hs-code-suggestion.service';
import { ComplianceCheckerService } from './domain/compliance-checker.service';
import { TaxAllocationService } from './domain/tax-allocation.service';
import { EcusExportService } from './domain/ecus-export.service';
import { ContainerCustomsListener } from './listeners/container-customs.listener';
import { ChannelDelayListener } from './listeners/channel-delay.listener';
import { CustomsDocumentService } from './customs-document.service';
import { CustomsServiceRateService } from './customs-service-rate.service';

@Module({
  imports: [EventEmitterModule, NotificationModule],
  controllers: [CustomsDeclarationController],
  providers: [
    CustomsDeclarationService,
    CustomsDeclarationRepository,
    CustomsStatusMachine,
    DutyCalculatorService,
    GroupingService,
    HsCodeSuggestionService,
    ComplianceCheckerService,
    TaxAllocationService,
    EcusExportService,
    ContainerCustomsListener,
    ChannelDelayListener,
    CustomsDocumentService,
    CustomsServiceRateService,
  ],
  exports: [
    CustomsDeclarationService,
    DutyCalculatorService,
    TaxAllocationService,
    CustomsDocumentService,
    CustomsServiceRateService,
    ComplianceCheckerService,
  ],
})
export class CustomsDeclarationModule {}
