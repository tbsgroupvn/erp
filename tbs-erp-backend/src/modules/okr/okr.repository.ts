import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { OKRPeriod, OKRLevel, OKRStatus, KeyResultStatus } from '@prisma/client';
import { OKRQueryDto } from './dto';

@Injectable()
export class OKRRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tim kiem Objectives theo filter. Tra ve ca keyResults voi progress tinh toan.
   */
  async findObjectives(query: OKRQueryDto, callerUserId?: string) {
    const where: any = {
      deletedAt: null,
    };

    if (query.period) where.period = query.period;
    if (query.year) where.year = query.year;
    if (query.level) where.level = query.level;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.status) where.status = query.status;

    const objectives = await this.prisma.objective.findMany({
      where,
      include: {
        keyResults: {
          orderBy: { createdAt: 'asc' },
        },
        children: {
          where: { deletedAt: null },
          select: { id: true, title: true, level: true, status: true },
        },
        parent: {
          select: { id: true, title: true, level: true },
        },
      },
      orderBy: [{ year: 'desc' }, { period: 'asc' }, { createdAt: 'desc' }],
    });

    return objectives.map((obj) => this.enrichWithProgress(obj));
  }

  /**
   * Tim Objective theo ID voi day du thong tin: keyResults, checkIns, linkedTasks.
   */
  async findObjectiveById(id: string) {
    return this.prisma.objective.findFirst({
      where: { id, deletedAt: null },
      include: {
        keyResults: {
          include: {
            checkIns: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            linkedTasks: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        children: {
          where: { deletedAt: null },
          include: {
            keyResults: true,
          },
        },
        parent: {
          select: { id: true, title: true, level: true, status: true },
        },
      },
    });
  }

  /**
   * Lay cay OKR theo cap bac: Company -> Department -> Individual.
   */
  async getCompanyOKRTree(period?: OKRPeriod, year?: number) {
    const where: any = {
      deletedAt: null,
      level: OKRLevel.COMPANY,
    };
    if (period) where.period = period;
    if (year) where.year = year;

    const companyObjectives = await this.prisma.objective.findMany({
      where,
      include: {
        keyResults: true,
        children: {
          where: { deletedAt: null, level: OKRLevel.DEPARTMENT },
          include: {
            keyResults: true,
            children: {
              where: { deletedAt: null, level: OKRLevel.INDIVIDUAL },
              include: {
                keyResults: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return companyObjectives.map((obj) => this.enrichTreeWithProgress(obj));
  }

  /**
   * Lay OKRs cua mot user cu the.
   */
  async getMyOKRs(userId: string, period?: OKRPeriod, year?: number) {
    const where: any = {
      deletedAt: null,
      ownerId: userId,
    };
    if (period) where.period = period;
    if (year) where.year = year;

    const objectives = await this.prisma.objective.findMany({
      where,
      include: {
        keyResults: {
          include: {
            checkIns: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        parent: {
          select: { id: true, title: true, level: true },
        },
      },
      orderBy: [{ year: 'desc' }, { period: 'asc' }, { createdAt: 'desc' }],
    });

    return objectives.map((obj) => this.enrichWithProgress(obj));
  }

  /**
   * Tinh toan progress % cua mot objective dua tren tat ca keyResults.
   */
  async computeProgress(objectiveId: string): Promise<number> {
    const keyResults = await this.prisma.keyResult.findMany({
      where: { objectiveId },
      select: { targetValue: true, currentValue: true },
    });

    if (keyResults.length === 0) return 0;

    const totalProgress = keyResults.reduce((sum, kr) => {
      if (kr.targetValue === 0) return sum;
      const pct = Math.min((kr.currentValue / kr.targetValue) * 100, 100);
      return sum + pct;
    }, 0);

    return Math.round(totalProgress / keyResults.length);
  }

  /**
   * Lay cac objective co the lam parent (cap cao hon).
   */
  async getParentCandidates(level: OKRLevel, period?: OKRPeriod, year?: number) {
    const parentLevel =
      level === OKRLevel.INDIVIDUAL
        ? OKRLevel.DEPARTMENT
        : level === OKRLevel.DEPARTMENT
          ? OKRLevel.COMPANY
          : null;

    if (!parentLevel) return [];

    const where: any = { deletedAt: null, level: parentLevel, status: OKRStatus.ACTIVE };
    if (period) where.period = period;
    if (year) where.year = year;

    return this.prisma.objective.findMany({
      where,
      select: { id: true, title: true, level: true, department: true },
      orderBy: { title: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Public helpers (used by service)
  // ---------------------------------------------------------------------------

  computeKRProgress(currentValue: number, targetValue: number): number {
    if (targetValue === 0) return 0;
    return Math.min(Math.round((currentValue / targetValue) * 100), 100);
  }

  enrichWithProgress(obj: any) {
    const krs: any[] = obj.keyResults || [];
    const progress =
      krs.length === 0
        ? 0
        : Math.round(
            krs.reduce(
              (sum: number, kr: any) => sum + this.computeKRProgress(kr.currentValue, kr.targetValue),
              0,
            ) / krs.length,
          );

    return { ...obj, progress };
  }

  enrichTreeWithProgress(obj: any): any {
    const enriched = this.enrichWithProgress(obj);
    if (enriched.children) {
      enriched.children = enriched.children.map((child: any) => this.enrichTreeWithProgress(child));
    }
    return enriched;
  }
}
