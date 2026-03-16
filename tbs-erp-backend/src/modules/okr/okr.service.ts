import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  OKRPeriod,
  OKRLevel,
  OKRStatus,
  KeyResultStatus,
} from '@prisma/client';
import { OKRRepository } from './okr.repository';
import {
  CreateObjectiveDto,
  UpdateObjectiveDto,
  CreateKeyResultDto,
  UpdateKeyResultDto,
  CheckInDto,
  OKRQueryDto,
} from './dto';

@Injectable()
export class OKRService {
  private readonly logger = new Logger(OKRService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly okrRepo: OKRRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------------------
  // Objective CRUD
  // ---------------------------------------------------------------------------

  async createObjective(userId: string, dto: CreateObjectiveDto) {
    // Validate parent neu co
    if (dto.parentId) {
      const parent = await this.prisma.objective.findFirst({
        where: { id: dto.parentId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException(`Khong tim thay Objective cha voi ID: ${dto.parentId}`);
      }
      // Dam bao cap do nhat quan: COMPANY -> DEPT -> INDIVIDUAL
      const validParentLevel = this.getValidParentLevel(dto.level);
      if (validParentLevel && parent.level !== validParentLevel) {
        throw new BadRequestException(
          `Objective cap ${dto.level} chi co the thuoc cap ${validParentLevel}`,
        );
      }
    }

    const objective = await this.prisma.objective.create({
      data: {
        title: dto.title,
        description: dto.description,
        period: dto.period,
        year: dto.year,
        level: dto.level,
        status: OKRStatus.DRAFT,
        ownerId: userId,
        department: dto.department,
        parentId: dto.parentId,
      },
      include: {
        keyResults: true,
        parent: {
          select: { id: true, title: true, level: true },
        },
      },
    });

    this.logger.log(`Objective [${objective.id}] created by user ${userId}`);
    this.eventEmitter.emit('okr.objective.created', {
      objectiveId: objective.id,
      title: objective.title,
      level: objective.level,
      period: objective.period,
      year: objective.year,
      ownerId: userId,
    });

    return { ...objective, progress: 0 };
  }

  async updateObjective(userId: string, id: string, dto: UpdateObjectiveDto) {
    const objective = await this.prisma.objective.findFirst({
      where: { id, deletedAt: null },
    });
    if (!objective) {
      throw new NotFoundException(`Khong tim thay Objective voi ID: ${id}`);
    }
    if (objective.status === OKRStatus.CANCELLED) {
      throw new BadRequestException('Khong the sua Objective da huy');
    }

    const updated = await this.prisma.objective.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        keyResults: true,
        parent: { select: { id: true, title: true, level: true } },
      },
    });

    this.logger.log(`Objective [${id}] updated by user ${userId}`);
    return this.okrRepo.enrichWithProgress(updated);
  }

  async deleteObjective(userId: string, id: string) {
    const objective = await this.prisma.objective.findFirst({
      where: { id, deletedAt: null },
    });
    if (!objective) {
      throw new NotFoundException(`Khong tim thay Objective voi ID: ${id}`);
    }

    await this.prisma.objective.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Objective [${id}] soft-deleted by user ${userId}`);
    return { success: true };
  }

  async getObjectives(userId: string, query: OKRQueryDto) {
    return this.okrRepo.findObjectives(query, userId);
  }

  async getObjectiveById(userId: string, id: string) {
    const objective = await this.okrRepo.findObjectiveById(id);
    if (!objective) {
      throw new NotFoundException(`Khong tim thay Objective voi ID: ${id}`);
    }
    return this.okrRepo.enrichWithProgress(objective);
  }

  async getCompanyOKRTree(period?: OKRPeriod, year?: number) {
    return this.okrRepo.getCompanyOKRTree(period, year);
  }

  async getMyOKRs(userId: string, period?: OKRPeriod, year?: number) {
    return this.okrRepo.getMyOKRs(userId, period, year);
  }

  async getParentCandidates(level: OKRLevel, period?: OKRPeriod, year?: number) {
    return this.okrRepo.getParentCandidates(level, period, year);
  }

  // ---------------------------------------------------------------------------
  // Key Result CRUD
  // ---------------------------------------------------------------------------

  async createKeyResult(userId: string, objectiveId: string, dto: CreateKeyResultDto) {
    const objective = await this.prisma.objective.findFirst({
      where: { id: objectiveId, deletedAt: null },
    });
    if (!objective) {
      throw new NotFoundException(`Khong tim thay Objective voi ID: ${objectiveId}`);
    }
    if (objective.status === OKRStatus.CANCELLED || objective.status === OKRStatus.COMPLETED) {
      throw new BadRequestException(
        `Khong the them Key Result vao Objective co trang thai ${objective.status}`,
      );
    }

    const keyResult = await this.prisma.keyResult.create({
      data: {
        objectiveId,
        title: dto.title,
        description: dto.description,
        metricType: dto.metricType || 'PERCENTAGE',
        targetValue: dto.targetValue,
        currentValue: 0,
        unit: dto.unit,
        status: KeyResultStatus.NOT_STARTED,
        ownerId: userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        checkIns: { orderBy: { createdAt: 'desc' }, take: 5 },
        linkedTasks: true,
      },
    });

    this.logger.log(`KeyResult [${keyResult.id}] created for Objective [${objectiveId}]`);
    return keyResult;
  }

  async updateKeyResultValue(userId: string, keyResultId: string, dto: CheckInDto) {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });
    if (!keyResult) {
      throw new NotFoundException(`Khong tim thay Key Result voi ID: ${keyResultId}`);
    }

    // 1. Tao OKRCheckIn record
    await this.prisma.oKRCheckIn.create({
      data: {
        keyResultId,
        value: dto.value,
        note: dto.note,
        createdBy: userId,
      },
    });

    // 2. Tinh toan status moi dua tren progress
    const newStatus = this.computeKeyResultStatus(dto.value, keyResult.targetValue);

    // 3. Cap nhat keyResult
    const updated = await this.prisma.keyResult.update({
      where: { id: keyResultId },
      data: {
        currentValue: dto.value,
        status: newStatus,
      },
      include: {
        checkIns: { orderBy: { createdAt: 'desc' }, take: 10 },
        linkedTasks: true,
      },
    });

    // 4. Tinh lai progress cua objective cha
    await this.okrRepo.computeProgress(keyResult.objectiveId);

    this.logger.log(
      `CheckIn for KR [${keyResultId}]: ${dto.value}/${keyResult.targetValue} (${newStatus})`,
    );

    return updated;
  }

  async updateKeyResult(userId: string, keyResultId: string, dto: UpdateKeyResultDto) {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });
    if (!keyResult) {
      throw new NotFoundException(`Khong tim thay Key Result voi ID: ${keyResultId}`);
    }

    const updated = await this.prisma.keyResult.update({
      where: { id: keyResultId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.targetValue !== undefined && { targetValue: dto.targetValue }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
      },
      include: {
        checkIns: { orderBy: { createdAt: 'desc' }, take: 10 },
        linkedTasks: true,
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Task Links
  // ---------------------------------------------------------------------------

  async linkTask(userId: string, keyResultId: string, taskId: string) {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });
    if (!keyResult) {
      throw new NotFoundException(`Khong tim thay Key Result voi ID: ${keyResultId}`);
    }

    // Kiem tra task ton tai
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`Khong tim thay Task voi ID: ${taskId}`);
    }

    const link = await this.prisma.oKRTaskLink.upsert({
      where: { keyResultId_taskId: { keyResultId, taskId } },
      update: {},
      create: { keyResultId, taskId },
    });

    return link;
  }

  async unlinkTask(userId: string, keyResultId: string, taskId: string) {
    const link = await this.prisma.oKRTaskLink.findUnique({
      where: { keyResultId_taskId: { keyResultId, taskId } },
    });
    if (!link) {
      throw new NotFoundException('Khong tim thay lien ket Task - KeyResult');
    }

    await this.prisma.oKRTaskLink.delete({
      where: { keyResultId_taskId: { keyResultId, taskId } },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async getOKRDashboard(userId: string) {
    const currentYear = new Date().getFullYear();

    const [myObjectives, allActive, atRiskKRs, completedObj] = await Promise.all([
      this.prisma.objective.findMany({
        where: { ownerId: userId, deletedAt: null, year: currentYear },
        include: { keyResults: true },
      }),
      this.prisma.objective.findMany({
        where: {
          deletedAt: null,
          status: OKRStatus.ACTIVE,
          year: currentYear,
        },
        include: { keyResults: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.keyResult.findMany({
        where: {
          status: { in: [KeyResultStatus.AT_RISK, KeyResultStatus.BEHIND] },
          objective: { deletedAt: null, year: currentYear },
        },
        include: {
          objective: { select: { id: true, title: true, ownerId: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.objective.count({
        where: {
          deletedAt: null,
          status: OKRStatus.COMPLETED,
          year: currentYear,
        },
      }),
    ]);

    // Tinh avg progress cho my objectives
    const myProgress =
      myObjectives.length === 0
        ? 0
        : Math.round(
            myObjectives.reduce((sum, obj) => {
              const krs = obj.keyResults;
              if (krs.length === 0) return sum;
              const p =
                krs.reduce(
                  (s, kr) =>
                    s + Math.min(kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0, 100),
                  0,
                ) / krs.length;
              return sum + p;
            }, 0) / myObjectives.length,
          );

    // Top performers: group by ownerId, tinh avg progress
    const ownerProgressMap = new Map<string, { total: number; count: number }>();
    for (const obj of allActive) {
      const krs = obj.keyResults;
      if (krs.length === 0) continue;
      const progress =
        krs.reduce(
          (s, kr) =>
            s + Math.min(kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0, 100),
          0,
        ) / krs.length;

      const entry = ownerProgressMap.get(obj.ownerId) || { total: 0, count: 0 };
      entry.total += progress;
      entry.count += 1;
      ownerProgressMap.set(obj.ownerId, entry);
    }

    // Lay top 5 owners
    const ownerIds = Array.from(ownerProgressMap.entries())
      .map(([ownerId, { total, count }]) => ({ ownerId, avgProgress: Math.round(total / count) }))
      .sort((a, b) => b.avgProgress - a.avgProgress)
      .slice(0, 5);

    // Resolve ten user
    const userIds = ownerIds.map((o) => o.ownerId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const topPerformers = ownerIds.map((o) => ({
      ...o,
      user: userMap.get(o.ownerId) || null,
    }));

    return {
      myObjectivesCount: myObjectives.length,
      myAvgProgress: myProgress,
      atRiskCount: atRiskKRs.length,
      completedCount: completedObj,
      atRiskKeyResults: atRiskKRs,
      topPerformers,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private computeKeyResultStatus(currentValue: number, targetValue: number): KeyResultStatus {
    if (targetValue === 0) return KeyResultStatus.NOT_STARTED;
    const pct = (currentValue / targetValue) * 100;
    if (pct >= 100) return KeyResultStatus.COMPLETED;
    if (pct >= 70) return KeyResultStatus.ON_TRACK;
    if (pct >= 40) return KeyResultStatus.AT_RISK;
    return KeyResultStatus.BEHIND;
  }

  private getValidParentLevel(childLevel: OKRLevel): OKRLevel | null {
    if (childLevel === OKRLevel.DEPARTMENT) return OKRLevel.COMPANY;
    if (childLevel === OKRLevel.INDIVIDUAL) return OKRLevel.DEPARTMENT;
    return null;
  }
}
