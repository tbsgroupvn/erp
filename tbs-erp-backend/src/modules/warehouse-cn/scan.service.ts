import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Prisma } from '@prisma/client';

// Gioi han toi da scan hang loat
const BATCH_SCAN_LIMIT = 50;

// Cache TTL constants
/** TTL cho barcode scan cache: 5 phut */
const BARCODE_CACHE_TTL_MS = 300_000;
/** TTL cho scan log cache (batch scan history): 24 gio */
const SCAN_LOG_CACHE_TTL_MS = 86_400_000;

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * B3: Scan barcode to look up a package by tracking number with Redis cache.
   */
  async scanBarcode(trackingNumber: string) {
    return this.cacheService.getOrSet(
      `barcode:${trackingNumber}`,
      async () => {
        const packages = await this.prisma.package.findMany({
          where: {
            trackingNumberCN: { equals: trackingNumber, mode: 'insensitive' },
          },
          include: {
            order: {
              select: {
                id: true,
                code: true,
                customerId: true,
                status: true,
                customer: {
                  select: { id: true, fullName: true, code: true, phone: true },
                },
              },
            },
            container: { select: { id: true, code: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (packages.length === 0) return null;
        // Backward compatible: return first package + siblings info
        return {
          ...packages[0],
          siblings: packages.slice(1),
          totalPieces: packages.length,
        };
      },
      BARCODE_CACHE_TTL_MS,
    );
  }

  /**
   * Scan hang loat toi da 50 ma van don, tra ve ket qua cho tung ma.
   *
   * Su dung Promise.allSettled de xu ly song song khong chan nhau.
   * Ghi scan event vao audit log de theo doi lich su.
   */
  async batchScan(trackingNumbers: string[], userId: string) {
    if (!trackingNumbers || trackingNumbers.length === 0) {
      throw new BadRequestException('Can it nhat 1 ma van don');
    }
    if (trackingNumbers.length > BATCH_SCAN_LIMIT) {
      throw new BadRequestException(
        `Qua gioi han: toi da ${BATCH_SCAN_LIMIT} ma van don moi lan scan`,
      );
    }

    // Xu ly theo lo de tranh con pool bi bao hoa (toi da 10 query song song)
    const BATCH_SIZE = 10;
    const rawResults: PromiseSettledResult<{ trackingNumber: string; packages: any[] }>[] = [];

    for (let i = 0; i < trackingNumbers.length; i += BATCH_SIZE) {
      const batch = trackingNumbers.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (tn) => {
          const packages = await this.prisma.package.findMany({
            where: {
              trackingNumberCN: { equals: tn, mode: 'insensitive' },
            },
            select: {
              id: true,
              code: true,
              warehouseCNStatus: true,
              warehouseVNStatus: true,
              receivedCNAt: true,
              chargeableWeight: true,
              containerId: true,
              order: {
                select: {
                  id: true,
                  code: true,
                  customer: { select: { fullName: true, code: true } },
                },
              },
              container: { select: { id: true, code: true, status: true } },
            },
            orderBy: { createdAt: 'asc' },
          });

          return { trackingNumber: tn, packages };
        }),
      );
      rawResults.push(...batchResults);
    }

    const results = rawResults;

    // Lay danh sach package tim thay de ghi log
    const scannedPackageIds: string[] = [];
    const output = results.map((r, idx) => {
      const tn = trackingNumbers[idx];
      if (r.status === 'fulfilled') {
        const { packages } = r.value;
        if (packages.length > 0) {
          scannedPackageIds.push(...packages.map(p => p.id));
          return {
            trackingNumber: tn,
            status: 'found' as const,
            packages,
            totalPieces: packages.length,
          };
        }
        return { trackingNumber: tn, status: 'not_found' as const, packages: [], totalPieces: 0 };
      }
      return { trackingNumber: tn, status: 'error' as const, packages: [], totalPieces: 0 };
    });

    // Ghi lich su scan vao redis cache
    if (scannedPackageIds.length > 0) {
      try {
        await this.cacheService.set(
          `scan:batch:${userId}:${Date.now()}`,
          {
            userId,
            trackingNumbers,
            found: output.filter(r => r.status === 'found').length,
            scannedAt: new Date().toISOString(),
          },
          SCAN_LOG_CACHE_TTL_MS,
        );
      } catch {
        // Khong nen chan scan neu cache loi
      }
    }

    this.logger.log(
      `Batch scan boi ${userId}: ${trackingNumbers.length} ma, ` +
        `${output.filter(r => r.status === 'found').length} tim thay, ` +
        `${output.filter(r => r.status === 'not_found').length} khong thay`,
    );

    return {
      results: output,
      summary: {
        total: trackingNumbers.length,
        found: output.filter(r => r.status === 'found').length,
        notFound: output.filter(r => r.status === 'not_found').length,
        error: output.filter(r => r.status === 'error').length,
      },
    };
  }

  /**
   * Lay lich su scan cua nhan vien, lay tu Package receivedCNAt de uoc tinh hoat dong scan.
   */
  async getScanHistory(params: { userId?: string; date?: string; limit: number }) {
    const { userId, date, limit } = params;
    const effectiveLimit = Math.min(limit, 200);

    // Xay dung dieu kien loc theo ngay
    let dateFilter: Prisma.DateTimeFilter | undefined;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { gte: startOfDay, lte: endOfDay };
    }

    // Lay lich su nhan kien (moi nhan = 1 lan scan)
    const where: Prisma.PackageWhereInput = {
      receivedCNAt: { not: null },
      ...(userId ? { receivedCNBy: userId } : {}),
      ...(dateFilter ? { receivedCNAt: dateFilter } : {}),
    };

    const packages = await this.prisma.package.findMany({
      where,
      select: {
        id: true,
        code: true,
        trackingNumberCN: true,
        receivedCNAt: true,
        receivedCNBy: true,
        warehouseCNStatus: true,
        order: {
          select: {
            code: true,
            customer: { select: { fullName: true, code: true } },
          },
        },
      },
      orderBy: { receivedCNAt: 'desc' },
      take: effectiveLimit,
    });

    return {
      history: packages.map(p => ({
        packageId: p.id,
        packageCode: p.code,
        trackingNumber: p.trackingNumberCN ?? '',
        scannedAt: p.receivedCNAt,
        scannedBy: p.receivedCNBy,
        orderCode: p.order?.code ?? '',
        customerName: p.order?.customer?.fullName ?? '',
        status: p.warehouseCNStatus,
      })),
      total: packages.length,
    };
  }

  /**
   * Thong ke hoat dong scan:
   *   - Tong so kien nhan hom nay
   *   - Trung binh so kien/ngay trong 30 ngay
   *   - Top 5 nhan vien scan nhieu nhat trong 30 ngay
   */
  async getScanStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Tong scan hom nay
    const todayCount = await this.prisma.package.count({
      where: { receivedCNAt: { gte: today, lte: todayEnd } },
    });

    // Tong scan trong 30 ngay
    const thirtyDayCount = await this.prisma.package.count({
      where: { receivedCNAt: { gte: thirtyDaysAgo } },
    });

    const avgPerDay = Math.round(thirtyDayCount / 30 * 10) / 10;

    // Top scanners trong 30 ngay (nhom theo receivedCNBy)
    const topScanners = await this.prisma.package.groupBy({
      by: ['receivedCNBy'],
      where: {
        receivedCNAt: { gte: thirtyDaysAgo },
        receivedCNBy: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Lay ten nhan vien
    const scannerIds = topScanners
      .map(s => s.receivedCNBy)
      .filter((id): id is string => id !== null);

    const users = await this.prisma.user.findMany({
      where: { id: { in: scannerIds } },
      select: { id: true, fullName: true, role: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return {
      today: todayCount,
      last30Days: thirtyDayCount,
      avgPerDay,
      topScanners: topScanners.map(s => ({
        userId: s.receivedCNBy,
        fullName: s.receivedCNBy ? (userMap.get(s.receivedCNBy)?.fullName ?? 'N/A') : 'N/A',
        role: s.receivedCNBy ? (userMap.get(s.receivedCNBy)?.role ?? '') : '',
        count: s._count.id,
      })),
    };
  }
}
