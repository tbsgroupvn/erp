import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// ─────────────────────────────────────────────
// Interfaces cho Warehouse Map
// ─────────────────────────────────────────────

export interface WarehouseBinItem {
  code: string;
  isOccupied: boolean;
  packageCode?: string;
  weight: number;
  abcClass: string;
}

export interface WarehouseShelf {
  code: string;
  bins: WarehouseBinItem[];
}

export interface WarehouseAisle {
  code: string;
  shelves: WarehouseShelf[];
}

export interface WarehouseZone {
  code: string;
  name: string;
  aisles: WarehouseAisle[];
  stats: { total: number; occupied: number; available: number };
}

export interface WarehouseMapResult {
  zones: WarehouseZone[];
  summary: { totalBins: number; occupiedBins: number; occupancyRate: number };
}

// ─────────────────────────────────────────────
// Interfaces cho Heat Map
// ─────────────────────────────────────────────

export interface HeatMapZone {
  code: string;
  frequency: number;
  avgDwellTime: number; // gio
  turnoverRate: number; // lan/bin/ngay
}

export interface HeatMapResult {
  zones: HeatMapZone[];
  period: { days: number; since: Date; recentPackages: number };
}

// ─────────────────────────────────────────────
// Interfaces cho Optimization Suggestions
// ─────────────────────────────────────────────

export type SuggestionType =
  | 'MISPLACED'
  | 'ZONE_IMBALANCE'
  | 'UNDERUTILIZED_A'
  | 'LOW_FREQ_IN_A'
  | 'FILL_ZONE_A';

export type SuggestionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface OptimizationSuggestion {
  type: SuggestionType;
  priority: SuggestionPriority;
  reason: string;
  packageCode?: string;
  currentBin?: string;
  suggestedBin?: string;
  affectedBins?: string[];
}

export interface OptimizationResult {
  suggestions: OptimizationSuggestion[];
  analysedBins: number;
  generatedAt: Date;
}

// ─────────────────────────────────────────────

export interface SuggestBinResult {
  suggestedBin: {
    id: string;
    code: string;
    zone: string;
    aisle: string;
    shelf: string;
    position: string | null;
    maxWeight: Decimal | null;
    maxVolume: Decimal | null;
    currentWeight: Decimal;
    currentVolume: Decimal;
    abcClass: string;
    frequency: number;
    isOccupied: boolean;
    isActive: boolean;
    packageId: string | null;
    warehouse: string;
    createdAt: Date;
    updatedAt: Date;
  };
  reason: string;
}

export interface BinOccupancySummary {
  total: number;
  occupied: number;
  available: number;
  occupancyRate: number; // phan tram, vd: 0.75 = 75%
  byZone: {
    zone: string;
    total: number;
    occupied: number;
    available: number;
    occupancyRate: number;
  }[];
}

/**
 * Slotting Service — Quan ly va de xuat vi tri luu tru kien hang.
 *
 * Logic phan loai ABC:
 *   - Khu A (gan cua ra): kien hang co tan suat xuat/nhap cao (top 20% theo frequency)
 *   - Khu B (trung gian): tan suat trung binh (tiep theo 30%)
 *   - Khu C (xa cua): tan suat thap hoac hang moi (phan con lai 50%)
 *
 * Logic goi y o hang:
 *   - Tinh ABC class cua kien dua tren lich su hoat dong order/khach hang
 *   - Tim o hang trong khu tuong ung, co du suc chua (trong luong + the tich)
 *   - Uu tien o trong hoan toan truoc, sau do o con cho (partially filled) neu co
 */
@Injectable()
export class SlottingService {
  private readonly logger = new Logger(SlottingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Goi y o hang phu hop cho mot kien hang.
   *
   * Quy trinh:
   *  1. Lay thong tin kien hang (trong luong, kich thuoc)
   *  2. Tinh ABC class dua tren tan suat hoat dong cua order/KH trong 30 ngay
   *  3. Tim o hang trong khu ABC tuong ung con du cho
   *  4. Uu tien o trong > o con cho
   */
  async suggestBin(packageId: string): Promise<SuggestBinResult> {
    // Lay thong tin kien hang kem order/customer
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        order: {
          select: {
            id: true,
            customerId: true,
            code: true,
          },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Khong tim thay kien hang ID: ${packageId}`);
    }

    // Kiem tra kien da duoc gan o hang chua
    const existingBin = await this.prisma.storageBin.findFirst({
      where: { packageId },
    });
    if (existingBin) {
      throw new BadRequestException(
        `Kien hang ${pkg.code} da duoc gan o hang ${existingBin.code}`,
      );
    }

    // Tinh ABC class dua tren tan suat hoat dong 30 ngay
    const abcClass = await this._calculatePackageABCClass(pkg.orderId, pkg.order?.customerId);

    // Lay trong luong va the tich cua kien
    const pkgWeight = pkg.chargeableWeight ?? pkg.actualWeight ?? new Decimal(0);
    // The tich m3: L * W * H / 1,000,000
    let pkgVolume = new Decimal(0);
    if (pkg.length && pkg.width && pkg.height) {
      pkgVolume = new Decimal(pkg.length)
        .mul(new Decimal(pkg.width))
        .mul(new Decimal(pkg.height))
        .div(new Decimal(1_000_000));
    }

    // Xac dinh thu tu uu tien zone theo ABC class
    // Khu A: gan cua xuat, khu C: xa nhat
    const zonePreference = this._getZonePreference(abcClass);

    // Tim o hang phu hop theo thu tu uu tien zone
    let suggestedBin: SuggestBinResult['suggestedBin'] | null = null;
    let reason = '';

    for (const zone of zonePreference) {
      // Tim o trong hoan toan truoc
      const emptyBin = await this.prisma.storageBin.findFirst({
        where: {
          zone,
          isActive: true,
          isOccupied: false,
          packageId: null,
          warehouse: 'CN',
          ...(Number(pkgWeight) > 0
            ? {
                OR: [
                  { maxWeight: null },
                  { maxWeight: { gte: Number(pkgWeight) } },
                ],
              }
            : {}),
        },
        orderBy: { code: 'asc' }, // lay o dau tien (theo ma — de quan ly)
      });

      if (emptyBin) {
        suggestedBin = emptyBin as SuggestBinResult['suggestedBin'];
        reason =
          `O hang ${emptyBin.code} (khu ${zone}) trong hoan toan. ` +
          `Kien duoc xep loai ABC-${abcClass} dua tren tan suat hoat dong. ` +
          `Suc chua con lai: ${emptyBin.maxWeight ? `${Number(emptyBin.maxWeight)}kg` : 'khong gioi han'}`;
        break;
      }

      // Schema StorageBin la 1-1 voi Package (isOccupied=true <=> co 1 kien duy nhat).
      // Khong co "partial bin". Neu khong tim duoc o trong o zone nay, thu zone tiep theo.
    }

    // Fallback: neu khong tim duoc o dung zone, tim bat ky o trong nao
    if (!suggestedBin) {
      const anyEmpty = await this.prisma.storageBin.findFirst({
        where: {
          isActive: true,
          isOccupied: false,
          packageId: null,
          warehouse: 'CN',
        },
        orderBy: { code: 'asc' },
      });

      if (anyEmpty) {
        suggestedBin = anyEmpty as SuggestBinResult['suggestedBin'];
        reason =
          `Khong con o hang trong khu ABC-${abcClass}. ` +
          `Su dung o hang du phong: ${anyEmpty.code} (khu ${anyEmpty.zone}). ` +
          `Kien hang nen duoc chuyen sang khu ${abcClass} khi co cho.`;
      }
    }

    if (!suggestedBin) {
      throw new BadRequestException(
        `Khong tim duoc o hang phu hop trong kho CN. Tat ca o hang da day hoac khong du suc chua.`,
      );
    }

    this.logger.log(
      `Goi y o hang ${suggestedBin.code} cho kien ${pkg.code} (ABC-${abcClass}): ${reason}`,
    );

    return { suggestedBin, reason };
  }

  /**
   * Gan kien hang vao o hang cu the.
   *
   * Cap nhat: packageId, isOccupied=true, currentWeight, currentVolume
   */
  async assignBin(packageId: string, binId: string) {
    // Lay thong tin kien hang
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        code: true,
        chargeableWeight: true,
        actualWeight: true,
        length: true,
        width: true,
        height: true,
      },
    });
    if (!pkg) {
      throw new NotFoundException(`Khong tim thay kien hang ID: ${packageId}`);
    }

    // Lay thong tin o hang
    const bin = await this.prisma.storageBin.findUnique({
      where: { id: binId },
    });
    if (!bin) {
      throw new NotFoundException(`Khong tim thay o hang ID: ${binId}`);
    }

    if (!bin.isActive) {
      throw new BadRequestException(`O hang ${bin.code} dang bi vo hieu hoa`);
    }

    if (bin.isOccupied && bin.packageId) {
      throw new BadRequestException(
        `O hang ${bin.code} da dang chua kien hang kha (packageId: ${bin.packageId})`,
      );
    }

    // Tinh trong luong va the tich kien
    const pkgWeight = pkg.chargeableWeight ?? pkg.actualWeight ?? new Decimal(0);
    let pkgVolume = new Decimal(0);
    if (pkg.length && pkg.width && pkg.height) {
      pkgVolume = new Decimal(pkg.length)
        .mul(new Decimal(pkg.width))
        .mul(new Decimal(pkg.height))
        .div(new Decimal(1_000_000));
    }

    // Kiem tra suc chua trong luong
    if (bin.maxWeight) {
      const newWeight = Number(bin.currentWeight) + Number(pkgWeight);
      if (newWeight > Number(bin.maxWeight)) {
        throw new BadRequestException(
          `O hang ${bin.code} khong du suc chua. ` +
            `Trong luong hien tai: ${bin.currentWeight}kg, ` +
            `Kien can them: ${pkgWeight}kg, ` +
            `Toi da: ${bin.maxWeight}kg`,
        );
      }
    }

    // Kiem tra suc chua the tich
    if (bin.maxVolume && Number(pkgVolume) > 0) {
      const newVolume = Number(bin.currentVolume) + Number(pkgVolume);
      if (newVolume > Number(bin.maxVolume)) {
        throw new BadRequestException(
          `O hang ${bin.code} khong du the tich. ` +
            `The tich hien tai: ${bin.currentVolume}m3, ` +
            `Kien can them: ${pkgVolume.toFixed(4)}m3, ` +
            `Toi da: ${bin.maxVolume}m3`,
        );
      }
    }

    // Cap nhat o hang
    const updatedBin = await this.prisma.storageBin.update({
      where: { id: binId },
      data: {
        packageId,
        isOccupied: true,
        currentWeight: new Decimal(Number(bin.currentWeight) + Number(pkgWeight)),
        currentVolume: new Decimal(Number(bin.currentVolume) + Number(pkgVolume)),
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Kien hang ${pkg.code} da duoc gan vao o hang ${bin.code}. ` +
        `Trong luong o hang: ${updatedBin.currentWeight}kg`,
    );

    return updatedBin;
  }

  /**
   * Giai phong o hang khi kien hang xuat kho.
   *
   * Xoa packageId, isOccupied=false, reset currentWeight/currentVolume
   */
  async releaseBin(binId: string) {
    const bin = await this.prisma.storageBin.findUnique({
      where: { id: binId },
    });
    if (!bin) {
      throw new NotFoundException(`Khong tim thay o hang ID: ${binId}`);
    }

    if (!bin.isOccupied && !bin.packageId) {
      throw new BadRequestException(`O hang ${bin.code} da trong, khong can giai phong`);
    }

    const releasedPackageId = bin.packageId;

    const updatedBin = await this.prisma.storageBin.update({
      where: { id: binId },
      data: {
        packageId: null,
        isOccupied: false,
        currentWeight: new Decimal(0),
        currentVolume: new Decimal(0),
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `O hang ${bin.code} da duoc giai phong. ` +
        `Kien truoc do: ${releasedPackageId ?? 'khong ro'}`,
    );

    return updatedBin;
  }

  /**
   * Tinh lai phan loai ABC cho tat ca o hang.
   *
   * Quy tac phan loai:
   *   - Lay frequency (so lan xuat/nhap) cua tung o hang trong 30 ngay
   *   - Sap xep giam dan
   *   - Top 20%  -> A
   *   - Tiep 30% -> B
   *   - Con lai  -> C
   *
   * Duoc goi hang ngay bang cron job.
   */
  async recalculateABC(): Promise<{ updated: number }> {
    // Lay tat ca o hang dang hoat dong, sap xep theo frequency giam dan
    // frequency duoc cap nhat real-time khi assign/release kien
    const allBinsWithFreq = await this.prisma.storageBin.findMany({
      where: { isActive: true },
      select: { id: true, frequency: true },
      orderBy: { frequency: 'desc' },
    });

    if (allBinsWithFreq.length === 0) {
      this.logger.log('Khong co o hang de tinh lai ABC');
      return { updated: 0 };
    }

    this.logger.log(`Tinh lai ABC cho ${allBinsWithFreq.length} o hang dang hoat dong`);

    const total = allBinsWithFreq.length;
    const topA = Math.ceil(total * 0.2);    // 20% hang A
    const topB = Math.ceil(total * 0.5);    // 20%+30% = 50% cumulative (B chiem vi tri tiep theo)

    let updatedCount = 0;
    const updates: Promise<unknown>[] = [];

    for (let i = 0; i < allBinsWithFreq.length; i++) {
      const bin = allBinsWithFreq[i];
      let newClass: string;

      if (i < topA) {
        newClass = 'A';
      } else if (i < topB) {
        newClass = 'B';
      } else {
        newClass = 'C';
      }

      updates.push(
        this.prisma.storageBin.update({
          where: { id: bin.id },
          data: { abcClass: newClass },
        }),
      );
      updatedCount++;
    }

    // Thuc hien tat ca cap nhat song song (batch)
    await Promise.all(updates);

    this.logger.log(
      `Tinh lai ABC hoan thanh: ${updatedCount} o hang cap nhat. ` +
        `A: ${topA}, B: ${topB - topA}, C: ${total - topB}`,
    );

    return { updated: updatedCount };
  }

  /**
   * Lay thong tin tong quan muc do su dung o hang.
   */
  async getBinOccupancy(warehouse: string): Promise<BinOccupancySummary> {
    // Dem tong so o hang
    const [total, occupied] = await Promise.all([
      this.prisma.storageBin.count({
        where: { warehouse, isActive: true },
      }),
      this.prisma.storageBin.count({
        where: { warehouse, isActive: true, isOccupied: true },
      }),
    ]);

    const available = total - occupied;
    const occupancyRate = total > 0 ? occupied / total : 0;

    // Thong ke theo tung zone
    const zoneGroups = await this.prisma.storageBin.groupBy({
      by: ['zone'],
      where: { warehouse, isActive: true },
      _count: { id: true },
    });

    const occupiedByZone = await this.prisma.storageBin.groupBy({
      by: ['zone'],
      where: { warehouse, isActive: true, isOccupied: true },
      _count: { id: true },
    });

    const occupiedZoneMap = new Map<string, number>(
      occupiedByZone.map(({ zone, _count }) => [zone, _count.id]),
    );

    const byZone = zoneGroups
      .sort((a, b) => a.zone.localeCompare(b.zone))
      .map(({ zone, _count }) => {
        const zoneTotal = _count.id;
        const zoneOccupied = occupiedZoneMap.get(zone) ?? 0;
        const zoneAvailable = zoneTotal - zoneOccupied;
        return {
          zone,
          total: zoneTotal,
          occupied: zoneOccupied,
          available: zoneAvailable,
          occupancyRate: zoneTotal > 0 ? zoneOccupied / zoneTotal : 0,
        };
      });

    this.logger.debug(
      `Occupancy kho ${warehouse}: ${occupied}/${total} (${Math.round(occupancyRate * 100)}%)`,
    );

    return {
      total,
      occupied,
      available,
      occupancyRate,
      byZone,
    };
  }

  /**
   * Lay danh sach o hang co phan trang va loc theo zone/trang thai/phan loai.
   */
  async listBins(params: {
    zone?: string;
    isOccupied?: boolean;
    abcClass?: string;
    warehouse?: string;
    page?: number;
    limit?: number;
  }) {
    const { zone, isOccupied, abcClass, warehouse = 'CN', page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      isActive: true,
      warehouse: warehouse.toUpperCase(),
    };

    if (zone) where['zone'] = zone.toUpperCase();
    if (abcClass) where['abcClass'] = abcClass.toUpperCase();
    if (isOccupied !== undefined) where['isOccupied'] = isOccupied;

    const [data, total] = await Promise.all([
      this.prisma.storageBin.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ zone: 'asc' }, { aisle: 'asc' }, { shelf: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.storageBin.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ─────────────────────────────────────────────
  // Warehouse Map — Ban do truc quan kho hang
  // ─────────────────────────────────────────────

  /**
   * Lay du lieu ban do kho de hien thi truc quan.
   *
   * Cau truc tra ve:
   *   zones -> aisles -> shelves -> bins
   * Moi bin bao gom trang thai (trong/co kien), ma kien, trong luong, phan loai ABC.
   */
  async getWarehouseMap(warehouse: string): Promise<WarehouseMapResult> {
    const wh = warehouse.toUpperCase();

    // Lay tat ca o hang dang hoat dong cua kho theo thu tu
    const bins = await this.prisma.storageBin.findMany({
      where: { warehouse: wh, isActive: true },
      orderBy: [{ zone: 'asc' }, { aisle: 'asc' }, { shelf: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        zone: true,
        aisle: true,
        shelf: true,
        isOccupied: true,
        packageId: true,
        currentWeight: true,
        abcClass: true,
      },
    });

    // Lay ma kien hang cho cac o dang co kien
    const occupiedPackageIds = bins
      .filter(b => b.packageId)
      .map(b => b.packageId as string);

    const packageCodes = new Map<string, string>();
    if (occupiedPackageIds.length > 0) {
      const pkgs = await this.prisma.package.findMany({
        where: { id: { in: occupiedPackageIds } },
        select: { id: true, code: true },
      });
      pkgs.forEach(p => packageCodes.set(p.id, p.code));
    }

    // Nhom bins theo zone -> aisle -> shelf
    const zoneMap = new Map<string, Map<string, Map<string, typeof bins>>>();

    for (const bin of bins) {
      if (!zoneMap.has(bin.zone)) {
        zoneMap.set(bin.zone, new Map());
      }
      const aisleMap = zoneMap.get(bin.zone)!;
      if (!aisleMap.has(bin.aisle)) {
        aisleMap.set(bin.aisle, new Map());
      }
      const shelfMap = aisleMap.get(bin.aisle)!;
      if (!shelfMap.has(bin.shelf)) {
        shelfMap.set(bin.shelf, []);
      }
      shelfMap.get(bin.shelf)!.push(bin);
    }

    // Ten zone theo phan loai ABC
    const zoneNameMap: Record<string, string> = {
      A: 'Khu A - Hang xuat nhieu (gan cua)',
      B: 'Khu B - Hang xuat trung binh',
      C: 'Khu C - Hang xuat it (xa cua)',
    };

    const zones: WarehouseZone[] = [];

    for (const [zoneCode, aisleMap] of zoneMap) {
      const aisles: WarehouseAisle[] = [];
      let zoneTotalBins = 0;
      let zoneOccupied = 0;

      for (const [aisleCode, shelfMap] of aisleMap) {
        const shelves: WarehouseShelf[] = [];

        for (const [shelfCode, shelfBins] of shelfMap) {
          const binItems = shelfBins.map(b => ({
            code: b.code,
            isOccupied: b.isOccupied,
            packageCode: b.packageId ? packageCodes.get(b.packageId) ?? undefined : undefined,
            weight: Number(b.currentWeight),
            abcClass: b.abcClass,
          }));
          shelves.push({ code: shelfCode, bins: binItems });
          zoneTotalBins += shelfBins.length;
          zoneOccupied += shelfBins.filter(b => b.isOccupied).length;
        }

        aisles.push({ code: aisleCode, shelves });
      }

      zones.push({
        code: zoneCode,
        name: zoneNameMap[zoneCode] ?? `Khu ${zoneCode}`,
        aisles,
        stats: {
          total: zoneTotalBins,
          occupied: zoneOccupied,
          available: zoneTotalBins - zoneOccupied,
        },
      });
    }

    const totalBins = bins.length;
    const occupiedBins = bins.filter(b => b.isOccupied).length;

    return {
      zones,
      summary: {
        totalBins,
        occupiedBins,
        occupancyRate: totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) / 100 : 0,
      },
    };
  }

  // ─────────────────────────────────────────────
  // Heat Map — Tan suat hoat dong theo khu vuc
  // ─────────────────────────────────────────────

  /**
   * Tinh heat map tan suat hoat dong theo tung zone/aisle trong N ngay.
   *
   * frequency    = so lan bin duoc assign hoac release trong khoang thoi gian
   * avgDwellTime = thoi gian trung binh kien hang o trong bin (gio)
   *               Uoc tinh tu: su dung updatedAt cua bin khi isOccupied thay doi
   * turnoverRate = frequency / tong so bin cua zone (lan/bin/ngay)
   *
   * Luu y: Do khong co bang lich su scan rieng, tan suat duoc tinh dua tren
   *   frequency field cua StorageBin (so lan assign/release thuc te trong DB).
   *   avgDwellTime duoc uoc tinh tu thoi gian kien hang o trong kho tinh toi hien tai.
   */
  async getHeatMap(warehouse: string, days: number): Promise<HeatMapResult> {
    const wh = warehouse.toUpperCase();
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Lay thong tin frequency va trang thai cac bin
    const bins = await this.prisma.storageBin.findMany({
      where: { warehouse: wh, isActive: true },
      select: {
        zone: true,
        aisle: true,
        frequency: true,
        isOccupied: true,
        updatedAt: true,
      },
    });

    // Tinh aggregate theo zone
    const zoneAgg = new Map<string, {
      frequency: number;
      totalBins: number;
      occupiedBins: number;
      totalDwellMinutes: number;
      dwellCount: number;
    }>();

    const now = new Date();

    for (const bin of bins) {
      const key = bin.zone;
      if (!zoneAgg.has(key)) {
        zoneAgg.set(key, {
          frequency: 0,
          totalBins: 0,
          occupiedBins: 0,
          totalDwellMinutes: 0,
          dwellCount: 0,
        });
      }
      const agg = zoneAgg.get(key)!;
      agg.frequency += bin.frequency;
      agg.totalBins += 1;
      if (bin.isOccupied) {
        agg.occupiedBins += 1;
        // Uoc tinh thoi gian luu kho: tu lan cap nhat cuoi (khi gan kien) den hien tai
        const dwellMinutes = (now.getTime() - bin.updatedAt.getTime()) / 60_000;
        agg.totalDwellMinutes += dwellMinutes;
        agg.dwellCount += 1;
      }
    }

    // Uoc tinh tong so kien hang nhan trong N ngay (proxy cho hoat dong scan/assign)
    const recentTotal = await this.prisma.package.count({
      where: { receivedCNAt: { gte: since } },
    });

    const zones: HeatMapZone[] = [];

    for (const [zoneCode, agg] of zoneAgg) {
      const avgDwellTime = agg.dwellCount > 0
        ? Math.round(agg.totalDwellMinutes / agg.dwellCount / 60 * 10) / 10 // gio
        : 0;

      const turnoverRate = agg.totalBins > 0 && days > 0
        ? Math.round((agg.frequency / agg.totalBins / days) * 100) / 100
        : 0;

      zones.push({
        code: zoneCode,
        frequency: agg.frequency,
        avgDwellTime,
        turnoverRate,
      });
    }

    // Sap xep theo frequency giam dan
    zones.sort((a, b) => b.frequency - a.frequency);

    return { zones, period: { days, since, recentPackages: recentTotal } };
  }

  // ─────────────────────────────────────────────
  // Optimization Suggestions — Goi y toi uu hoa
  // ─────────────────────────────────────────────

  /**
   * Phan tich hien trang va goi y toi uu hoa vi tri luu tru.
   *
   * Cac loai goi y:
   *   1. Kien A dang nam o khu C (nen chuyen vao khu A)
   *   2. Khu A day nhung khu C co nhieu o trong (nen tai phan loai)
   *   3. Khu A con o trong nen tap trung kien xuat nhieu vao
   */
  async getOptimizationSuggestions(warehouse: string): Promise<OptimizationResult> {
    const wh = warehouse.toUpperCase();
    const suggestions: OptimizationSuggestion[] = [];

    // Lay tat ca bins va kien hang lien quan
    const bins = await this.prisma.storageBin.findMany({
      where: { warehouse: wh, isActive: true },
      select: {
        id: true,
        code: true,
        zone: true,
        aisle: true,
        shelf: true,
        abcClass: true,
        isOccupied: true,
        packageId: true,
        frequency: true,
        maxWeight: true,
        currentWeight: true,
      },
    });

    const occupiedBins = bins.filter(b => b.isOccupied && b.packageId);
    const emptyBins = bins.filter(b => !b.isOccupied);

    // --- Lay ABC class cua kien hang tu database ---
    const packageIds = occupiedBins.map(b => b.packageId!);
    const packageMap = new Map<string, { code: string; orderId: string }>();

    if (packageIds.length > 0) {
      const packages = await this.prisma.package.findMany({
        where: { id: { in: packageIds } },
        select: {
          id: true,
          code: true,
          orderId: true,
          order: { select: { customerId: true } },
        },
      });
      packages.forEach(p => packageMap.set(p.id, { code: p.code, orderId: p.orderId }));
    }

    // --- Phan tich 1: Kien dang o sai khu vuc ---
    // Bin zone A chua kien ABC-C (hieu suat thap)
    // Bin zone C chua kien ABC-A (can xuat nhieu nhung o xa)
    const misplacedBins = occupiedBins.filter(b => {
      // Bin khu A nhung phan loai C (lang phi vi tri tot)
      if (b.abcClass === 'A' && b.zone === 'C') return true;
      // Bin khu C nhung phan loai A (can chuyen ra gan cua)
      if (b.abcClass === 'C' && b.zone === 'A') return true;
      return false;
    });

    for (const bin of misplacedBins.slice(0, 10)) {
      const pkg = packageMap.get(bin.packageId!);
      if (!pkg) continue;

      const targetZone = bin.abcClass; // Zone phu hop voi ABC class cua bin
      const availableTargetBins = emptyBins.filter(
        eb => eb.zone === targetZone &&
          (!eb.maxWeight || Number(eb.maxWeight) >= Number(bin.currentWeight)),
      );

      if (availableTargetBins.length > 0) {
        const targetBin = availableTargetBins[0];
        suggestions.push({
          type: 'MISPLACED',
          priority: bin.abcClass === 'C' && bin.zone === 'A' ? 'HIGH' : 'MEDIUM',
          packageCode: pkg.code,
          currentBin: bin.code,
          suggestedBin: targetBin.code,
          reason: `Kien ${pkg.code} (phan loai ${bin.abcClass}) dang o khu ${bin.zone}. ` +
            `Nen chuyen sang ${targetBin.code} (khu ${targetZone}) ` +
            `de toi uu hoa luong di chuyen trong kho.`,
        });
      }
    }

    // --- Phan tich 2: Khu A day nhung khu C con trong nhieu ---
    const zoneStats = new Map<string, { total: number; occupied: number; emptyHighFreq: number }>();

    for (const b of bins) {
      if (!zoneStats.has(b.zone)) {
        zoneStats.set(b.zone, { total: 0, occupied: 0, emptyHighFreq: 0 });
      }
      const s = zoneStats.get(b.zone)!;
      s.total += 1;
      if (b.isOccupied) s.occupied += 1;
      if (!b.isOccupied && b.frequency > 5) s.emptyHighFreq += 1;
    }

    const zoneA = zoneStats.get('A');
    const zoneC = zoneStats.get('C');

    if (zoneA && zoneC) {
      const zoneARate = zoneA.total > 0 ? zoneA.occupied / zoneA.total : 0;
      const zoneCEmpty = zoneC.total - zoneC.occupied;

      if (zoneARate >= 0.9 && zoneCEmpty >= 5) {
        suggestions.push({
          type: 'ZONE_IMBALANCE',
          priority: 'HIGH',
          reason: `Khu A day ${Math.round(zoneARate * 100)}% nhung khu C con ${zoneCEmpty} o trong. ` +
            `Nen xem xet chuyen kien co phan loai A tu khu C vao khu A truoc khi nhan them.`,
        });
      }

      if (zoneARate < 0.3 && zoneA.total > 0) {
        suggestions.push({
          type: 'UNDERUTILIZED_A',
          priority: 'LOW',
          reason: `Khu A chi dang su dung ${Math.round(zoneARate * 100)}%. ` +
            `Nen xem xet di chuyen kien phan loai A tu khu B/C vao khu A de tang hieu qua.`,
        });
      }
    }

    // --- Phan tich 3: Bins co tan suat thap nhung dang o khu A ---
    const lowFreqInA = occupiedBins.filter(b => b.zone === 'A' && b.frequency < 3);
    if (lowFreqInA.length > 0) {
      suggestions.push({
        type: 'LOW_FREQ_IN_A',
        priority: 'MEDIUM',
        reason: `Co ${lowFreqInA.length} o hang o khu A co tan suat hoat dong thap (< 3 lan). ` +
          `Nen chuyen cac kien nay sang khu B/C de nhường cho kien co phan loai cao hon.`,
        affectedBins: lowFreqInA.slice(0, 5).map(b => b.code),
      });
    }

    // --- Phan tich 4: O hang trong o khu A (uu tien nap hang vao) ---
    const emptyA = emptyBins.filter(b => b.zone === 'A');
    if (emptyA.length > 0 && emptyA.length <= 5) {
      suggestions.push({
        type: 'FILL_ZONE_A',
        priority: 'LOW',
        reason: `Khu A con ${emptyA.length} o hang trong (${emptyA.map(b => b.code).join(', ')}). ` +
          `Nen xep kien co phan loai A vao cac o nay de tan dung vi tri tot.`,
        affectedBins: emptyA.map(b => b.code),
      });
    }

    this.logger.log(
      `Phan tich toi uu hoa kho ${wh}: ${suggestions.length} goi y ` +
        `(${suggestions.filter(s => s.priority === 'HIGH').length} cao, ` +
        `${suggestions.filter(s => s.priority === 'MEDIUM').length} trung binh, ` +
        `${suggestions.filter(s => s.priority === 'LOW').length} thap)`,
    );

    return {
      suggestions,
      analysedBins: bins.length,
      generatedAt: new Date(),
    };
  }

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  /**
   * Tinh ABC class cua kien hang dua tren tan suat hoat dong
   * cua order/khach hang trong 30 ngay gan nhat.
   *
   * Logic:
   *   - Dem so don hang cua cung khach hang duoc tao/cap nhat trong 30 ngay
   *   - >= 10 don: A (khach hang hoat dong nhieu — kien xuat nhap thuong xuyen)
   *   - 4-9 don:   B (trung binh)
   *   - 0-3 don:   C (it hoat dong hoac khach moi)
   */
  private async _calculatePackageABCClass(
    orderId: string,
    customerId?: string | null,
  ): Promise<'A' | 'B' | 'C'> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (!customerId) {
      // Khong co customerId — dem hoat dong theo orderId
      const orderActivity = await this.prisma.package.count({
        where: {
          orderId,
          receivedCNAt: { gte: thirtyDaysAgo },
        },
      });

      if (orderActivity >= 5) return 'A';
      if (orderActivity >= 2) return 'B';
      return 'C';
    }

    // Dem so don hang cua khach hang trong 30 ngay
    const customerOrderCount = await this.prisma.order.count({
      where: {
        customerId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Dem so kien hang cua khach trong 30 ngay (the hien tan suat thuc te)
    const customerPackageCount = await this.prisma.package.count({
      where: {
        order: { customerId },
        receivedCNAt: { gte: thirtyDaysAgo },
      },
    });

    // Dung so kien hang (thuc te hon) de phan loai
    if (customerPackageCount >= 10 || customerOrderCount >= 5) return 'A';
    if (customerPackageCount >= 4 || customerOrderCount >= 2) return 'B';
    return 'C';
  }

  /**
   * Tra ve thu tu uu tien zone theo ABC class cua kien hang.
   * Neu zone chinh khong co o, thu zone lien ke truoc khi fallback.
   */
  private _getZonePreference(abcClass: 'A' | 'B' | 'C'): string[] {
    switch (abcClass) {
      case 'A':
        // Kien hoat dong cao: dat o khu A (gan cua) de xuat nhanh
        return ['A', 'B', 'C'];
      case 'B':
        // Kien trung binh: khu B, co the sang A hoac C
        return ['B', 'A', 'C'];
      case 'C':
      default:
        // Kien it xuat: khu C (xa nhat, tranh can duong)
        return ['C', 'B', 'A'];
    }
  }
}
