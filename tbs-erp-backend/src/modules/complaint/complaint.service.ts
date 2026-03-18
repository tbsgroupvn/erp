import { Injectable, Logger, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { TransactionalEmitter } from '@core/events/transactional-emitter.service';
import { ComplaintStatus, ComplaintSeverity, ResolutionType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { buildDateFilter } from '@common/utils/date.util';
import { generateCode } from '@common/utils/code-generator.util';
import { ComplaintStatusMachine } from './domain/complaint-status.machine';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';

@Injectable()
export class ComplaintService {
  private readonly logger = new Logger(ComplaintService.name);

  /** Compensation thresholds for approval requirements (from config) */
  private readonly compensationGdKdThreshold: number;
  private readonly compensationBgdThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly txEmitter: TransactionalEmitter,
    private readonly statusMachine: ComplaintStatusMachine,
  ) {
    this.compensationGdKdThreshold = this.configService.get<number>(
      'business.complaint.compensationGdKdThreshold',
      5_000_000,
    );
    this.compensationBgdThreshold = this.configService.get<number>(
      'business.complaint.compensationBgdThreshold',
      20_000_000,
    );
  }

  /**
   * Generates the next complaint code in the format QMS-YYYYMM-XXXX.
   */
  private async generateComplaintCode(): Promise<string> {
    return generateCode(this.prisma.complaint, {
      prefix: 'QMS',
      datePrefixFormat: 'YYYYMM',
      sequenceLength: 4,
    });
  }

  /**
   * Creates a new complaint.
   *
   * - Auto-generates code (QMS-YYYYMM-XXXX)
   * - CRITICAL complaints auto-notify GD KD + BGD
   * - Emits 'complaint.created' event
   */
  async createComplaint(userId: string, dto: CreateComplaintDto) {
    // TODO: Add @Throttle({ default: { limit: 5, ttl: 3600000 } }) in controller
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
      throw new NotFoundException(`Customer with ID ${dto.customerId} not found`);
    }

    // Generate complaint code and create with retry for unique constraint violations
    let complaint: Prisma.ComplaintGetPayload<{
      include: {
        order: { select: { id: true; code: true } };
        customer: {
          select: { id: true; code: true; fullName: true; companyName: true; phone: true };
        };
      };
    }> | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        complaint = await this.prisma.executeInTransaction(async (tx) => {
          const code = await generateCode(tx.complaint, {
            prefix: 'QMS',
            datePrefixFormat: 'YYYYMM',
            sequenceLength: 4,
          });

          return tx.complaint.create({
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
        });
        break;
      } catch (error) {
        if (error.code === 'P2002' && attempt < 2) {
          this.logger.warn(`Complaint code conflict on attempt ${attempt + 1}, retrying...`);
          continue;
        }
        throw error;
      }
    }
    if (!complaint) {
      throw new DomainException(ErrorCode.COMPLAINT_CREATION_FAILED, 'Failed to create complaint after multiple attempts', HttpStatus.INTERNAL_SERVER_ERROR);
    }

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

      this.logger.warn(`CRITICAL complaint ${complaint.code} created - auto-notifying GD KD + BGD`);
    }

    this.logger.log(
      `Complaint ${complaint.code} created for order ${order.code} by user ${userId}`,
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

    if (this.statusMachine.isTerminal(complaint.status)) {
      throw new BadRequestException(`${complaint.status} complaints cannot be updated`);
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

      // Automatically transition to INVESTIGATING if currently OPEN (validated by FSM)
      if (
        complaint.status === ComplaintStatus.OPEN &&
        this.statusMachine.validateTransition(complaint.status, ComplaintStatus.INVESTIGATING)
      ) {
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

    const dateFilter = buildDateFilter(query.startDate, query.endDate);
    if (dateFilter) {
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

    if (
      this.statusMachine.isTerminal(complaint.status) ||
      complaint.status === ComplaintStatus.RESOLVED
    ) {
      throw new BadRequestException(`Cannot assign handler to a ${complaint.status} complaint`);
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

    this.logger.log(`Complaint ${complaint.code} assigned to handler ${handlerId}`);

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
      !this.statusMachine.validateTransition(complaint.status, ComplaintStatus.RESOLVED) &&
      !this.statusMachine.validateTransition(complaint.status, ComplaintStatus.PENDING_RESOLUTION)
    ) {
      throw new BadRequestException(`Complaint is already ${complaint.status}`);
    }

    const compensationAmount = resolution.amount || 0;

    // Check if approval is needed for compensation
    if (compensationAmount > this.compensationBgdThreshold) {
      // Requires BGD approval (> 20M VND)
      // Idempotency check: prevent duplicate approval workflows
      const existingApproval = await this.prisma.approval.findFirst({
        where: {
          referenceId: id,
          type: 'CUSTOM',
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      if (existingApproval) {
        return {
          status: 'PENDING_APPROVAL',
          approvalId: existingApproval.id,
          message: `An approval workflow already exists for this complaint.`,
        };
      }

      // Wrap approval creation + complaint update in a transaction for atomicity
      const approval = await this.prisma.executeInTransaction(async (tx) => {
        const newApproval = await tx.approval.create({
          data: {
            type: 'CUSTOM', // Complaint compensation - no dedicated ApprovalType exists
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

        await tx.complaint.update({
          where: { id },
          data: {
            status: ComplaintStatus.PENDING_RESOLUTION,
            resolutionType: resolution.type,
            compensationAmount: new Decimal(compensationAmount),
            resolutionNotes: resolution.notes,
          },
        });

        return newApproval;
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

    if (compensationAmount > this.compensationGdKdThreshold) {
      // Requires GD KD approval (> 5M VND)
      // Idempotency check: prevent duplicate approval workflows
      const existingApproval = await this.prisma.approval.findFirst({
        where: {
          referenceId: id,
          type: 'DISCOUNT',
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      if (existingApproval) {
        return {
          status: 'PENDING_APPROVAL',
          approvalId: existingApproval.id,
          message: `An approval workflow already exists for this complaint.`,
        };
      }

      // Wrap approval creation + complaint update in a transaction for atomicity
      const approval = await this.prisma.executeInTransaction(async (tx) => {
        const newApproval = await tx.approval.create({
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
              create: [{ stepNumber: 1, approverRole: 'SALES_DIRECTOR' }],
            },
          },
        });

        await tx.complaint.update({
          where: { id },
          data: {
            status: ComplaintStatus.PENDING_RESOLUTION,
            resolutionType: resolution.type,
            compensationAmount: new Decimal(compensationAmount),
            resolutionNotes: resolution.notes,
          },
        });

        return newApproval;
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
    const collector = this.txEmitter.createCollector();

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

    collector.emit('complaint.resolved', {
      complaintId: id,
      code: complaint.code,
      resolutionType: resolution.type,
      compensationAmount,
    });

    // Flush events after successful database write
    collector.flush();

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
      this.statusMachine.isTerminal(complaint.status) ||
      complaint.status === ComplaintStatus.RESOLVED
    ) {
      throw new BadRequestException(`Cannot escalate a ${complaint.status} complaint`);
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

    this.logger.log(`Complaint ${complaint.code} escalated to ${level}`);

    return updated;
  }

  /**
   * Gets complaint statistics for a date range.
   * Returns stats by type, severity, and resolution time.
   */
  async getStatistics(dateRange?: { startDate?: string; endDate?: string }) {
    const where: any = {};

    const statsDateFilter = buildDateFilter(dateRange?.startDate, dateRange?.endDate);
    if (statsDateFilter) {
      where.createdAt = statsDateFilter;
    }

    // Total counts
    const [total, open, investigating, pendingResolution, resolved, closed] = await Promise.all([
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
      resolutionRate: total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0,
    };
  }
}
