import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Listens for container status changes and auto-creates customs declarations
 * when a container enters CUSTOMS status.
 *
 * When a container transitions to CUSTOMS:
 *  - Checks if a CustomsDeclaration already exists for this container
 *  - If not, creates a DRAFT declaration pre-populated with container data
 *  - Emits 'customs.declaration.created' for downstream processing
 */
@Injectable()
export class ContainerCustomsListener {
  private readonly logger = new Logger(ContainerCustomsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('container.status.changed')
  async handleContainerCustoms(event: {
    containerId: string;
    containerCode: string;
    fromStatus: string;
    toStatus: string;
    changedBy: string;
    shippingRoute?: string;
  }): Promise<void> {
    if (event.toStatus !== 'CUSTOMS') {
      return;
    }

    this.logger.log(
      `Container ${event.containerCode} entered CUSTOMS status. Checking for existing declaration.`,
    );

    // Check if a declaration already exists for this container
    const existing = await this.prisma.customsDeclaration.findFirst({
      where: { containerId: event.containerId },
      select: { id: true, code: true },
    });

    if (existing) {
      this.logger.log(
        `Declaration ${existing.code} already exists for container ${event.containerCode}. Skipping auto-creation.`,
      );
      return;
    }

    // Load container data for pre-populating the declaration
    const container = await this.prisma.container.findUnique({
      where: { id: event.containerId },
      select: {
        id: true,
        code: true,
        shippingRoute: true,
        bookingRef: true,
        sealNumber: true,
        vesselName: true,
        origin: true,
        destination: true,
      },
    });

    if (!container) {
      this.logger.warn(
        `Container ${event.containerId} not found. Cannot auto-create declaration.`,
      );
      return;
    }

    // Generate declaration code: CD-YYYYMM-XXXX
    const code = await this.generateDeclarationCode();

    // Map shipping route to shipping method
    const shippingMethodMap: Record<string, string> = {
      SEA: 'SEA',
      AIR: 'AIR',
      RAIL: 'ROAD',
      ROAD: 'ROAD',
      MULTIMODAL: 'SEA',
    };

    const declaration = await this.prisma.customsDeclaration.create({
      data: {
        code,
        containerId: event.containerId,
        declarationType: 'IMPORT',
        shippingMethod: shippingMethodMap[container.shippingRoute] ?? 'SEA',
        blAwbNumber: container.bookingRef,
        vesselName: container.vesselName,
        portOfLoading: container.origin,
        portOfDischarge: container.destination,
        importerTaxCode: '', // To be filled by XNK staff
        importerName: '',    // To be filled by XNK staff
        status: 'DRAFT',
        createdBy: event.changedBy,
      },
    });

    this.eventEmitter.emit('customs.declaration.created', {
      declarationId: declaration.id,
      declarationCode: declaration.code,
      containerId: event.containerId,
      containerCode: event.containerCode,
      createdBy: event.changedBy,
    });

    this.logger.log(
      `Auto-created DRAFT customs declaration ${code} for container ${event.containerCode}`,
    );
  }

  /**
   * Generates a unique customs declaration code: CD-YYYYMM-XXXX
   */
  private async generateDeclarationCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `CD-${yearMonth}-`;

    const last = await this.prisma.customsDeclaration.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (last?.code) {
      const match = last.code.match(/CD-\d{6}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }
}
