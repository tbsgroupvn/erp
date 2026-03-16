import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { GetNewsletterDto } from './dto';

@Injectable()
export class NewsletterService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: GetNewsletterDto) {
    const { status, search, page = 1, limit = 50 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.NewsletterSubscriptionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.newsletterSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.newsletterSubscription.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    const subscriber = await this.prisma.newsletterSubscription.findUnique({
      where: { id },
    });

    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID "${id}" not found`);
    }

    return subscriber;
  }

  async unsubscribe(id: string) {
    await this.findOne(id);

    return this.prisma.newsletterSubscription.update({
      where: { id },
      data: {
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.newsletterSubscription.delete({
      where: { id },
    });

    return { message: 'Subscriber deleted successfully' };
  }

  async getStats() {
    const total = await this.prisma.newsletterSubscription.count();
    const active = await this.prisma.newsletterSubscription.count({
      where: { status: 'active' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await this.prisma.newsletterSubscription.count({
      where: { createdAt: { gte: today } },
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekCount = await this.prisma.newsletterSubscription.count({
      where: { createdAt: { gte: weekAgo } },
    });

    return { total, active, today: todayCount, week: weekCount };
  }
}
