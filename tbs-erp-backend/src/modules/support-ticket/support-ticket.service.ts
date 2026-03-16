import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class SupportTicketService {
  private readonly logger = new Logger(SupportTicketService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next ticket code in the format TK-YYYYMM-XXXX.
   */
  private async generateTicketCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `TK-${yearMonth}`;

    const latest = await this.prisma.supportTicket.findFirst({
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
   * CSKH-2: Create a new support ticket with auto-generated code.
   */
  async create(
    dto: {
      customerId: string;
      category: string;
      subject: string;
      description: string;
      priority?: string;
      assignedTo?: string;
    },
    createdBy: string,
  ) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: { id: true, code: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    const code = await this.generateTicketCode();

    const ticket = await this.prisma.supportTicket.create({
      data: {
        code,
        customerId: dto.customerId,
        category: dto.category,
        subject: dto.subject,
        description: dto.description,
        status: 'OPEN',
        priority: dto.priority || 'NORMAL',
        assignedTo: dto.assignedTo,
        createdBy,
      },
    });

    this.logger.log(`Support ticket ${code} created for customer ${customer.code} by ${createdBy}`);

    return ticket;
  }

  /**
   * CSKH-2: List support tickets with pagination and filters.
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    assignedTo?: string;
    priority?: string;
    category?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.customerId) {
      where.customerId = params.customerId;
    }

    if (params.assignedTo) {
      where.assignedTo = params.assignedTo;
    }

    if (params.priority) {
      where.priority = params.priority;
    }

    if (params.category) {
      where.category = params.category;
    }

    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { subject: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * CSKH-2: Get a single support ticket by ID with responses.
   */
  async findById(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    return ticket;
  }

  /**
   * CSKH-2: Add a response to a support ticket.
   *
   * - Auto-sets firstResponseAt if this is the first response.
   * - Auto-changes status from OPEN to IN_PROGRESS.
   */
  async addResponse(ticketId: string, content: string, isInternal: boolean, createdBy: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        code: true,
        status: true,
        firstResponseAt: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${ticketId} not found`);
    }

    if (ticket.status === 'CLOSED') {
      throw new BadRequestException(`Cannot add a response to a closed ticket`);
    }

    const isFirstResponse = !ticket.firstResponseAt;

    // Build ticket update data for status transitions
    const ticketUpdateData: Record<string, unknown> = {};

    if (isFirstResponse) {
      ticketUpdateData.firstResponseAt = new Date();
    }

    if (ticket.status === 'OPEN') {
      ticketUpdateData.status = 'IN_PROGRESS';
    }

    // Create response and update ticket in a transaction
    const [response] = await this.prisma.$transaction([
      this.prisma.ticketResponse.create({
        data: {
          ticketId,
          content,
          isInternal,
          createdBy,
        },
      }),
      ...(Object.keys(ticketUpdateData).length > 0
        ? [
            this.prisma.supportTicket.update({
              where: { id: ticketId },
              data: ticketUpdateData,
            }),
          ]
        : []),
    ]);

    this.logger.log(
      `Response added to ticket ${ticket.code} by ${createdBy}${isInternal ? ' (internal)' : ''}`,
    );

    return response;
  }

  /**
   * CSKH-2: Update the status of a support ticket.
   *
   * Sets resolvedAt timestamp when status is changed to RESOLVED.
   */
  async updateStatus(id: string, status: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];

    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Ticket ${ticket.code} status changed: ${ticket.status} -> ${status}`);

    return updated;
  }

  /**
   * CSKH-2: Assign a support ticket to a user.
   */
  async assign(id: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
      throw new BadRequestException(`Cannot assign a ${ticket.status} ticket`);
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { assignedTo: userId },
    });

    this.logger.log(`Ticket ${ticket.code} assigned to user ${userId}`);

    return updated;
  }
}
