import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { OrderStatus } from '@prisma/client';

/** Cache TTL for stage configs — 5 minutes. Configs change rarely. */
const STAGE_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

export interface StageConfig {
  id: string;
  stage: OrderStatus;
  departmentCode: string;
  primaryRoles: string[];
  slaHours: number;
  slaWarningHours: number | null;
  taskTitle: string;
  taskDescription: string | null;
  isActive: boolean;
  sortOrder: number;
}

/**
 * StageConfigService manages OrderStageConfig records which define:
 * - Which department owns each order lifecycle stage
 * - SLA hours per stage
 * - Auto-task title template per stage
 *
 * Configs are cached aggressively because they change only via admin actions.
 */
@Injectable()
export class StageConfigService {
  private readonly logger = new Logger(StageConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Returns the active StageConfig for a given OrderStatus stage,
   * or null if no config exists for that stage.
   */
  async getConfigForStage(stage: OrderStatus): Promise<StageConfig | null> {
    const cacheKey = `stage-config:${stage}`;

    const cached = await this.cacheService.get<StageConfig>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const config = await this.prisma.orderStageConfig.findFirst({
      where: { stage, isActive: true },
    });

    if (!config) {
      // Cache negative result to avoid repeated DB hits for unconfigured stages
      await this.cacheService.set<null>(cacheKey, null, STAGE_CONFIG_CACHE_TTL_MS);
      return null;
    }

    const result: StageConfig = {
      id: config.id,
      stage: config.stage,
      departmentCode: config.departmentCode,
      primaryRoles: config.primaryRoles as string[],
      slaHours: config.slaHours,
      slaWarningHours: config.slaWarningHours,
      taskTitle: config.taskTitle,
      taskDescription: config.taskDescription,
      isActive: config.isActive,
      sortOrder: config.sortOrder,
    };

    await this.cacheService.set<StageConfig>(cacheKey, result, STAGE_CONFIG_CACHE_TTL_MS);
    return result;
  }

  /**
   * Returns all active stage configs ordered by sortOrder.
   */
  async getAllActiveConfigs(): Promise<StageConfig[]> {
    const cacheKey = 'stage-config:all';

    const cached = await this.cacheService.get<StageConfig[]>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const configs = await this.prisma.orderStageConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const result: StageConfig[] = configs.map((c) => ({
      id: c.id,
      stage: c.stage,
      departmentCode: c.departmentCode,
      primaryRoles: c.primaryRoles as string[],
      slaHours: c.slaHours,
      slaWarningHours: c.slaWarningHours,
      taskTitle: c.taskTitle,
      taskDescription: c.taskDescription,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
    }));

    await this.cacheService.set<StageConfig[]>(cacheKey, result, STAGE_CONFIG_CACHE_TTL_MS);
    return result;
  }

  /**
   * Invalidates the cache for a specific stage config and the all-configs cache.
   * Call this whenever a StageConfig is created, updated, or deactivated.
   */
  async invalidateCache(stage?: OrderStatus): Promise<void> {
    if (stage) {
      await this.cacheService.del(`stage-config:${stage}`);
    }
    await this.cacheService.del('stage-config:all');
  }
}
