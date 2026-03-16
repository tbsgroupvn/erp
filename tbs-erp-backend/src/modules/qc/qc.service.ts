import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, QCStatus } from '@prisma/client';
import { QCRepository } from './qc.repository';
import { CreateQCInspectionDto } from './dto/create-qc-inspection.dto';
import { SubmitInspectionDto } from './dto/submit-inspection.dto';
import { QCQueryDto } from './dto/qc-query.dto';
import { PhotoType } from './dto/add-photos.dto';

/**
 * Valid QC status transitions.
 *
 * Defines which statuses a QC inspection can move to from each status:
 * - PENDING -> INSPECTING
 * - INSPECTING -> PASSED, FAILED, PARTIAL
 * - PASSED -> CUSTOMER_REVIEW
 * - PARTIAL -> CUSTOMER_REVIEW
 * - FAILED -> CUSTOMER_REVIEW
 * - CUSTOMER_REVIEW -> CUSTOMER_APPROVED, CUSTOMER_REJECTED
 * - CUSTOMER_REJECTED -> INSPECTING (re-inspect)
 */
const STATUS_TRANSITIONS: Record<QCStatus, QCStatus[]> = {
  [QCStatus.PENDING]: [QCStatus.INSPECTING],
  [QCStatus.INSPECTING]: [QCStatus.PASSED, QCStatus.FAILED, QCStatus.PARTIAL],
  [QCStatus.PASSED]: [QCStatus.CUSTOMER_REVIEW],
  [QCStatus.PARTIAL]: [QCStatus.CUSTOMER_REVIEW],
  [QCStatus.FAILED]: [QCStatus.CUSTOMER_REVIEW],
  [QCStatus.CUSTOMER_REVIEW]: [QCStatus.CUSTOMER_APPROVED, QCStatus.CUSTOMER_REJECTED],
  [QCStatus.CUSTOMER_APPROVED]: [],
  [QCStatus.CUSTOMER_REJECTED]: [QCStatus.INSPECTING],
};

@Injectable()
export class QCService {
  private readonly logger = new Logger(QCService.name);

  constructor(
    private readonly qcRepository: QCRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new QC inspection record.
   *
   * Validates that the referenced order exists, generates a unique
   * QC code in format QC-YYYYMM-XXXX, and creates the inspection
   * with PENDING status.
   */
  async createInspection(dto: CreateQCInspectionDto, userId: string) {
    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, code: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    // Validate package exists if provided
    if (dto.packageId) {
      const pkg = await this.prisma.package.findUnique({
        where: { id: dto.packageId },
        select: { id: true, orderId: true },
      });

      if (!pkg) {
        throw new NotFoundException(`Package with ID ${dto.packageId} not found`);
      }

      if (pkg.orderId !== dto.orderId) {
        throw new BadRequestException(
          `Package ${dto.packageId} does not belong to order ${dto.orderId}`,
        );
      }
    }

    // Generate unique QC code
    const code = await this.qcRepository.generateCode();

    const inspection = await this.qcRepository.create({
      code,
      orderId: dto.orderId,
      packageId: dto.packageId ?? null,
      status: QCStatus.PENDING,
      createdBy: userId,
    });

    this.eventEmitter.emit('qc.inspection.created', {
      inspectionId: inspection.id,
      code: inspection.code,
      orderId: dto.orderId,
      packageId: dto.packageId,
      createdBy: userId,
    });

    this.logger.log(`QC inspection ${code} created for order ${order.code} by user ${userId}`);

    return inspection;
  }

  /**
   * Lists QC inspections with pagination and filtering.
   *
   * Supports filtering by status, orderId, packageId, search term
   * (code, order code), and date range (createdAt).
   */
  async findAll(query: QCQueryDto) {
    const where: Prisma.QCInspectionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.packageId) {
      where.packageId = query.packageId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        {
          order: {
            code: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          package: {
            trackingNumberCN: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const { data, total } = await this.qcRepository.findAll(
      where,
      query.skip,
      query.limit,
      query.orderBy as Prisma.QCInspectionOrderByWithRelationInput,
    );

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Retrieves a single QC inspection by ID with full relations.
   *
   * Throws NotFoundException if the inspection does not exist.
   */
  async findById(id: string) {
    const inspection = await this.qcRepository.findById(id);

    if (!inspection) {
      throw new NotFoundException(`QC inspection with ID ${id} not found`);
    }

    return inspection;
  }

  /**
   * Starts an inspection, moving it from PENDING to INSPECTING.
   *
   * Records the inspector user ID and the start timestamp.
   */
  async startInspection(id: string, userId: string) {
    const inspection = await this.findById(id);

    this.validateTransition(inspection.status, QCStatus.INSPECTING);

    const updated = await this.qcRepository.update(id, {
      status: QCStatus.INSPECTING,
      inspectedBy: userId,
      inspectedAt: new Date(),
    });

    this.eventEmitter.emit('qc.inspection.started', {
      inspectionId: id,
      code: inspection.code,
      orderId: inspection.orderId,
      inspectedBy: userId,
    });

    this.logger.log(`QC inspection ${inspection.code} started by user ${userId}`);

    return updated;
  }

  /**
   * Submits inspection results.
   *
   * Records quantities (inspected, passed, failed), photos, rating,
   * checklist results, and notes. Determines the final status:
   * - PASSED: if failedQuantity === 0
   * - FAILED: if passedQuantity === 0
   * - PARTIAL: if both passed and failed quantities are non-zero
   */
  async submitInspection(id: string, dto: SubmitInspectionDto, userId: string) {
    const inspection = await this.findById(id);

    // Validate quantities are non-negative integers
    if (dto.inspectedQuantity < 0 || dto.passedQuantity < 0 || dto.failedQuantity < 0) {
      throw new BadRequestException('Quantities must be non-negative values');
    }

    if (dto.inspectedQuantity === 0) {
      throw new BadRequestException('inspectedQuantity must be greater than 0');
    }

    // Validate quantities are consistent
    if (dto.passedQuantity + dto.failedQuantity !== dto.inspectedQuantity) {
      throw new BadRequestException(
        `passedQuantity (${dto.passedQuantity}) + failedQuantity (${dto.failedQuantity}) ` +
          `must equal inspectedQuantity (${dto.inspectedQuantity})`,
      );
    }

    // Validate overallRating is within valid range (1-5) if provided
    if (dto.overallRating !== undefined) {
      if (dto.overallRating < 1 || dto.overallRating > 5) {
        throw new BadRequestException(
          `overallRating must be between 1 and 5. Received: ${dto.overallRating}`,
        );
      }
    }

    // D5: Mandatory photos for QC submission
    const totalPhotos =
      (dto.photoUrls?.length ?? 0) +
      (dto.detailPhotoUrls?.length ?? 0) +
      (dto.defectPhotoUrls?.length ?? 0) +
      (inspection.photoUrls?.length ?? 0) +
      (inspection.detailPhotoUrls?.length ?? 0) +
      (inspection.defectPhotoUrls?.length ?? 0);
    if (totalPhotos < 1) {
      throw new BadRequestException('Bắt buộc đính kèm ít nhất 1 ảnh khi nộp kết quả QC');
    }

    // Determine result status based on quantities
    let resultStatus: QCStatus;
    if (dto.failedQuantity === 0) {
      resultStatus = QCStatus.PASSED;
    } else if (dto.passedQuantity === 0) {
      resultStatus = QCStatus.FAILED;
    } else {
      resultStatus = QCStatus.PARTIAL;
    }

    // Validate transition against the actual computed result status
    this.validateTransition(inspection.status, resultStatus);

    const updateData: Prisma.QCInspectionUncheckedUpdateInput = {
      status: resultStatus,
      inspectedQuantity: dto.inspectedQuantity,
      passedQuantity: dto.passedQuantity,
      failedQuantity: dto.failedQuantity,
      inspectedBy: userId,
      inspectedAt: new Date(),
    };

    if (dto.overallRating !== undefined) {
      updateData.overallRating = dto.overallRating;
    }

    if (dto.checklistResults !== undefined) {
      updateData.checklistResults = dto.checklistResults;
    }

    if (dto.inspectorNote !== undefined) {
      updateData.inspectorNote = dto.inspectorNote;
    }

    if (dto.defectDescription !== undefined) {
      updateData.defectDescription = dto.defectDescription;
    }

    if (dto.photoUrls?.length) {
      updateData.photoUrls = [...(inspection.photoUrls ?? []), ...dto.photoUrls];
    }

    if (dto.detailPhotoUrls?.length) {
      updateData.detailPhotoUrls = [...(inspection.detailPhotoUrls ?? []), ...dto.detailPhotoUrls];
    }

    if (dto.defectPhotoUrls?.length) {
      updateData.defectPhotoUrls = [...(inspection.defectPhotoUrls ?? []), ...dto.defectPhotoUrls];
    }

    const updated = await this.qcRepository.update(id, updateData);

    this.eventEmitter.emit('qc.inspection.submitted', {
      inspectionId: id,
      code: inspection.code,
      orderId: inspection.orderId,
      status: resultStatus,
      inspectedQuantity: dto.inspectedQuantity,
      passedQuantity: dto.passedQuantity,
      failedQuantity: dto.failedQuantity,
      overallRating: dto.overallRating,
      submittedBy: userId,
    });

    this.logger.log(
      `QC inspection ${inspection.code} submitted with result ${resultStatus}: ` +
        `${dto.passedQuantity} passed, ${dto.failedQuantity} failed out of ${dto.inspectedQuantity}`,
    );

    return updated;
  }

  /**
   * Sends QC inspection results to the customer for review.
   *
   * Moves the status to CUSTOMER_REVIEW and records the timestamp.
   * Valid from PASSED, FAILED, or PARTIAL statuses.
   */
  async sendToCustomer(id: string, userId: string) {
    const inspection = await this.findById(id);

    this.validateTransition(inspection.status, QCStatus.CUSTOMER_REVIEW);

    const updated = await this.qcRepository.update(id, {
      status: QCStatus.CUSTOMER_REVIEW,
      sentToCustomerAt: new Date(),
    });

    this.eventEmitter.emit('qc.inspection.sent-to-customer', {
      inspectionId: id,
      code: inspection.code,
      orderId: inspection.orderId,
      sentBy: userId,
      photoUrls: inspection.photoUrls,
      detailPhotoUrls: inspection.detailPhotoUrls,
      defectPhotoUrls: inspection.defectPhotoUrls,
    });

    this.logger.log(
      `QC inspection ${inspection.code} sent to customer for review by user ${userId}`,
    );

    return updated;
  }

  /**
   * Records the customer's decision on a QC inspection.
   *
   * Moves to CUSTOMER_APPROVED or CUSTOMER_REJECTED based on the
   * approved flag, and records the customer note and review timestamp.
   */
  async recordCustomerDecision(id: string, approved: boolean, customerNote?: string) {
    const inspection = await this.findById(id);

    const targetStatus = approved ? QCStatus.CUSTOMER_APPROVED : QCStatus.CUSTOMER_REJECTED;

    this.validateTransition(inspection.status, targetStatus);

    const updated = await this.qcRepository.update(id, {
      status: targetStatus,
      customerApproved: approved,
      customerNote: customerNote ?? null,
      customerReviewedAt: new Date(),
    });

    this.eventEmitter.emit('qc.inspection.customer-decision', {
      inspectionId: id,
      code: inspection.code,
      orderId: inspection.orderId,
      approved,
      customerNote,
    });

    this.logger.log(
      `QC inspection ${inspection.code} customer decision: ${approved ? 'APPROVED' : 'REJECTED'}` +
        (customerNote ? ` - Note: ${customerNote}` : ''),
    );

    return updated;
  }

  /**
   * Appends photos to an existing QC inspection.
   *
   * Photos are added to the corresponding array based on the type:
   * - general -> photoUrls
   * - detail -> detailPhotoUrls
   * - defect -> defectPhotoUrls
   */
  async addPhotos(id: string, photoUrls: string[], type: PhotoType) {
    const inspection = await this.findById(id);

    const fieldMap: Record<
      PhotoType,
      keyof Pick<typeof inspection, 'photoUrls' | 'detailPhotoUrls' | 'defectPhotoUrls'>
    > = {
      [PhotoType.GENERAL]: 'photoUrls',
      [PhotoType.DETAIL]: 'detailPhotoUrls',
      [PhotoType.DEFECT]: 'defectPhotoUrls',
    };

    const field = fieldMap[type];
    const existingPhotos = inspection[field] ?? [];
    const mergedPhotos = [...existingPhotos, ...photoUrls];

    const updated = await this.qcRepository.update(id, {
      [field]: mergedPhotos,
    });

    this.logger.log(
      `Added ${photoUrls.length} ${type} photo(s) to QC inspection ${inspection.code}. ` +
        `Total ${type} photos: ${mergedPhotos.length}`,
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────
  // STATISTICS — Thong ke QC
  // ─────────────────────────────────────────────────────────────────

  /**
   * Thong ke tong the QC.
   *
   * Bao gom:
   *   - Tong so kiem tra, so dat/khong dat/phan
   *   - Ty le dat (passRate), ty le khong dat (failRate), ty le phan (partialRate)
   *   - Diem danh gia trung binh (overallRating)
   *   - Phan bo theo thang (so kiem tra moi thang, ty le dat theo thang)
   *   - So kiem tra dang cho xu ly (PENDING, INSPECTING, CUSTOMER_REVIEW)
   */
  async getStatistics(params: { startDate?: string; endDate?: string; months: number }) {
    const { startDate, endDate, months } = params;

    // Xay dung bo loc thoi gian
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const hasDateFilter = startDate || endDate;

    // --- Thong ke tong theo status ---
    const statusGroups = await this.prisma.qCInspection.groupBy({
      by: ['status'],
      where: hasDateFilter ? { createdAt: dateFilter } : {},
      _count: { id: true },
    });

    const statusMap = new Map(statusGroups.map(s => [s.status, s._count.id]));
    const total = statusGroups.reduce((sum, s) => sum + s._count.id, 0);

    const passed = statusMap.get(QCStatus.PASSED) ?? 0;
    const failed = statusMap.get(QCStatus.FAILED) ?? 0;
    const partial = statusMap.get(QCStatus.PARTIAL) ?? 0;
    const customerApproved = statusMap.get(QCStatus.CUSTOMER_APPROVED) ?? 0;
    const customerRejected = statusMap.get(QCStatus.CUSTOMER_REJECTED) ?? 0;

    // Tong so da co ket qua (PASSED + FAILED + PARTIAL + CUSTOMER_*)
    const completed = passed + failed + partial + customerApproved + customerRejected;

    // --- Diem danh gia trung binh ---
    const ratingAgg = await this.prisma.qCInspection.aggregate({
      where: {
        overallRating: { not: null },
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      _avg: { overallRating: true },
      _count: { overallRating: true },
    });

    // --- Thong ke dang cho xu ly ---
    const pending = statusMap.get(QCStatus.PENDING) ?? 0;
    const inspecting = statusMap.get(QCStatus.INSPECTING) ?? 0;
    const customerReview = statusMap.get(QCStatus.CUSTOMER_REVIEW) ?? 0;

    // --- Phan bo theo thang ---
    const monthlyBreakdown = await this._getMonthlyBreakdown(months);

    this.logger.log(
      `Thong ke QC: ${total} kiem tra, ${passed} dat, ${failed} khong dat, ${partial} phan`,
    );

    return {
      total,
      completed,
      byStatus: {
        pending,
        inspecting,
        passed,
        failed,
        partial,
        customerReview,
        customerApproved,
        customerRejected,
      },
      rates: {
        passRate: completed > 0 ? Math.round((passed + customerApproved) / completed * 1000) / 10 : 0,
        failRate: completed > 0 ? Math.round((failed + customerRejected) / completed * 1000) / 10 : 0,
        partialRate: completed > 0 ? Math.round(partial / completed * 1000) / 10 : 0,
      },
      avgRating: ratingAgg._avg.overallRating
        ? Math.round(Number(ratingAgg._avg.overallRating) * 10) / 10
        : null,
      ratedCount: ratingAgg._count.overallRating,
      inProgress: pending + inspecting + customerReview,
      monthlyBreakdown,
    };
  }

  /**
   * Lay danh sach anh cua mot QC inspection, phan loai theo kieu.
   *
   * Tra ve:
   *   - general: anh tong quan (photoUrls)
   *   - detail: anh chi tiet san pham (detailPhotoUrls)
   *   - defect: anh loi (defectPhotoUrls)
   *   - summary: tong so anh tung kieu
   */
  async getInspectionPhotos(id: string) {
    const inspection = await this.findById(id);

    const photos = {
      general: inspection.photoUrls ?? [],
      detail: inspection.detailPhotoUrls ?? [],
      defect: inspection.defectPhotoUrls ?? [],
    };

    return {
      inspectionId: id,
      code: inspection.code,
      status: inspection.status,
      photos,
      summary: {
        general: photos.general.length,
        detail: photos.detail.length,
        defect: photos.defect.length,
        total: photos.general.length + photos.detail.length + photos.defect.length,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  /**
   * Lay phan bo theo thang trong N thang gan nhat.
   *
   * Tra ve moi thang: so kiem tra tao, so dat, so khong dat, ty le dat.
   */
  private async _getMonthlyBreakdown(months: number) {
    const now = new Date();
    const result: {
      yearMonth: string;
      total: number;
      passed: number;
      failed: number;
      partial: number;
      passRate: number;
    }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const groups = await this.prisma.qCInspection.groupBy({
        by: ['status'],
        where: { createdAt: { gte: start, lte: end } },
        _count: { id: true },
      });

      const statusMap = new Map(groups.map(g => [g.status, g._count.id]));
      const monthTotal = groups.reduce((s, g) => s + g._count.id, 0);
      const monthPassed = statusMap.get(QCStatus.PASSED) ?? 0;
      const monthFailed = statusMap.get(QCStatus.FAILED) ?? 0;
      const monthPartial = statusMap.get(QCStatus.PARTIAL) ?? 0;
      const monthCompleted = monthPassed + monthFailed + monthPartial +
        (statusMap.get(QCStatus.CUSTOMER_APPROVED) ?? 0) +
        (statusMap.get(QCStatus.CUSTOMER_REJECTED) ?? 0);

      result.push({
        yearMonth,
        total: monthTotal,
        passed: monthPassed,
        failed: monthFailed,
        partial: monthPartial,
        passRate: monthCompleted > 0 ? Math.round(monthPassed / monthCompleted * 1000) / 10 : 0,
      });
    }

    return result;
  }

  /**
   * Validates that a status transition is allowed.
   *
   * Throws BadRequestException if the transition is not permitted
   * according to the STATUS_TRANSITIONS map.
   */
  private validateTransition(currentStatus: QCStatus, targetStatus: QCStatus): void {
    const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${targetStatus}. ` +
          `Allowed transitions: ${allowed.join(', ') || 'none'}`,
      );
    }
  }
}
