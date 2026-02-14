import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import {
  ComplaintStatus,
  ComplaintSeverity,
  ResolutionType,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';

/** Compensation thresholds for approval requirements */
const COMPENSATION_GD_KD_THRESHOLD = 5_000_000; // 5M VND - requires GD KD approval
const COMPENSATION_BGD_THRESHOLD = 20_000_000; // 20M VND - requires BGD approval

@Injectable()
export class ComplaintService {
  private readonly logger = new Logger(ComplaintService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generates the next complaint code in the format QMS-YYYYMM-XXXX.
   */
  private async generateComplaintCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `QMS-${yearMonth}`;

    const latestComplaint = await this.prisma.complaint.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latestComplaint) {
      const lastSequence = parseInt(
        latestComplaint.code.split('-').pop() || '0',
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Creates a new complaint.
   *
   * - Auto-generates code (QMS-YYYYMM-XXXX)
   * - CRITICAL complaints auto-notify GD KD + BGD
   * - Emits 'complaint.created' event
   */
  async createComplaint(userId: string, dto: CreateComplaintDto) {
    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, code: true, customerId: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: { id: true, code: true, fullName: true },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${dto.customerId} not found`,
      );
    }

    // Generate complaint code
    const code = await this.generateComplaintCode();

    // Create the complaint
    const complaint = await this.prisma.complaint.create({
      data: {
        code,
        orderId: dto.orderId,
        customerId: dto.customerId,
        packageId: dto.packageId,
        type: dto.type,
        severity: dto.severity,
        status: ComplaintStatus.OPEN,
        description: dto.description,
        attachments: dto.attachments || [],
        note: dto.note,
        createdBy: userId,
      },
      include: {
        order: {
          select: { id: true, code: true },
        },
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

    // Emit event
    this.eventEmitter.emit('complaint.created', {
      complaintId: complaint.id,
      code: complaint.code,
      orderId: dto.orderId,
      customerId: dto.customerId,
      type: dto.type,
      severity: dto.severity,
      createdBy: userId,
    });

    // CRITICAL complaints auto-notify GD KD + BGD
    if (dto.severity === ComplaintSeverity.CRITICAL) {
      this.eventEmitter.emit('complaint.critical', {
        complaintId: complaint.id,
        code: complaint.code,
        orderId: dto.orderId,
        orderCode: order.code,
        customerId: dto.customerId,
        customerName: customer.fullName,
        type: dto.type,
        description: dto.description,
        createdBy: userId,
      });

      this.logger.warn(
        `CRITICAL complaint ${code} created - auto-notifying GD KD + BGD`,
      );
    }

    this.logger.log(
      `Complaint ${code} created for order ${order.code} by user ${userId}`,
    );

    return complaint;
  }

  /**
   * Updates complaint details and/or adds investigation notes.
   */
  async updateComplaint(id: string, dto: UpdateComplaintDto) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    if (complaint.status === ComplaintStatus.CLOSED) {
      throw new BadRequestException(
        'Closed complaints cannot be updated',
      );
    }

    const updateData: any = {};

    if (dto.type !== undefined) {
      updateData.type = dto.type;
    }

    if (dto.severity !== undefined) {
      updateData.severity = dto.severity;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.attachments !== undefined) {
      updateData.attachments = dto.attachments;
    }

    if (dto.note !== undefined) {
      updateData.note = dto.note;
    }

    // If investigation note is provided, append to investigation notes log
    if (dto.investigationNote) {
      const existingNotes = (complaint.investigationNotes as any[]) || [];
      existingNotes.push({
        note: dto.investigationNote,
        addedAt: new Date().toISOString(),
      });
      updateData.investigationNotes = existingNotes;

      // Automatically transition to INVESTIGATING if currently OPEN
      if (complaint.status === ComplaintStatus.OPEN) {
        updateData.status = ComplaintStatus.INVESTIGATING;
      }
    }

    const updated = await this.prisma.complaint.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          select: { id: true, code: true },
        },
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

    this.logger.log(`Complaint ${complaint.code} updated`);

    return updated;
  }

  /**
   * Lists complaints with pagination and filters.
   */
  async findAll(query: ComplaintQueryDto) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.handlerId) {
      where.handlerId = query.handlerId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        {
          customer: {
            fullName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          order: {
            code: { contains: query.search, mode: 'insensitive' },
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
      this.prisma.complaint.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as any,
        include: {
          order: {
            select: { id: true, code: true, status: true },
          },
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
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single complaint by ID with full details.
   */
  async findById(id: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            status: true,
            serviceType: true,
            totalAmount: true,
          },
        },
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
      },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    return complaint;
  }

  /**
   * Assigns a complaint to a specific employee (handler).
   */
  async assignHandler(id: string, handlerId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    if (complaint.status === ComplaintStatus.CLOSED || complaint.status === ComplaintStatus.RESOLVED) {
      throw new BadRequestException(
        `Cannot assign handler to a ${complaint.status} complaint`,
      );
    }

    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        handlerId,
        status:
          complaint.status === ComplaintStatus.OPEN
            ? ComplaintStatus.INVESTIGATING
            : complaint.status,
        assignedAt: new Date(),
      },
      include: {
        order: {
          select: { id: true, code: true },
        },
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

    this.eventEmitter.emit('complaint.assigned', {
      complaintId: id,
      code: complaint.code,
      handlerId,
    });

    this.logger.log(
      `Complaint ${complaint.code} assigned to handler ${handlerId}`,
    );

    return updated;
  }

  /**
   * Resolves a complaint with resolution details.
   *
   * - Resolution types: REFUND, REPLACEMENT, CREDIT, APOLOGY, NONE
   * - If compensation > 5M VND, requires GD KD approval
   * - If compensation > 20M VND, requires BGD approval
   */
  async resolveComplaint(
    id: string,
    resolution: {
      type: ResolutionType;
      amount?: number;
      notes?: string;
    },
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: { order: { select: { code: true } } },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    if (
      complaint.status === ComplaintStatus.CLOSED ||
      complaint.status === ComplaintStatus.RESOLVED
    ) {
      throw new BadRequestException(
        `Complaint is already ${complaint.status}`,
      );
    }

    const compensationAmount = resolution.amount || 0;

    // Check if approval is needed for compensation
    if (compensationAmount > COMPENSATION_BGD_THRESHOLD) {
      // Requires BGD approval (> 20M VND)
      const approval = await this.prisma.approval.create({
        data: {
          type: 'DISCOUNT', // Using DISCOUNT as closest approval type available
          referenceId: id,
          referenceCode: complaint.code,
          requestedBy: complaint.handlerId || complaint.createdBy,
          requestData: {
            complaintId: id,
            complaintCode: complaint.code,
            resolutionType: resolution.type,
            compensationAmount,
            notes: resolution.notes,
          },
          totalSteps: 2,
          steps: {
            create: [
              { stepNumber: 1, approverRole: 'SALES_DIRECTOR' },
              { stepNumber: 2, approverRole: 'CEO' },
            ],
          },
        },
      });

      await this.prisma.complaint.update({
        where: { id },
        data: {
          status: ComplaintStatus.PENDING_RESOLUTION,
          resolutionType: resolution.type,
          compensationAmount: new Decimal(compensationAmount),
          resolutionNotes: resolution.notes,
        },
      });

      this.logger.log(
        `Complaint ${complaint.code}: compensation ${compensationAmount} VND requires BGD approval`,
      );

      return {
        status: 'PENDING_APPROVAL',
        approvalId: approval.id,
        message: `Compensation of ${compensationAmount} VND requires BGD approval.`,
      };
    }

    if (compensationAmount > COMPENSATION_GD_KD_THRESHOLD) {
      // Requires GD KD approval (> 5M VND)
      const approval = await this.prisma.approval.create({
        data: {
          type: 'DISCOUNT',
          referenceId: id,
          referenceCode: complaint.code,
          requestedBy: complaint.handlerId || complaint.createdBy,
          requestData: {
            complaintId: id,
            complaintCode: complaint.code,
            resolutionType: resolution.type,
            compensationAmount,
            notes: resolution.notes,
          },
          totalSteps: 1,
          steps: {
            create: [
              { stepNumber: 1, approverRole: 'SALES_DIRECTOR' },
            ],
          },
        },
      });

      await this.prisma.complaint.update({
        where: { id },
        data: {
          status: ComplaintStatus.PENDING_RESOLUTION,
          resolutionType: resolution.type,
          compensationAmount: new Decimal(compensationAmount),
          resolutionNotes: resolution.notes,
        },
      });

      this.logger.log(
        `Complaint ${complaint.code}: compensation ${compensationAmount} VND requires GD KD approval`,
      );

      return {
        status: 'PENDING_APPROVAL',
        approvalId: approval.id,
        message: `Compensation of ${compensationAmount} VND requires GD KD approval.`,
      };
    }

    // Direct resolution (no approval needed)
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        status: ComplaintStatus.RESOLVED,
        resolutionType: resolution.type,
        compensationAmount: new Decimal(compensationAmount),
        resolutionNotes: resolution.notes,
        resolvedAt: new Date(),
      },
      include: {
        order: {
          select: { id: true, code: true },
        },
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

    this.eventEmitter.emit('complaint.resolved', {
      complaintId: id,
      code: complaint.code,
      resolutionType: resolution.type,
      compensationAmount,
    });

    this.logger.log(
      `Complaint ${complaint.code} resolved with ${resolution.type}` +
        (compensationAmount > 0 ? ` (${compensationAmount} VND)` : ''),
    );

    return { status: 'RESOLVED', complaint: updated };
  }

  /**
   * Escalates a complaint to higher management.
   *
   * @param id - Complaint ID
   * @param level - Escalation level: 'SALES_LEADER' | 'SALES_DIRECTOR' | 'CEO'
   */
  async escalateComplaint(id: string, level: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    if (
      complaint.status === ComplaintStatus.CLOSED ||
      complaint.status === ComplaintStatus.RESOLVED
    ) {
      throw new BadRequestException(
        `Cannot escalate a ${complaint.status} complaint`,
      );
    }

    const validLevels = ['SALES_LEADER', 'SALES_DIRECTOR', 'CEO'];
    if (!validLevels.includes(level)) {
      throw new BadRequestException(
        `Invalid escalation level. Must be one of: ${validLevels.join(', ')}`,
      );
    }

    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        escalationLevel: level,
        escalatedAt: new Date(),
      },
      include: {
        order: {
          select: { id: true, code: true },
        },
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

    this.eventEmitter.emit('complaint.escalated', {
      complaintId: id,
      code: complaint.code,
      escalationLevel: level,
    });

    this.logger.log(
      `Complaint ${complaint.code} escalated to ${level}`,
    );

    return updated;
  }

  /**
   * Gets complaint statistics for a date range.
   * Returns stats by type, severity, and resolution time.
   */
  async getStatistics(dateRange?: { startDate?: string; endDate?: string }) {
    const where: any = {};

    if (dateRange?.startDate || dateRange?.endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (dateRange.startDate) {
        dateFilter.gte = new Date(dateRange.startDate);
      }
      if (dateRange.endDate) {
        const endOfDay = new Date(dateRange.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.lte = endOfDay;
      }
      where.createdAt = dateFilter;
    }

    // Total counts
    const [total, open, investigating, pendingResolution, resolved, closed] =
      await Promise.all([
        this.prisma.complaint.count({ where }),
        this.prisma.complaint.count({
          where: { ...where, status: ComplaintStatus.OPEN },
        }),
        this.prisma.complaint.count({
          where: { ...where, status: ComplaintStatus.INVESTIGATING },
        }),
        this.prisma.complaint.count({
          where: { ...where, status: ComplaintStatus.PENDING_RESOLUTION },
        }),
        this.prisma.complaint.count({
          where: { ...where, status: ComplaintStatus.RESOLVED },
        }),
        this.prisma.complaint.count({
          where: { ...where, status: ComplaintStatus.CLOSED },
        }),
      ]);

    // By type
    const byType = await this.prisma.complaint.groupBy({
      by: ['type'],
      where,
      _count: { id: true },
    });

    // By severity
    const bySeverity = await this.prisma.complaint.groupBy({
      by: ['severity'],
      where,
      _count: { id: true },
    });

    // Average resolution time (for resolved complaints)
    const resolvedComplaints = await this.prisma.complaint.findMany({
      where: {
        ...where,
        status: { in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] },
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    let avgResolutionHours = 0;
    if (resolvedComplaints.length > 0) {
      const totalHours = resolvedComplaints.reduce((sum, c) => {
        if (c.resolvedAt) {
          const diffMs = c.resolvedAt.getTime() - c.createdAt.getTime();
          return sum + diffMs / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgResolutionHours = Math.round(totalHours / resolvedComplaints.length);
    }

    // Total compensation
    const compensationResult = await this.prisma.complaint.aggregate({
      where: {
        ...where,
        status: { in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] },
      },
      _sum: {
        compensationAmount: true,
      },
    });

    return {
      total,
      byStatus: {
        open,
        investigating,
        pendingResolution,
        resolved,
        closed,
      },
      byType: byType.map((t) => ({
        type: t.type,
        count: t._count.id,
      })),
      bySeverity: bySeverity.map((s) => ({
        severity: s.severity,
        count: s._count.id,
      })),
      averageResolutionHours: avgResolutionHours,
      totalCompensation: compensationResult._sum.compensationAmount
        ? Number(compensationResult._sum.compensationAmount)
        : 0,
      resolutionRate:
        total > 0
          ? Math.round(((resolved + closed) / total) * 100)
          : 0,
    };
  }
}
