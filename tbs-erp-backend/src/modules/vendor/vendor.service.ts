import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { RateVendorDto } from './dto/rate-vendor.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new vendor with auto-generated code VND-XXXX.
   */
  async createVendor(dto: CreateVendorDto) {
    const code = await this.generateCode();

    const vendor = await this.prisma.vendor.create({
      data: {
        code,
        name: dto.name,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        country: dto.country ?? 'CN',
        paymentTerms: dto.paymentTerms,
        bankName: dto.bankName,
        bankAccount: dto.bankAccount,
      },
    });

    this.logger.log(`Vendor ${code} created: ${dto.name}`);

    return vendor;
  }

  /**
   * Updates an existing vendor.
   */
  async updateVendor(id: string, dto: UpdateVendorDto) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${id} not found.`);
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount }),
      },
    });

    this.logger.log(`Vendor ${vendor.code} updated`);

    return updated;
  }

  /**
   * Lists vendors with pagination and filters.
   */
  async findAll(query: VendorQueryDto) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { contactPerson: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.country) where.country = query.country;
    if (query.isApproved !== undefined) where.isApproved = query.isApproved;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: {
          _count: { select: { ratings: true } },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single vendor by ID with ratings.
   */
  async findById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        ratings: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${id} not found.`);
    }

    return vendor;
  }

  /**
   * Adds a rating for a vendor.
   */
  async rateVendor(id: string, dto: RateVendorDto, userId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${id} not found.`);
    }

    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5.');
    }

    const rating = await this.prisma.vendorRating.create({
      data: {
        vendorId: id,
        score: dto.score,
        category: dto.category,
        comment: dto.comment,
        orderId: dto.orderId,
        createdBy: userId,
      },
    });

    this.logger.log(`Vendor ${vendor.code} rated ${dto.score}/5 by ${userId}`);

    return rating;
  }

  /**
   * Gets average rating for a vendor with breakdown by category.
   */
  async getVendorRating(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${id} not found.`);
    }

    const ratings = await this.prisma.vendorRating.findMany({
      where: { vendorId: id },
    });

    if (ratings.length === 0) {
      return {
        vendor,
        averageScore: 0,
        totalRatings: 0,
        breakdown: {},
      };
    }

    const averageScore =
      ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    // Breakdown by category
    const byCategory = new Map<string, { total: number; count: number }>();
    for (const rating of ratings) {
      const cat = rating.category ?? 'GENERAL';
      const current = byCategory.get(cat) ?? { total: 0, count: 0 };
      current.total += rating.score;
      current.count += 1;
      byCategory.set(cat, current);
    }

    const breakdown: Record<string, { average: number; count: number }> = {};
    for (const [category, data] of byCategory.entries()) {
      breakdown[category] = {
        average: Math.round((data.total / data.count) * 100) / 100,
        count: data.count,
      };
    }

    return {
      vendor,
      averageScore: Math.round(averageScore * 100) / 100,
      totalRatings: ratings.length,
      breakdown,
    };
  }

  /**
   * Lists approved vendors.
   */
  async getApprovedVendors() {
    return this.prisma.vendor.findMany({
      where: { isApproved: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Toggles vendor approval status.
   */
  async toggleApprovalStatus(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${id} not found.`);
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { isApproved: !vendor.isApproved },
    });

    this.logger.log(
      `Vendor ${vendor.code} approval status toggled to ${updated.isApproved}`,
    );

    return updated;
  }

  /**
   * Generates vendor code in the format VND-XXXX.
   */
  private async generateCode(): Promise<string> {
    const latest = await this.prisma.vendor.findFirst({
      where: { code: { startsWith: 'VND-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.replace('VND-', ''), 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `VND-${String(sequence).padStart(4, '0')}`;
  }
}
