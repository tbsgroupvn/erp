import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MHHIssueStatus,
  MHHIssueType,
  MHHIssueResolution,
  ComplaintSeverity,
  Currency,
  Prisma,
} from '@prisma/client';
import { PaginatedResponse } from '@common/dto/base-response.dto';

// ---------------------------------------------------------------------------
// DTOs / Interfaces
// ---------------------------------------------------------------------------

export interface CreateMHHIssueInput {
  orderId: string;
  orderItemId?: string;
  packageId?: string;
  supplierOrderId?: string;
  issueType: MHHIssueType;
  severity?: ComplaintSeverity;
  description: string;
  attachments?: string[];
  evidenceUrls?: string[];
}

export interface MHHIssueQueryInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: MHHIssueStatus;
  issueType?: MHHIssueType;
  severity?: ComplaintSeverity;
  orderId?: string;
  handlerId?: string;
  search?: string;
}

export interface ResolveMHHIssueInput {
  resolution: MHHIssueResolution;
  resolutionNote?: string;
  compensationAmount?: number;
  compensationCurrency?: Currency;
}

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_STATUS_TRANSITIONS: Record<MHHIssueStatus, MHHIssueStatus[]> = {
  [MHHIssueStatus.OPEN]: [MHHIssueStatus.INVESTIGATING],
  [MHHIssueStatus.INVESTIGATING]: [
    MHHIssueStatus.WAITING_SUPPLIER,
    MHHIssueStatus.WAITING_CUSTOMER,
    MHHIssueStatus.RESOLVED,
  ],
  [MHHIssueStatus.WAITING_SUPPLIER]: [
    MHHIssueStatus.INVESTIGATING,
    MHHIssueStatus.RESOLVED,
  ],
  [MHHIssueStatus.WAITING_CUSTOMER]: [
    MHHIssueStatus.RESOLVED,
    MHHIssueStatus.CLOSED,
  ],
  [MHHIssueStatus.RESOLVED]: [MHHIssueStatus.CLOSED],
  [MHHIssueStatus.CLOSED]: [],
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * MHH Issue Service.
 *
 * Manages the lifecycle of MHH (Mua Hang Ho) purchase issues, including:
 *  - Creation with auto-generated sequential codes (MHH-ISS-YYYYMM-XXXX)
 *  - Status transitions with validation
 *  - Handler assignment
 *  - Resolution recording with optional compensation
 *  - Customer decision tracking
 *
 * Events emitted:
 *  - mhh-issue.created   - When a new issue is created
 *  - mhh-issue.updated   - When an issue status changes
 *  - mhh-issue.assigned  - When a handler is assigned
 *  - mhh-issue.resolved  - When an issue is resolved
 *  - mhh-issue.closed    - When an issue is closed
 */
@Injectable()
export class MHHIssueService {
  private readonly logger = new Logger(MHHIssueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  /**
   * Creates a new MHH issue with an auto-generated sequential code.
   *
   * @param dto - Issue creation data
   * @param userId - ID of the user creating the issue
   * @returns The created MHH issue
   */
  async createIssue(dto: CreateMHHIssueInput, userId: string) {
    this.logger.log(
      `Creating MHH issue: orderId=${dto.orderId}, type=${dto.issueType}, createdBy=${userId}`,
    );

    // Verify the order exists
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, code: true },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${dto.orderId}`);
    }

    // Verify order item exists if provided
    if (dto.orderItemId) {
      const orderItem = await this.prisma.orderItem.findUnique({
        where: { id: dto.orderItemId },
        select: { id: true },
      });

      if (!orderItem) {
        throw new NotFoundException(
          `Order item not found: ${dto.orderItemId}`,
        );
      }
    }

    const code = await this.generateCode();

    const issue = await this.prisma.mHHIssue.create({
      data: {
        code,
        orderId: dto.orderId,
        orderItemId: dto.orderItemId ?? null,
        packageId: dto.packageId ?? null,
        supplierOrderId: dto.supplierOrderId ?? null,
        issueType: dto.issueType,
        status: MHHIssueStatus.OPEN,
        severity: dto.severity ?? ComplaintSeverity.MEDIUM,
        description: dto.description,
        attachments: dto.attachments ?? [],
        evidenceUrls: dto.evidenceUrls ?? [],
        createdBy: userId,
      },
      include: {
        order: { select: { id: true, code: true } },
      },
    });

    this.logger.log(`MHH issue created: ${issue.code} (id=${issue.id})`);

    this.eventEmitter.emit('mhh-issue.created', {
      issueId: issue.id,
      code: issue.code,
      orderId: issue.orderId,
      issueType: issue.issueType,
      severity: issue.severity,
      createdBy: userId,
    });

    return issue;
  }

  // -----------------------------------------------------------------------
  // Read
  // -----------------------------------------------------------------------

  /**
   * Retrieves a paginated list of MHH issues with optional filters.
   *
   * @param query - Pagination and filter parameters
   * @returns Paginated list of issues
   */
  async findAll(query: MHHIssueQueryInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.MHHIssueWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.issueType) {
      where.issueType = query.issueType;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.handlerId) {
      where.handlerId = query.handlerId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [issues, total] = await Promise.all([
      this.prisma.mHHIssue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          order: { select: { id: true, code: true } },
        },
      }),
      this.prisma.mHHIssue.count({ where }),
    ]);

    return PaginatedResponse.paginate(issues, total, page, limit);
  }

  /**
   * Retrieves a single MHH issue by its ID.
   *
   * @param id - The issue ID
   * @returns The MHH issue with related order data
   * @throws NotFoundException if the issue does not exist
   */
  async findById(id: string) {
    const issue = await this.prisma.mHHIssue.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
            serviceType: true,
            status: true,
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(`MHH issue not found: ${id}`);
    }

    return issue;
  }

  /**
   * Retrieves all MHH issues associated with a specific order.
   *
   * @param orderId - The order ID
   * @returns Array of MHH issues for the order
   */
  async findByOrderId(orderId: string) {
    return this.prisma.mHHIssue.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, code: true } },
      },
    });
  }

  // -----------------------------------------------------------------------
  // Status management
  // -----------------------------------------------------------------------

  /**
   * Updates the status of an MHH issue with transition validation.
   *
   * Valid transitions:
   *  - OPEN -> INVESTIGATING
   *  - INVESTIGATING -> WAITING_SUPPLIER, WAITING_CUSTOMER, RESOLVED
   *  - WAITING_SUPPLIER -> INVESTIGATING, RESOLVED
   *  - WAITING_CUSTOMER -> RESOLVED, CLOSED
   *  - RESOLVED -> CLOSED
   *
   * @param id - The issue ID
   * @param newStatus - The target status
   * @param userId - ID of the user performing the update
   * @param note - Optional note about the status change
   * @returns The updated MHH issue
   * @throws NotFoundException if the issue does not exist
   * @throws BadRequestException if the transition is not allowed
   */
  async updateStatus(
    id: string,
    newStatus: MHHIssueStatus,
    userId: string,
    note?: string,
  ) {
    const issue = await this.prisma.mHHIssue.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });

    if (!issue) {
      throw new NotFoundException(`MHH issue not found: ${id}`);
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[issue.status];

    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${issue.status} -> ${newStatus}. ` +
          `Allowed transitions from ${issue.status}: [${allowedTransitions.join(', ')}]`,
      );
    }

    const updateData: Prisma.MHHIssueUpdateInput = {
      status: newStatus,
    };

    // If transitioning to RESOLVED, record the resolution timestamp
    if (newStatus === MHHIssueStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }

    // Append the note to resolutionNote if provided
    if (note) {
      updateData.resolutionNote = note;
    }

    const updated = await this.prisma.mHHIssue.update({
      where: { id },
      data: updateData,
      include: {
        order: { select: { id: true, code: true } },
      },
    });

    this.logger.log(
      `MHH issue ${issue.code} status changed: ${issue.status} -> ${newStatus} by ${userId}`,
    );

    this.eventEmitter.emit('mhh-issue.updated', {
      issueId: updated.id,
      code: updated.code,
      orderId: updated.orderId,
      previousStatus: issue.status,
      newStatus,
      updatedBy: userId,
      note,
    });

    // Emit specific event for closed issues
    if (newStatus === MHHIssueStatus.CLOSED) {
      this.eventEmitter.emit('mhh-issue.closed', {
        issueId: updated.id,
        code: updated.code,
        orderId: updated.orderId,
        resolution: updated.resolution,
        closedBy: userId,
      });
    }

    return updated;
  }

  // -----------------------------------------------------------------------
  // Assignment
  // -----------------------------------------------------------------------

  /**
   * Assigns a handler to an MHH issue.
   *
   * @param id - The issue ID
   * @param handlerId - The ID of the user to assign as handler
   * @param userId - ID of the user performing the assignment
   * @returns The updated MHH issue
   * @throws NotFoundException if the issue does not exist
   * @throws BadRequestException if the issue is already closed
   */
  async assignHandler(id: string, handlerId: string, userId: string) {
    const issue = await this.prisma.mHHIssue.findUnique({
      where: { id },
      select: { id: true, code: true, status: true, handlerId: true },
    });

    if (!issue) {
      throw new NotFoundException(`MHH issue not found: ${id}`);
    }

    if (issue.status === MHHIssueStatus.CLOSED) {
      throw new BadRequestException(
        `Cannot assign handler to a closed issue: ${issue.code}`,
      );
    }

    const updated = await this.prisma.mHHIssue.update({
      where: { id },
      data: {
        handlerId,
        assignedAt: new Date(),
      },
      include: {
        order: { select: { id: true, code: true } },
      },
    });

    this.logger.log(
      `MHH issue ${issue.code} assigned to handler ${handlerId} by ${userId}`,
    );

    this.eventEmitter.emit('mhh-issue.assigned', {
      issueId: updated.id,
      code: updated.code,
      orderId: updated.orderId,
      previousHandlerId: issue.handlerId,
      newHandlerId: handlerId,
      assignedBy: userId,
    });

    return updated;
  }

  // -----------------------------------------------------------------------
  // Resolution
  // -----------------------------------------------------------------------

  /**
   * Resolves an MHH issue with a specified resolution type and optional
   * compensation details.
   *
   * This method automatically transitions the issue status to RESOLVED.
   *
   * @param id - The issue ID
   * @param input - Resolution details (type, note, compensation)
   * @param userId - ID of the user resolving the issue
   * @returns The updated MHH issue
   * @throws NotFoundException if the issue does not exist
   * @throws BadRequestException if the issue cannot be resolved from its current status
   */
  async resolveIssue(
    id: string,
    input: ResolveMHHIssueInput,
    userId: string,
  ) {
    const issue = await this.prisma.mHHIssue.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });

    if (!issue) {
      throw new NotFoundException(`MHH issue not found: ${id}`);
    }

    // Verify the transition to RESOLVED is valid from the current status
    const allowedTransitions = VALID_STATUS_TRANSITIONS[issue.status];

    if (!allowedTransitions.includes(MHHIssueStatus.RESOLVED)) {
      throw new BadRequestException(
        `Cannot resolve issue from status ${issue.status}. ` +
          `Allowed transitions: [${allowedTransitions.join(', ')}]`,
      );
    }

    const updateData: Prisma.MHHIssueUpdateInput = {
      status: MHHIssueStatus.RESOLVED,
      resolution: input.resolution,
      resolutionNote: input.resolutionNote ?? null,
      resolvedAt: new Date(),
    };

    if (input.compensationAmount !== undefined) {
      updateData.compensationAmount = input.compensationAmount;
    }

    if (input.compensationCurrency !== undefined) {
      updateData.compensationCurrency = input.compensationCurrency;
    }

    const updated = await this.prisma.mHHIssue.update({
      where: { id },
      data: updateData,
      include: {
        order: { select: { id: true, code: true } },
      },
    });

    this.logger.log(
      `MHH issue ${issue.code} resolved: resolution=${input.resolution}, ` +
        `compensation=${input.compensationAmount ?? 'none'}, resolvedBy=${userId}`,
    );

    this.eventEmitter.emit('mhh-issue.resolved', {
      issueId: updated.id,
      code: updated.code,
      orderId: updated.orderId,
      resolution: input.resolution,
      resolutionNote: input.resolutionNote,
      compensationAmount: input.compensationAmount,
      compensationCurrency: input.compensationCurrency,
      resolvedBy: userId,
    });

    return updated;
  }

  // -----------------------------------------------------------------------
  // Customer decision
  // -----------------------------------------------------------------------

  /**
   * Records the customer's decision on an issue (e.g. KEEP, RETURN, EXCHANGE).
   *
   * Typically used when the issue is in WAITING_CUSTOMER status and the
   * customer provides their response.
   *
   * @param id - The issue ID
   * @param decision - The customer's decision string
   * @param customerNote - Optional note from the customer
   * @returns The updated MHH issue
   * @throws NotFoundException if the issue does not exist
   * @throws BadRequestException if the issue is closed or already resolved
   */
  async recordCustomerDecision(
    id: string,
    decision: string,
    customerNote?: string,
  ) {
    const issue = await this.prisma.mHHIssue.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });

    if (!issue) {
      throw new NotFoundException(`MHH issue not found: ${id}`);
    }

    if (
      issue.status === MHHIssueStatus.CLOSED ||
      issue.status === MHHIssueStatus.RESOLVED
    ) {
      throw new BadRequestException(
        `Cannot record customer decision on an issue with status ${issue.status}: ${issue.code}`,
      );
    }

    const updated = await this.prisma.mHHIssue.update({
      where: { id },
      data: {
        customerDecision: decision,
        customerDecisionAt: new Date(),
        customerNote: customerNote ?? null,
      },
      include: {
        order: { select: { id: true, code: true } },
      },
    });

    this.logger.log(
      `MHH issue ${issue.code} customer decision recorded: ${decision}`,
    );

    this.eventEmitter.emit('mhh-issue.updated', {
      issueId: updated.id,
      code: updated.code,
      orderId: updated.orderId,
      previousStatus: issue.status,
      newStatus: issue.status,
      customerDecision: decision,
      customerNote,
    });

    return updated;
  }

  // -----------------------------------------------------------------------
  // Code generation
  // -----------------------------------------------------------------------

  /**
   * Generates a sequential issue code in the format MHH-ISS-YYYYMM-XXXX.
   *
   * The sequence resets every month. It queries the highest existing code
   * for the current month and increments from there.
   *
   * @returns The next available issue code
   */
  async generateCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `MHH-ISS-${year}${month}-`;

    // Find the latest issue code for the current month
    const latestIssue = await this.prisma.mHHIssue.findFirst({
      where: {
        code: { startsWith: prefix },
      },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;

    if (latestIssue) {
      const lastSequence = parseInt(
        latestIssue.code.replace(prefix, ''),
        10,
      );

      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    const code = `${prefix}${String(sequence).padStart(4, '0')}`;

    this.logger.debug(`Generated MHH issue code: ${code}`);

    return code;
  }
}
