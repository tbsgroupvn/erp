import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import {
  Prisma,
  ShippingRoute,
  ServiceType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { generateCode } from '@common/utils/code-generator.util';
import { CreateRateCardDto, RateCardQueryDto, LookupRateCardDto } from './dto/rate-card.dto';
import {
  CreateVolumeTierDto,
  UpdateVolumeTierDto,
  PriceBreakdown,
  TierInfo,
} from './dto/volume-tier.dto';
import { CreateSeasonalRuleDto, UpdateSeasonalRuleDto } from './dto/seasonal-rule.dto';
import {
  CreateCustomerPriceOverrideDto,
  UpdateCustomerPriceOverrideDto,
  SimulatePriceDto,
  SimulatePriceResult,
} from './dto/customer-price-override.dto';

// He so quy doi CBM -> KG theo loai tuyen
const CBM_TO_KG_RATIO: Record<ShippingRoute, number> = {
  [ShippingRoute.SEA]: 6000,
  [ShippingRoute.ROAD]: 5000,
  [ShippingRoute.AIR]: 5000,
};

@Injectable()
export class RateCardService {
  private readonly logger = new Logger(RateCardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // PRISMA ACCESSORS — centralise `as any` casts for models not yet
  // recognised by the generated Prisma client type (seasonal rules,
  // customer overrides, volume tiers on extended includes).
  // ----------------------------------------------------------------

  private get seasonalRule() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any).rateCardSeasonalRule;
  }

  private get customerOverride() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.prisma as any).customerPriceOverride;
  }

  private get prismaAny() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma as any;
  }

  // ----------------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------------

  /**
   * Applies the three dynamic pricing layers (volume tier → seasonal → customer override)
   * to a base price and returns the final price per KG together with applied-layer metadata.
   *
   * This is the single source of truth for the pricing algorithm used by
   * calculatePrice(), simulatePrice(), and lookup().
   */
  private applyPricingLayers(
    basePrice: number,
    weight: number,
    volumeTiers: any[],
    seasonalRules: any[],
    customerOverrideRaw: { discountPct: number; fixedPrice: number | null } | null,
  ): {
    finalPricePerKg: number;
    tierInfo: TierInfo | null;
    seasonalAdjustPct: number | null;
    overrideApplied: boolean;
  } {
    let price = basePrice;
    let tierInfo: TierInfo | null = null;
    let seasonalAdjustPct: number | null = null;
    let overrideApplied = false;

    // Layer 1: Volume tier
    const matchedTier = volumeTiers.find((t: any) => {
      const tMin = Number(t.minWeight);
      const tMax = t.maxWeight ? Number(t.maxWeight) : Infinity;
      return weight >= tMin && weight < tMax;
    }) ?? null;

    if (matchedTier) {
      const discountPct = Number(matchedTier.discountPct);
      const fixedPrice = matchedTier.fixedPrice ? Number(matchedTier.fixedPrice) : null;
      const tMax = matchedTier.maxWeight ? Number(matchedTier.maxWeight) : null;

      price = fixedPrice != null ? fixedPrice : basePrice * (1 - discountPct / 100);

      tierInfo = {
        tierId: matchedTier.id,
        minWeight: Number(matchedTier.minWeight),
        maxWeight: tMax,
        discountPct,
        fixedPrice,
        label: fixedPrice != null
          ? `Tier ${Number(matchedTier.minWeight)}-${tMax ?? 'inf'} kg: gia co dinh ${fixedPrice.toLocaleString()} VND/kg`
          : `Tier ${Number(matchedTier.minWeight)}-${tMax ?? 'inf'} kg: giam ${discountPct}%`,
      };
    }

    // Layer 2: Seasonal rule (first active rule wins)
    const seasonalRule = seasonalRules[0] ?? null;
    if (seasonalRule) {
      seasonalAdjustPct = Number(seasonalRule.adjustPct);
      price = price * (1 + seasonalAdjustPct / 100);
    }

    // Layer 3: Customer override
    if (customerOverrideRaw) {
      overrideApplied = true;
      if (customerOverrideRaw.fixedPrice != null) {
        price = customerOverrideRaw.fixedPrice;
      } else {
        price = price * (1 - customerOverrideRaw.discountPct / 100);
      }
    }

    return { finalPricePerKg: price, tierInfo, seasonalAdjustPct, overrideApplied };
  }

  private async generateCode(): Promise<string> {
    return generateCode(this.prisma.rateCard, {
      prefix: 'RC',
      datePrefixFormat: 'YYYYMM',
      sequenceLength: 4,
    });
  }

  /**
   * Validate rang tier moi khong overlap voi cac tier hien co.
   * Overlap xay ra khi khoang [min, max) cua tier moi giao voi bat ky tier hien co.
   * excludeTierId: bo qua tier nay khi kiem tra (dung cho update).
   */
  private async assertNoTierOverlap(
    rateCardId: string,
    minWeight: number,
    maxWeight: number | null | undefined,
    excludeTierId?: string,
  ): Promise<void> {
    const tiers = await this.prisma.rateCardVolumeTier.findMany({
      where: {
        rateCardId,
        ...(excludeTierId ? { NOT: { id: excludeTierId } } : {}),
      },
    });

    for (const t of tiers) {
      const tMin = Number(t.minWeight);
      const tMax = t.maxWeight ? Number(t.maxWeight) : Infinity;
      const newMin = minWeight;
      const newMax = maxWeight != null ? maxWeight : Infinity;

      // Hai khoang [a,b) va [c,d) giao nhau khi a < d va c < b
      const overlaps = newMin < tMax && tMin < newMax;
      if (overlaps) {
        throw new BadRequestException(
          `Tier [${minWeight} - ${maxWeight ?? 'khong gioi han'}] kg bi trung lap voi tier hien co ` +
          `[${tMin} - ${t.maxWeight ?? 'khong gioi han'}] kg. Vui long chinh lai khoang can nang.`,
        );
      }
    }
  }

  // ----------------------------------------------------------------
  // RATE CARD CRUD (giu nguyen logic cu)
  // ----------------------------------------------------------------

  async create(userId: string, dto: CreateRateCardDto) {
    const code = await this.generateCode();

    return this.prisma.rateCard.create({
      data: {
        code,
        name: dto.name,
        origin: dto.origin,
        destination: dto.destination,
        transportMode: dto.transportMode,
        serviceType: dto.serviceType ?? ServiceType.VCT,
        pricePerCBM: new Decimal(dto.pricePerCBM),
        pricePerKG: new Decimal(dto.pricePerKG),
        minChargeAmount: dto.minChargeAmount ? new Decimal(dto.minChargeAmount) : null,
        validFrom: new Date(dto.validFrom),
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        note: dto.note,
        createdBy: userId,
        surcharges: dto.surcharges
          ? {
              create: dto.surcharges.map((s) => ({
                name: s.name,
                amount: new Decimal(s.amount),
                percent: s.percent ? new Decimal(s.percent) : null,
                isPercent: s.isPercent ?? false,
                isOptional: s.isOptional ?? false,
                sortOrder: s.sortOrder ?? 0,
              })),
            }
          : undefined,
        discounts: dto.discounts
          ? {
              create: dto.discounts.map((d) => ({
                customerTier: d.customerTier,
                discountPercent: new Decimal(d.discountPercent),
              })),
            }
          : undefined,
      },
      include: {
        surcharges: true,
        discounts: true,
        volumeTiers: { orderBy: { minWeight: 'asc' } },
      },
    });
  }

  async findAll(query: RateCardQueryDto) {
    const where: Prisma.RateCardWhereInput = {};
    if (query.origin) where.origin = query.origin;
    if (query.destination) where.destination = query.destination;
    if (query.transportMode) where.transportMode = query.transportMode;
    if (query.serviceType) where.serviceType = query.serviceType;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.rateCard.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          surcharges: { orderBy: { sortOrder: 'asc' } },
          discounts: true,
          volumeTiers: { orderBy: { minWeight: 'asc' } },
        },
      }),
      this.prisma.rateCard.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string) {
    const rc = await this.prisma.rateCard.findUnique({
      where: { id },
      include: {
        surcharges: { orderBy: { sortOrder: 'asc' } },
        discounts: true,
        volumeTiers: { orderBy: { minWeight: 'asc' } },
      },
    });
    if (!rc) throw new NotFoundException(`Rate Card ${id} khong tim thay`);
    return rc;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.rateCard.update({ where: { id }, data: { isActive: false } });
  }

  // ----------------------------------------------------------------
  // VOLUME TIER CRUD
  // ----------------------------------------------------------------

  /** Lay danh sach tat ca volume tier cua mot rate card, sap xep theo minWeight tang dan. */
  async getVolumeTiers(rateCardId: string) {
    await this.findOne(rateCardId); // dam bao rate card ton tai
    return this.prisma.rateCardVolumeTier.findMany({
      where: { rateCardId },
      orderBy: { minWeight: 'asc' },
    });
  }

  /** Them mot volume tier moi vao rate card. Kiem tra khong bi overlap voi cac tier hien co. */
  async addVolumeTier(rateCardId: string, dto: CreateVolumeTierDto) {
    await this.findOne(rateCardId); // dam bao rate card ton tai

    if (dto.maxWeight != null && dto.maxWeight <= dto.minWeight) {
      throw new BadRequestException(
        `maxWeight (${dto.maxWeight}) phai lon hon minWeight (${dto.minWeight}).`,
      );
    }

    await this.assertNoTierOverlap(rateCardId, dto.minWeight, dto.maxWeight);

    const tier = await this.prisma.rateCardVolumeTier.create({
      data: {
        rateCardId,
        minWeight: new Decimal(dto.minWeight),
        maxWeight: dto.maxWeight != null ? new Decimal(dto.maxWeight) : null,
        discountPct: new Decimal(dto.discountPct),
        fixedPrice: dto.fixedPrice != null ? new Decimal(dto.fixedPrice) : null,
      },
    });

    this.logger.log(`Volume tier them moi: tierId=${tier.id} rateCardId=${rateCardId} min=${dto.minWeight} max=${dto.maxWeight ?? 'inf'}`);
    return tier;
  }

  /** Cap nhat volume tier. Chi cap nhat cac field duoc truyen (partial update). */
  async updateVolumeTier(tierId: string, dto: UpdateVolumeTierDto) {
    const tier = await this.prisma.rateCardVolumeTier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFoundException(`Volume tier ${tierId} khong tim thay`);

    // Tinh gia tri moi de kiem tra overlap
    const newMin = dto.minWeight ?? Number(tier.minWeight);
    const newMax = Object.prototype.hasOwnProperty.call(dto, 'maxWeight')
      ? dto.maxWeight
      : (tier.maxWeight ? Number(tier.maxWeight) : null);

    if (newMax != null && newMax <= newMin) {
      throw new BadRequestException(
        `maxWeight (${newMax}) phai lon hon minWeight (${newMin}).`,
      );
    }

    await this.assertNoTierOverlap(tier.rateCardId, newMin, newMax, tierId);

    const updated = await this.prisma.rateCardVolumeTier.update({
      where: { id: tierId },
      data: {
        ...(dto.minWeight !== undefined && { minWeight: new Decimal(dto.minWeight) }),
        ...(Object.prototype.hasOwnProperty.call(dto, 'maxWeight') && {
          maxWeight: dto.maxWeight != null ? new Decimal(dto.maxWeight) : null,
        }),
        ...(dto.discountPct !== undefined && { discountPct: new Decimal(dto.discountPct) }),
        ...(Object.prototype.hasOwnProperty.call(dto, 'fixedPrice') && {
          fixedPrice: dto.fixedPrice != null ? new Decimal(dto.fixedPrice) : null,
        }),
      },
    });

    this.logger.log(`Volume tier cap nhat: tierId=${tierId}`);
    return updated;
  }

  /** Xoa mot volume tier. */
  async removeVolumeTier(tierId: string) {
    const tier = await this.prisma.rateCardVolumeTier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFoundException(`Volume tier ${tierId} khong tim thay`);

    await this.prisma.rateCardVolumeTier.delete({ where: { id: tierId } });
    this.logger.log(`Volume tier da xoa: tierId=${tierId}`);
    return { deleted: true, tierId };
  }

  // ----------------------------------------------------------------
  // DYNAMIC PRICING — calculatePrice (co seasonal + customer override)
  // ----------------------------------------------------------------

  /**
   * Tinh don gia cuoc cho mot rate card cu the dua tren can nang thuc te.
   *
   * Thu tu uu tien:
   * 1. Tim customer override (neu customerId duoc truyen va override dang hieu luc).
   *    - Neu override co fixedPrice → dung truc tiep (bo qua cac buoc con lai).
   *    - Neu override co discountPct → ap dung sau volume tier.
   * 2. Tim volume tier phu hop (minWeight <= weight < maxWeight).
   * 3. Ap dung seasonal rule dang active (ngay hien tai nam trong startDate-endDate).
   * 4. Neu khong co tier va override → dung pricePerKG goc.
   * 5. shippingAmount = finalPricePerKg * weight, ap dung minChargeAmount neu co.
   */
  async calculatePrice(
    rateCardId: string,
    weight: number,
    customerId?: string,
    date?: Date,
  ): Promise<PriceBreakdown> {
    const now = date ?? new Date();

    const rc = await this.prismaAny.rateCard.findUnique({
      where: { id: rateCardId },
      include: {
        volumeTiers: { orderBy: { minWeight: 'asc' } },
        seasonalRules: {
          where: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
          },
        },
      },
    });
    if (!rc) throw new NotFoundException(`Rate Card ${rateCardId} khong tim thay`);
    if (!rc.isActive) throw new BadRequestException(`Rate Card ${rc.code} da bi vo hieu hoa`);
    if (weight < 0) throw new BadRequestException('Can nang phai >= 0');

    const basePrice = Number(rc.pricePerKG);

    // Fetch customer override if customerId supplied
    let customerOverrideRaw: { discountPct: number; fixedPrice: number | null } | null = null;
    if (customerId) {
      const override = await this.customerOverride.findFirst({
        where: {
          customerId,
          rateCardId,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
      });
      if (override) {
        customerOverrideRaw = {
          discountPct: Number(override.discountPct),
          fixedPrice: override.fixedPrice ? Number(override.fixedPrice) : null,
        };
      }
    }

    // Apply all pricing layers via shared helper
    const { finalPricePerKg, tierInfo, seasonalAdjustPct } = this.applyPricingLayers(
      basePrice,
      weight,
      rc.volumeTiers,
      rc.seasonalRules ?? [],
      customerOverrideRaw,
    );

    if (seasonalAdjustPct !== null) {
      this.logger.debug(
        `Seasonal rule applied: adjustPct=${seasonalAdjustPct}%, newPrice=${finalPricePerKg}`,
      );
    }
    if (customerOverrideRaw) {
      this.logger.debug(
        `Customer override applied: customerId=${customerId} discountPct=${customerOverrideRaw.discountPct}% finalPrice=${finalPricePerKg}`,
      );
    }

    // shippingAmount = finalPricePerKg * weight, ap dung minChargeAmount
    const rawAmount = finalPricePerKg * weight;
    const minCharge = rc.minChargeAmount ? Number(rc.minChargeAmount) : 0;
    const shippingAmount = Math.round(Math.max(rawAmount, minCharge));

    this.logger.debug(
      `calculatePrice: rateCardId=${rateCardId} weight=${weight}kg ` +
      `basePrice=${basePrice} finalPricePerKg=${finalPricePerKg} tier=${tierInfo?.tierId ?? 'none'} ` +
      `seasonal=${seasonalAdjustPct ?? 'none'} customerOverride=${customerId ?? 'none'}`,
    );

    return {
      rateCardId,
      rateCardCode: rc.code,
      weight,
      basePrice,
      tierApplied: tierInfo,
      finalPricePerKg,
      shippingAmount,
    };
  }

  // ----------------------------------------------------------------
  // SEASONAL RULES CRUD
  // ----------------------------------------------------------------

  /** Lay tat ca seasonal rule cua mot rate card */
  async getSeasonalRules(rateCardId: string) {
    await this.findOne(rateCardId);
    return this.seasonalRule.findMany({
      where: { rateCardId },
      orderBy: { startDate: 'asc' },
    });
  }

  /** Tao seasonal rule moi. Kiem tra ngay bat dau < ngay ket thuc. */
  async createSeasonalRule(rateCardId: string, dto: CreateSeasonalRuleDto) {
    await this.findOne(rateCardId);

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end) {
      throw new BadRequestException('startDate phai truoc endDate');
    }

    const rule = await this.seasonalRule.create({
      data: {
        rateCardId,
        name: dto.name,
        startDate: start,
        endDate: end,
        adjustPct: new Decimal(dto.adjustPct),
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Seasonal rule tao moi: ruleId=${rule.id} name="${rule.name}" rc=${rateCardId}`);
    return rule;
  }

  /** Cap nhat seasonal rule */
  async updateSeasonalRule(ruleId: string, dto: UpdateSeasonalRuleDto) {
    const rule = await this.seasonalRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException(`Seasonal rule ${ruleId} khong tim thay`);

    const newStart = dto.startDate ? new Date(dto.startDate) : rule.startDate;
    const newEnd = dto.endDate ? new Date(dto.endDate) : rule.endDate;
    if (newStart >= newEnd) {
      throw new BadRequestException('startDate phai truoc endDate');
    }

    const updated = await this.seasonalRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: newStart }),
        ...(dto.endDate !== undefined && { endDate: newEnd }),
        ...(dto.adjustPct !== undefined && { adjustPct: new Decimal(dto.adjustPct) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Seasonal rule cap nhat: ruleId=${ruleId}`);
    return updated;
  }

  /** Xoa seasonal rule */
  async removeSeasonalRule(ruleId: string) {
    const rule = await this.seasonalRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException(`Seasonal rule ${ruleId} khong tim thay`);

    await this.seasonalRule.delete({ where: { id: ruleId } });
    this.logger.log(`Seasonal rule da xoa: ruleId=${ruleId}`);
    return { deleted: true, ruleId };
  }

  // ----------------------------------------------------------------
  // CUSTOMER PRICE OVERRIDE CRUD
  // ----------------------------------------------------------------

  /** Lay override cua mot rate card (co the filter theo customerId) */
  async getCustomerOverrides(rateCardId: string, customerId?: string) {
    await this.findOne(rateCardId);
    return this.customerOverride.findMany({
      where: {
        rateCardId,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, code: true, fullName: true, tier: true } },
      },
    });
  }

  /** Tao customer price override. Constraint: moi KH chi co 1 override tren 1 rate card. */
  async createCustomerOverride(rateCardId: string, dto: CreateCustomerPriceOverrideDto) {
    await this.findOne(rateCardId);

    // Kiem tra khach hang ton tai
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException(`Khach hang ${dto.customerId} khong tim thay`);

    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (validTo && validFrom >= validTo) {
      throw new BadRequestException('validFrom phai truoc validTo');
    }

    const override = await this.customerOverride.create({
      data: {
        customerId: dto.customerId,
        rateCardId,
        discountPct: new Decimal(dto.discountPct),
        fixedPrice: dto.fixedPrice != null ? new Decimal(dto.fixedPrice) : null,
        note: dto.note,
        validFrom,
        validTo,
        isActive: dto.isActive ?? true,
      },
      include: {
        customer: { select: { id: true, code: true, fullName: true } },
      },
    });

    this.logger.log(
      `Customer override tao moi: overrideId=${override.id} customerId=${dto.customerId} rc=${rateCardId} discount=${dto.discountPct}%`,
    );
    return override;
  }

  /** Cap nhat customer price override */
  async updateCustomerOverride(overrideId: string, dto: UpdateCustomerPriceOverrideDto) {
    const override = await this.customerOverride.findUnique({ where: { id: overrideId } });
    if (!override) throw new NotFoundException(`Customer override ${overrideId} khong tim thay`);

    const newValidFrom = dto.validFrom ? new Date(dto.validFrom) : override.validFrom;
    const newValidTo = Object.prototype.hasOwnProperty.call(dto, 'validTo')
      ? (dto.validTo ? new Date(dto.validTo) : null)
      : override.validTo;

    if (newValidTo && newValidFrom >= newValidTo) {
      throw new BadRequestException('validFrom phai truoc validTo');
    }

    const updated = await this.customerOverride.update({
      where: { id: overrideId },
      data: {
        ...(dto.discountPct !== undefined && { discountPct: new Decimal(dto.discountPct) }),
        ...(Object.prototype.hasOwnProperty.call(dto, 'fixedPrice') && {
          fixedPrice: dto.fixedPrice != null ? new Decimal(dto.fixedPrice) : null,
        }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.validFrom !== undefined && { validFrom: newValidFrom }),
        ...(Object.prototype.hasOwnProperty.call(dto, 'validTo') && { validTo: newValidTo }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Customer override cap nhat: overrideId=${overrideId}`);
    return updated;
  }

  /** Xoa customer price override */
  async removeCustomerOverride(overrideId: string) {
    const override = await this.customerOverride.findUnique({ where: { id: overrideId } });
    if (!override) throw new NotFoundException(`Customer override ${overrideId} khong tim thay`);

    await this.customerOverride.delete({ where: { id: overrideId } });
    this.logger.log(`Customer override da xoa: overrideId=${overrideId}`);
    return { deleted: true, overrideId };
  }

  // ----------------------------------------------------------------
  // PRICE SIMULATION — chi tiet tung buoc tinh gia
  // ----------------------------------------------------------------

  /**
   * Simulate tinh gia chi tiet tung buoc:
   * Base → Volume Tier → Seasonal → Customer Override → Final.
   */
  async simulatePrice(rateCardId: string, dto: SimulatePriceDto): Promise<SimulatePriceResult> {
    const now = dto.date ? new Date(dto.date) : new Date();
    const { weight, customerId } = dto;

    const rc = await this.prismaAny.rateCard.findUnique({
      where: { id: rateCardId },
      include: {
        volumeTiers: { orderBy: { minWeight: 'asc' } },
        seasonalRules: {
          where: {
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now },
          },
        },
      },
    });
    if (!rc) throw new NotFoundException(`Rate Card ${rateCardId} khong tim thay`);
    if (!rc.isActive) throw new BadRequestException(`Rate Card ${rc.code} da bi vo hieu hoa`);
    if (weight < 0) throw new BadRequestException('Can nang phai >= 0');

    const basePrice = Number(rc.pricePerKG);
    const seasonalRules: any[] = rc.seasonalRules ?? [];

    // Fetch customer override if customerId supplied (needed for detailed output)
    let overrideRecord: any = null;
    if (customerId) {
      overrideRecord = await this.customerOverride.findFirst({
        where: {
          customerId,
          rateCardId,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
      });
    }

    const overrideInput = overrideRecord
      ? {
          discountPct: Number(overrideRecord.discountPct),
          fixedPrice: overrideRecord.fixedPrice ? Number(overrideRecord.fixedPrice) : null,
        }
      : null;

    // Apply all pricing layers via shared helper
    const { finalPricePerKg, tierInfo } = this.applyPricingLayers(
      basePrice,
      weight,
      rc.volumeTiers,
      seasonalRules,
      overrideInput,
    );

    // Build step-by-step breakdown and result metadata
    const breakdown: string[] = [];
    breakdown.push(`[1] Gia goc (pricePerKG): ${basePrice.toLocaleString('vi-VN')} VND/kg`);

    let volumeTierApplied: SimulatePriceResult['volumeTierApplied'] = null;
    // Reconstruct intermediate price-after-tier from tier data alone
    let priceAfterVolumeTier = basePrice;
    if (tierInfo) {
      priceAfterVolumeTier = tierInfo.fixedPrice != null
        ? tierInfo.fixedPrice
        : basePrice * (1 - tierInfo.discountPct / 100);
      volumeTierApplied = {
        tierId: tierInfo.tierId,
        label: tierInfo.label,
        discountPct: tierInfo.discountPct,
        fixedPrice: tierInfo.fixedPrice,
        priceAfterTier: priceAfterVolumeTier,
      };
      breakdown.push(
        `[2] Volume tier ap dung: ${volumeTierApplied.label} -> ${priceAfterVolumeTier.toLocaleString('vi-VN')} VND/kg`,
      );
    } else {
      breakdown.push(`[2] Volume tier: Khong co tier phu hop cho ${weight} kg`);
    }

    const seasonalRuleRaw = seasonalRules[0] ?? null;
    let seasonalRuleApplied: SimulatePriceResult['seasonalRuleApplied'] = null;
    let priceAfterSeasonal = priceAfterVolumeTier;
    if (seasonalRuleRaw) {
      const adjustPct = Number(seasonalRuleRaw.adjustPct);
      priceAfterSeasonal = priceAfterVolumeTier * (1 + adjustPct / 100);
      seasonalRuleApplied = {
        ruleId: seasonalRuleRaw.id,
        name: seasonalRuleRaw.name,
        adjustPct,
        priceAfterSeasonal,
      };
      breakdown.push(
        `[3] Seasonal rule "${seasonalRuleRaw.name}": ${adjustPct >= 0 ? '+' : ''}${adjustPct}% ` +
        `-> ${priceAfterSeasonal.toLocaleString('vi-VN')} VND/kg`,
      );
    } else {
      breakdown.push(`[3] Seasonal rule: Khong co quy tac mua vu nao dang hieu luc vao ${now.toLocaleDateString('vi-VN')}`);
    }

    let customerOverrideApplied: SimulatePriceResult['customerOverrideApplied'] = null;
    if (overrideRecord && overrideInput) {
      customerOverrideApplied = {
        overrideId: overrideRecord.id,
        customerId: customerId!,
        discountPct: overrideInput.discountPct,
        fixedPrice: overrideInput.fixedPrice,
        priceAfterOverride: finalPricePerKg,
      };
      if (overrideInput.fixedPrice != null) {
        breakdown.push(
          `[4] Customer override: Gia co dinh rieng = ${finalPricePerKg.toLocaleString('vi-VN')} VND/kg`,
        );
      } else {
        breakdown.push(
          `[4] Customer override: Giam them ${overrideInput.discountPct}% -> ${finalPricePerKg.toLocaleString('vi-VN')} VND/kg`,
        );
      }
    } else if (customerId) {
      breakdown.push(`[4] Customer override: Khong co override rieng cho KH ${customerId}`);
    } else {
      breakdown.push('[4] Customer override: Khong co customerId, bo qua buoc nay');
    }

    const minCharge = rc.minChargeAmount ? Number(rc.minChargeAmount) : 0;
    const rawAmount = finalPricePerKg * weight;
    const shippingAmount = Math.round(Math.max(rawAmount, minCharge));

    breakdown.push(
      `[5] Gia cuoi: ${finalPricePerKg.toLocaleString('vi-VN')} VND/kg x ${weight} kg = ${shippingAmount.toLocaleString('vi-VN')} VND` +
      (minCharge > 0 && rawAmount < minCharge
        ? ` (ap dung cuoc toi thieu: ${minCharge.toLocaleString('vi-VN')} VND)`
        : ''),
    );

    return {
      rateCardId,
      rateCardCode: rc.code,
      weight,
      basePrice,
      volumeTierApplied,
      priceAfterVolumeTier,
      seasonalRuleApplied,
      priceAfterSeasonal,
      customerOverrideApplied,
      finalPricePerKg,
      shippingAmount,
      breakdown,
    };
  }

  // ----------------------------------------------------------------
  // LOOKUP (giu nguyen logic cu, bo sung volume tier)
  // ----------------------------------------------------------------

  /**
   * Tim Rate Card phu hop nhat va tinh cuoc van chuyen.
   * Logic: CBM vs KG -> lay gia lon hon (chargeable weight).
   * Sau do ap dung volume tier, seasonal rule va customer override (theo thu tu uu tien).
   */
  async lookup(dto: LookupRateCardDto): Promise<{
    rateCard: any;
    chargeableWeight: number;
    shippingAmount: number;
    surchargeAmount: number;
    surcharges: any[];
    discountPercent: number;
    discountAmount: number;
    totalShipping: number;
    volumeTierApplied: TierInfo | null;
    seasonalRuleApplied: { name: string; adjustPct: number } | null;
    customerOverrideApplied: { discountPct: number; fixedPrice: number | null } | null;
  } | null> {
    const now = new Date();

    const rateCard = await this.prismaAny.rateCard.findFirst({
      where: {
        origin: dto.origin,
        destination: dto.destination,
        transportMode: dto.transportMode,
        serviceType: dto.serviceType ?? ServiceType.VCT,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      orderBy: { validFrom: 'desc' },
      include: {
        surcharges: { where: { isOptional: false }, orderBy: { sortOrder: 'asc' } },
        discounts: true,
        volumeTiers: { orderBy: { minWeight: 'asc' } },
        seasonalRules: {
          where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
          take: 1,
        },
      },
    });

    if (!rateCard) return null;

    const cbm = dto.cbm ?? 0;
    const kg = dto.kg ?? 0;
    const ratio = CBM_TO_KG_RATIO[dto.transportMode] ?? 6000;

    // Chargeable weight: CBM quy doi sang KG, lay gia lon hon
    const cbmAsKg = cbm * ratio;
    const chargeableWeight = Math.max(cbmAsKg, kg);
    const chargeableCBM = chargeableWeight / ratio;

    const pricePerCBM = Number(rateCard.pricePerCBM);
    const pricePerKG = Number(rateCard.pricePerKG);
    const minCharge = rateCard.minChargeAmount ? Number(rateCard.minChargeAmount) : 0;

    // Fetch customer override if customerId supplied
    let lookupOverrideRaw: { discountPct: number; fixedPrice: number | null } | null = null;
    if (dto.customerId) {
      const override = await this.customerOverride.findFirst({
        where: {
          customerId: dto.customerId,
          rateCardId: rateCard.id,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
      });
      if (override) {
        lookupOverrideRaw = {
          discountPct: Number(override.discountPct),
          fixedPrice: override.fixedPrice ? Number(override.fixedPrice) : null,
        };
      }
    }

    // Apply all pricing layers via shared helper (KG dimension is authoritative)
    const { finalPricePerKg: effectivePricePerKG, tierInfo: volumeTierApplied, seasonalAdjustPct } =
      this.applyPricingLayers(
        pricePerKG,
        chargeableWeight,
        rateCard.volumeTiers,
        rateCard.seasonalRules ?? [],
        lookupOverrideRaw,
      );

    // Derive CBM price by applying the same scaling factors used for KG
    // (ratio preserves CBM / KG equivalence after all layer adjustments)
    const effectivePricePerCBM = effectivePricePerKG * ratio;

    const seasonalRuleRaw = (rateCard.seasonalRules ?? [])[0] ?? null;
    const seasonalRuleApplied: { name: string; adjustPct: number } | null = seasonalAdjustPct !== null && seasonalRuleRaw
      ? { name: seasonalRuleRaw.name, adjustPct: seasonalAdjustPct }
      : null;

    const customerOverrideApplied: { discountPct: number; fixedPrice: number | null } | null =
      lookupOverrideRaw;

    // Tinh cuoc chinh (lay max giua CBM va KG, co tinh minCharge)
    const rawShipping = Math.max(
      chargeableCBM * effectivePricePerCBM,
      chargeableWeight * effectivePricePerKG,
      minCharge,
    );
    const shippingAmount = Math.round(rawShipping);

    // Phu phi bat buoc
    let surchargeAmount = 0;
    const surchargesDetail = rateCard.surcharges.map((s: any) => {
      const amt = s.isPercent
        ? Math.round(shippingAmount * (Number(s.percent ?? 0) / 100))
        : Number(s.amount);
      surchargeAmount += amt;
      return { name: s.name, amount: amt };
    });

    // Chiet khau theo tier khach hang (theo bang discount, khac voi customer override)
    let discountPercent = 0;
    if (dto.customerTier && !customerOverrideApplied) {
      // Chi ap dung tier discount khi chua co customer override
      const discount = rateCard.discounts.find((d: any) => d.customerTier === dto.customerTier);
      discountPercent = discount ? Number(discount.discountPercent) : 0;
    }
    const discountAmount = Math.round((shippingAmount + surchargeAmount) * (discountPercent / 100));
    const totalShipping = shippingAmount + surchargeAmount - discountAmount;

    return {
      rateCard,
      chargeableWeight: chargeableCBM,
      shippingAmount,
      surchargeAmount,
      surcharges: surchargesDetail,
      discountPercent,
      discountAmount,
      totalShipping,
      volumeTierApplied,
      seasonalRuleApplied,
      customerOverrideApplied,
    };
  }
}
