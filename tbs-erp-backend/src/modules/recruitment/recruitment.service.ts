import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CandidateQueryDto, CandidateStatus } from './dto/candidate-query.dto';
import { UpdateCandidateStatusDto } from './dto/update-status.dto';

/** Thứ tự chuyển trạng thái hợp lệ (FSM) */
const VALID_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  [CandidateStatus.NEW]: [CandidateStatus.SCREENING, CandidateStatus.REJECTED],
  [CandidateStatus.SCREENING]: [CandidateStatus.INTERVIEW, CandidateStatus.REJECTED],
  [CandidateStatus.INTERVIEW]: [CandidateStatus.OFFERED, CandidateStatus.REJECTED],
  [CandidateStatus.OFFERED]: [CandidateStatus.HIRED, CandidateStatus.REJECTED],
  [CandidateStatus.HIRED]: [],
  [CandidateStatus.REJECTED]: [],
};

/** Nhãn tiếng Việt các cột Kanban */
export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  [CandidateStatus.NEW]: 'Mới',
  [CandidateStatus.SCREENING]: 'Sàng lọc',
  [CandidateStatus.INTERVIEW]: 'Phỏng vấn',
  [CandidateStatus.OFFERED]: 'Đề xuất',
  [CandidateStatus.HIRED]: 'Tuyển dụng',
  [CandidateStatus.REJECTED]: 'Từ chối',
};

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Tạo ứng viên mới ─────────────────────────────────────────────────────

  async create(dto: CreateCandidateDto, createdBy: string) {
    const candidate = await this.prisma.candidate.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        source: dto.source,
        resumeUrl: dto.resumeUrl,
        notes: dto.notes,
        status: CandidateStatus.NEW,
        createdBy,
      },
    });

    this.logger.log(`Candidate created: ${candidate.id} - ${candidate.fullName}`);
    return candidate;
  }

  // ─── Danh sách phân trang + filter ────────────────────────────────────────

  async findAll(query: CandidateQueryDto) {
    const where: Prisma.CandidateWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.position) {
      where.position = { contains: query.position, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { position: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.candidate.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.CandidateOrderByWithRelationInput,
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  // ─── Chi tiết ứng viên ────────────────────────────────────────────────────

  async findById(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate) {
      throw new NotFoundException(`Không tìm thấy ứng viên với ID ${id}`);
    }
    return candidate;
  }

  // ─── Cập nhật thông tin ───────────────────────────────────────────────────

  async update(id: string, dto: UpdateCandidateDto) {
    await this.findById(id);

    const candidate = await this.prisma.candidate.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.resumeUrl !== undefined && { resumeUrl: dto.resumeUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    this.logger.log(`Candidate updated: ${id}`);
    return candidate;
  }

  // ─── Chuyển trạng thái (FSM) ──────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateCandidateStatusDto, userId: string) {
    const candidate = await this.findById(id);

    const currentStatus = candidate.status as CandidateStatus;
    const nextStatus = dto.status;

    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái "${CANDIDATE_STATUS_LABELS[currentStatus]}" sang "${CANDIDATE_STATUS_LABELS[nextStatus]}". ` +
          `Các trạng thái hợp lệ tiếp theo: ${allowed.map((s) => CANDIDATE_STATUS_LABELS[s]).join(', ') || 'Không có'}`,
      );
    }

    const updated = await this.prisma.candidate.update({
      where: { id },
      data: {
        status: nextStatus,
        notes: dto.reason
          ? `[${new Date().toLocaleDateString('vi-VN')} - ${nextStatus}] ${dto.reason}\n${candidate.notes ?? ''}`.trim()
          : candidate.notes,
      },
    });

    this.logger.log(
      `Candidate ${id} status: ${currentStatus} → ${nextStatus} by ${userId}`,
    );

    return updated;
  }

  // ─── Xóa cứng ────────────────────────────────────────────────────────────

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.candidate.delete({ where: { id } });
    this.logger.log(`Candidate deleted: ${id}`);
    return { deleted: true };
  }

  // ─── Thống kê theo trạng thái ─────────────────────────────────────────────

  async getStats() {
    const result = await this.prisma.candidate.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statuses = Object.values(CandidateStatus);
    const byStatus: Record<string, number> = {};
    statuses.forEach((s) => { byStatus[s] = 0; });
    result.forEach((r) => { byStatus[r.status] = r._count.id; });

    const total = Object.values(byStatus).reduce((sum, c) => sum + c, 0);

    return {
      total,
      byStatus,
      labels: CANDIDATE_STATUS_LABELS,
    };
  }

  // ─── Dữ liệu Kanban board (gom nhóm theo trạng thái) ─────────────────────

  async getBoardData(search?: string) {
    const where: Prisma.CandidateWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
      ];
    }

    const candidates = await this.prisma.candidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500, // Giới hạn tải board
    });

    const statuses = Object.values(CandidateStatus);
    const board: Record<string, { label: string; count: number; items: typeof candidates }> = {};

    statuses.forEach((status) => {
      board[status] = {
        label: CANDIDATE_STATUS_LABELS[status],
        count: 0,
        items: [],
      };
    });

    candidates.forEach((c) => {
      const col = board[c.status];
      if (col) {
        col.items.push(c);
        col.count++;
      }
    });

    return board;
  }
}
