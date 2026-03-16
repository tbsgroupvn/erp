import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { ContractStatus, ContractType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractQueryDto } from './dto/contract-query.dto';

/** Valid status transitions */
const STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.DRAFT]: [ContractStatus.PENDING_SIGNATURE, ContractStatus.CANCELLED],
  [ContractStatus.PENDING_SIGNATURE]: [
    ContractStatus.SIGNED,
    ContractStatus.DRAFT,
    ContractStatus.CANCELLED,
  ],
  [ContractStatus.SIGNED]: [ContractStatus.ACTIVE],
  [ContractStatus.ACTIVE]: [
    ContractStatus.COMPLETED,
    ContractStatus.SUSPENDED,
    ContractStatus.SETTLED,
  ],
  [ContractStatus.SUSPENDED]: [ContractStatus.ACTIVE, ContractStatus.CANCELLED],
  [ContractStatus.SETTLED]: [ContractStatus.COMPLETED],
  [ContractStatus.COMPLETED]: [],
  [ContractStatus.CANCELLED]: [],
};

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generates the next contract code in the format HD-YYYYMM-XXXX.
   */
  private async generateContractCode(type: ContractType): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = type === ContractType.APPENDIX ? `PL-${yearMonth}` : `HD-${yearMonth}`;

    const latestContract = await this.prisma.contract.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latestContract) {
      const lastSequence = parseInt(latestContract.code.split('-').pop() || '0', 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Lists contracts with pagination and filters.
   */
  async findAll(query: ContractQueryDto) {
    const where: Prisma.ContractWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        {
          customer: {
            fullName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          customer: {
            companyName: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.startDate || query.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endOfDay = new Date(query.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
      where.createdAt = dateFilter;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.ContractOrderByWithRelationInput,
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              fullName: true,
              companyName: true,
              phone: true,
            },
          },
          parent: {
            select: { id: true, code: true, title: true },
          },
          _count: { select: { appendixes: true, orders: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single contract by ID with full details.
   */
  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            tier: true,
            phone: true,
            email: true,
          },
        },
        sale: {
          select: { id: true, fullName: true, email: true },
        },
        parent: {
          select: { id: true, code: true, title: true, status: true },
        },
        appendixes: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            totalValue: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        quotation: {
          select: {
            id: true,
            code: true,
            status: true,
            totalAmount: true,
          },
        },
        _count: { select: { orders: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    return contract;
  }

  /**
   * Creates a new contract (MASTER or APPENDIX).
   */
  async create(userId: string, dto: CreateContractDto) {
    // Validate customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: { id: true, code: true, isActive: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    if (!customer.isActive) {
      throw new BadRequestException(`Customer ${customer.code} is inactive`);
    }

    // If APPENDIX, validate parent exists
    if (dto.type === ContractType.APPENDIX && dto.parentId) {
      const parent = await this.prisma.contract.findUnique({
        where: { id: dto.parentId },
        select: { id: true, status: true },
      });

      if (!parent) {
        throw new NotFoundException(`Parent contract with ID ${dto.parentId} not found`);
      }
    }

    const code = await this.generateContractCode(dto.type);

    const contract = await this.prisma.contract.create({
      data: {
        code,
        customerId: dto.customerId,
        saleId: dto.saleId,
        type: dto.type,
        parentId: dto.parentId,
        quotationId: dto.quotationId,
        title: dto.title,
        effectiveDate: new Date(dto.effectiveDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        totalValue: new Decimal(dto.totalValue ?? 0),
        depositRequired: new Decimal(dto.depositRequired ?? 0),
        currency: dto.currency ?? 'VND',
        terms: dto.terms,
        note: dto.note,
        attachments: dto.attachments ?? [],
        status: ContractStatus.DRAFT,
        createdBy: userId,
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.eventEmitter.emit('contract.created', {
      contractId: contract.id,
      code: contract.code,
      type: contract.type,
      customerId: dto.customerId,
      createdBy: userId,
    });

    this.logger.log(
      `Contract ${code} (${dto.type}) created for customer ${customer.code} by user ${userId}`,
    );

    return contract;
  }

  /**
   * Updates a contract. Only allowed when status is DRAFT.
   */
  async update(id: string, dto: UpdateContractDto) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        `Contract in status ${contract.status} cannot be edited. Only DRAFT contracts can be modified.`,
      );
    }

    const updateData: Prisma.ContractUpdateInput = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.effectiveDate !== undefined) updateData.effectiveDate = new Date(dto.effectiveDate);
    if (dto.expiryDate !== undefined) updateData.expiryDate = new Date(dto.expiryDate);
    if (dto.totalValue !== undefined) updateData.totalValue = new Decimal(dto.totalValue);
    if (dto.depositRequired !== undefined)
      updateData.depositRequired = new Decimal(dto.depositRequired);
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.terms !== undefined) updateData.terms = dto.terms;
    if (dto.note !== undefined) updateData.note = dto.note;
    if (dto.attachments !== undefined) updateData.attachments = dto.attachments;

    const updated = await this.prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.logger.log(`Contract ${contract.code} updated`);

    return updated;
  }

  /**
   * Transitions contract status. Validates allowed transitions.
   */
  async updateStatus(id: string, newStatus: ContractStatus, userId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    const allowedTransitions = STATUS_TRANSITIONS[contract.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${contract.status} to ${newStatus}. ` +
          `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
      );
    }

    const updateData: Prisma.ContractUpdateInput = {
      status: newStatus,
    };

    if (newStatus === ContractStatus.SIGNED) {
      updateData.signedDate = new Date();
    }
    if (newStatus === ContractStatus.SETTLED) {
      updateData.settledAt = new Date();
    }
    if (newStatus === ContractStatus.COMPLETED || newStatus === ContractStatus.CANCELLED) {
      updateData.closedAt = new Date();
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.eventEmitter.emit('contract.statusChanged', {
      contractId: id,
      code: contract.code,
      fromStatus: contract.status,
      toStatus: newStatus,
      changedBy: userId,
    });

    this.logger.log(
      `Contract ${contract.code} status changed: ${contract.status} → ${newStatus} by user ${userId}`,
    );

    return updated;
  }

  /**
   * Deletes a contract. Only DRAFT contracts can be deleted.
   */
  async delete(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT contracts can be deleted. Current status: ${contract.status}`,
      );
    }

    // Layer 2A: Soft delete instead of hard delete
    await this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: contract.createdBy },
    });

    this.logger.log(`Contract ${contract.code} soft-deleted`);
  }

  /**
   * Creates a contract appendix automatically from an approved quotation.
   * Copies customer info, items summary, and total value from the quotation.
   */
  async createContractFromQuotation(quotationId: string, approvedBy: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            isActive: true,
          },
        },
        items: true,
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found`);
    }

    // Build items summary for contract terms
    const itemsSummary = quotation.items
      .map(
        (item, i) =>
          `${i + 1}. ${item.productName} - SL: ${item.quantity} - Đơn giá: ${item.unitPrice} ${item.currency}`,
      )
      .join('\n');

    const terms = `Phụ lục hợp đồng tạo từ báo giá ${quotation.code}\n\nDanh sách hàng hóa/dịch vụ:\n${itemsSummary}`;

    // Find or create parent master contract for this customer
    const parentContract = await this.prisma.contract.findFirst({
      where: {
        customerId: quotation.customerId,
        type: ContractType.MASTER,
        status: { in: [ContractStatus.ACTIVE, ContractStatus.SIGNED, ContractStatus.DRAFT] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true },
    });

    const code = await this.generateContractCode(ContractType.APPENDIX);
    const now = new Date();

    const appendix = await this.prisma.contract.create({
      data: {
        code,
        customerId: quotation.customerId,
        saleId: quotation.createdBy,
        type: ContractType.APPENDIX,
        parentId: parentContract?.id ?? null,
        quotationId: quotation.id,
        title: `Phụ lục HĐ - ${quotation.code} - ${quotation.customer?.fullName ?? ''}`,
        effectiveDate: now,
        totalValue: quotation.totalAmount,
        currency: 'VND',
        status: ContractStatus.DRAFT,
        terms,
        note: `Tự động tạo từ báo giá ${quotation.code} được duyệt bởi ${approvedBy}`,
        createdBy: approvedBy,
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    this.eventEmitter.emit('contract.createdFromQuotation', {
      contractId: appendix.id,
      contractCode: appendix.code,
      quotationId: quotation.id,
      quotationCode: quotation.code,
      customerId: quotation.customerId,
      createdBy: approvedBy,
    });

    this.logger.log(`Contract appendix ${code} auto-created from quotation ${quotation.code}`);

    return appendix;
  }
}
