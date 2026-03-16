import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateServiceFeeConfigDto,
  UpdateServiceFeeConfigDto,
  ServiceFeeConfigQueryDto,
} from './dto/service-fee-config.dto';

@Injectable()
export class ServiceFeeConfigService {
  private readonly logger = new Logger(ServiceFeeConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists service fee configs with pagination and filters.
   */
  async findAll(query: ServiceFeeConfigQueryDto) {
    const where: Prisma.ServiceFeeConfigWhereInput = {};

    if (query.serviceType) {
      where.serviceType = query.serviceType;
    }

    if (query.customerTier) {
      where.customerTier = query.customerTier;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.serviceFeeConfig.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.ServiceFeeConfigOrderByWithRelationInput,
      }),
      this.prisma.serviceFeeConfig.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single service fee config by ID.
   */
  async findOne(id: string) {
    const config = await this.prisma.serviceFeeConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`ServiceFeeConfig with ID ${id} not found`);
    }

    return config;
  }

  /**
   * Creates a new service fee config.
   */
  async create(dto: CreateServiceFeeConfigDto, createdBy: string) {
    const config = await this.prisma.serviceFeeConfig.create({
      data: {
        name: dto.name,
        serviceType: dto.serviceType ?? 'MHH',
        customerTier: dto.customerTier ?? null,
        minOrderValue: dto.minOrderValue != null ? new Decimal(dto.minOrderValue) : null,
        maxOrderValue: dto.maxOrderValue != null ? new Decimal(dto.maxOrderValue) : null,
        minQuantity: dto.minQuantity ?? null,
        productCategory: dto.productCategory ?? null,
        feePercent: new Decimal(dto.feePercent),
        minFeeAmount: dto.minFeeAmount != null ? new Decimal(dto.minFeeAmount) : null,
        maxFeeAmount: dto.maxFeeAmount != null ? new Decimal(dto.maxFeeAmount) : null,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
        note: dto.note ?? null,
        createdBy,
      },
    });

    this.logger.log(
      `ServiceFeeConfig "${config.name}" (${config.id}) created by user ${createdBy}`,
    );

    return config;
  }

  /**
   * Updates an existing service fee config.
   */
  async update(id: string, dto: UpdateServiceFeeConfigDto) {
    const existing = await this.prisma.serviceFeeConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`ServiceFeeConfig with ID ${id} not found`);
    }

    const updateData: Prisma.ServiceFeeConfigUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.serviceType !== undefined) updateData.serviceType = dto.serviceType;
    if (dto.customerTier !== undefined) updateData.customerTier = dto.customerTier;
    if (dto.minOrderValue !== undefined)
      updateData.minOrderValue = dto.minOrderValue != null ? new Decimal(dto.minOrderValue) : null;
    if (dto.maxOrderValue !== undefined)
      updateData.maxOrderValue = dto.maxOrderValue != null ? new Decimal(dto.maxOrderValue) : null;
    if (dto.minQuantity !== undefined) updateData.minQuantity = dto.minQuantity;
    if (dto.productCategory !== undefined) updateData.productCategory = dto.productCategory;
    if (dto.feePercent !== undefined) updateData.feePercent = new Decimal(dto.feePercent);
    if (dto.minFeeAmount !== undefined)
      updateData.minFeeAmount = dto.minFeeAmount != null ? new Decimal(dto.minFeeAmount) : null;
    if (dto.maxFeeAmount !== undefined)
      updateData.maxFeeAmount = dto.maxFeeAmount != null ? new Decimal(dto.maxFeeAmount) : null;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.note !== undefined) updateData.note = dto.note;

    const updated = await this.prisma.serviceFeeConfig.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`ServiceFeeConfig "${updated.name}" (${id}) updated`);

    return updated;
  }

  /**
   * Soft-deletes a service fee config by setting isActive to false.
   */
  async remove(id: string) {
    const existing = await this.prisma.serviceFeeConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`ServiceFeeConfig with ID ${id} not found`);
    }

    const updated = await this.prisma.serviceFeeConfig.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`ServiceFeeConfig "${existing.name}" (${id}) soft-deleted (isActive=false)`);

    return updated;
  }
}
