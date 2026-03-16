import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { GetFaqDto, CreateFaqDto, UpdateFaqDto } from './dto';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: GetFaqDto) {
    const { category, isPublished, search, page = 1, limit = 50 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.FAQWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (isPublished !== undefined) {
      where.isActive = isPublished === 'true' || isPublished === true;
    }

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.fAQ.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order: 'asc' },
      }),
      this.prisma.fAQ.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id },
    });

    if (!faq) {
      throw new NotFoundException(`FAQ with ID "${id}" not found`);
    }

    return faq;
  }

  async create(dto: CreateFaqDto) {
    return this.prisma.fAQ.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        category: dto.category,
        order: dto.order ?? 0,
        isActive: dto.isPublished ?? false,
        viewCount: 0,
      },
    });
  }

  async update(id: string, dto: UpdateFaqDto) {
    await this.findOne(id);

    return this.prisma.fAQ.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.fAQ.delete({
      where: { id },
    });

    return { message: 'FAQ deleted successfully' };
  }

  async togglePublish(id: string, isPublished: boolean) {
    await this.findOne(id);

    return this.prisma.fAQ.update({
      where: { id },
      data: { isActive: isPublished },
    });
  }

  async incrementViews(id: string) {
    await this.findOne(id);

    return this.prisma.fAQ.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  async getStats() {
    const total = await this.prisma.fAQ.count();
    const published = await this.prisma.fAQ.count({
      where: { isActive: true },
    });
    const draft = total - published;

    const totalViews = await this.prisma.fAQ.aggregate({
      _sum: { viewCount: true },
    });

    return {
      total,
      published,
      draft,
      totalViews: totalViews._sum?.viewCount || 0,
    };
  }
}
