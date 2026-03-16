import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next lead code in the format LEAD-YYYYMM-XXXX.
   */
  private async generateLeadCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `LEAD-${yearMonth}`;

    const latest = await this.prisma.lead.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() || '0', 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * KD-4: Create a new lead with auto-generated code.
   */
  async create(
    dto: {
      fullName: string;
      companyName?: string;
      phone?: string;
      email?: string;
      source: string;
      assignedTo?: string;
    },
    createdBy: string,
  ) {
    const code = await this.generateLeadCode();

    const lead = await this.prisma.lead.create({
      data: {
        code,
        fullName: dto.fullName,
        companyName: dto.companyName,
        phone: dto.phone,
        email: dto.email,
        source: dto.source,
        status: 'NEW',
        assignedTo: dto.assignedTo,
        createdBy,
      },
    });

    this.logger.log(`Lead created: ${code} by ${createdBy}`);

    return lead;
  }

  /**
   * KD-4: List leads with pagination and filters.
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    assignedTo?: string;
    source?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.assignedTo) {
      where.assignedTo = params.assignedTo;
    }

    if (params.source) {
      where.source = params.source;
    }

    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { companyName: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * KD-4: Get a single lead by ID with notes.
   */
  async findById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return lead;
  }

  /**
   * KD-4: Update lead fields.
   */
  async update(
    id: string,
    dto: {
      fullName?: string;
      companyName?: string;
      phone?: string;
      email?: string;
      source?: string;
      status?: string;
      assignedTo?: string;
    },
  ) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    if (existing.status === 'CONVERTED') {
      throw new BadRequestException(
        'Cannot update a lead that has already been converted to a customer',
      );
    }

    const updateData: Record<string, unknown> = {};

    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.companyName !== undefined) updateData.companyName = dto.companyName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.assignedTo !== undefined) updateData.assignedTo = dto.assignedTo;

    const updated = await this.prisma.lead.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Lead ${existing.code} updated`);

    return updated;
  }

  /**
   * KD-4: Add a note to a lead.
   */
  async addNote(leadId: string, content: string, createdBy: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, code: true },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const note = await this.prisma.leadNote.create({
      data: {
        leadId,
        content,
        createdBy,
      },
    });

    this.logger.log(`Note added to lead ${lead.code} by ${createdBy}`);

    return note;
  }

  /**
   * KD-4: Convert a lead to a customer.
   *
   * Creates a new Customer record from the Lead data,
   * updates Lead status to CONVERTED, and sets convertedCustomerId.
   */
  async convertToCustomer(leadId: string, convertedBy: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    if (lead.status === 'CONVERTED') {
      throw new BadRequestException(`Lead ${lead.code} has already been converted to a customer`);
    }

    if (lead.status === 'LOST') {
      throw new BadRequestException(`Cannot convert a LOST lead. Reopen it first.`);
    }

    // Generate customer code
    const customerCodePrefix = 'TBS-KH-';
    const latestCustomer = await this.prisma.customer.findFirst({
      where: { code: { startsWith: customerCodePrefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let customerSequence = 1;
    if (latestCustomer) {
      const lastSeq = parseInt(latestCustomer.code.replace(customerCodePrefix, '') || '0', 10);
      customerSequence = lastSeq + 1;
    }

    const customerCode = `${customerCodePrefix}${String(customerSequence).padStart(6, '0')}`;

    // Create customer and update lead in a transaction
    const result = await this.prisma.executeInTransaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          code: customerCode,
          fullName: lead.fullName,
          companyName: lead.companyName,
          phone: lead.phone || '',
          email: lead.email,
          tier: 'NEW',
          depositRate: 100,
          creditLimit: 0,
        },
      });

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'CONVERTED',
          convertedCustomerId: customer.id,
        },
      });

      return { customer, lead: updatedLead };
    });

    this.logger.log(`Lead ${lead.code} converted to customer ${customerCode} by ${convertedBy}`);

    return result;
  }

  /**
   * KD-4: Mark a lead as lost with a reason.
   */
  async markLost(leadId: string, reason: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    if (lead.status === 'CONVERTED') {
      throw new BadRequestException(`Cannot mark a converted lead as lost`);
    }

    if (lead.status === 'LOST') {
      throw new BadRequestException(`Lead ${lead.code} is already marked as lost`);
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: 'LOST',
        lostReason: reason,
      },
    });

    this.logger.log(`Lead ${lead.code} marked as LOST: ${reason}`);

    return updated;
  }
}
