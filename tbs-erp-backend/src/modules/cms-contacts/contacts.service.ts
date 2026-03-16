import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { GetContactsDto } from './dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: GetContactsDto) {
    const { status, search, page = 1, limit = 50 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactSubmissionWhereInput = {};

    // Map status filter to boolean fields
    if (status === 'NEW') {
      where.isRead = false;
    } else if (status === 'READ') {
      where.isRead = true;
      where.isReplied = false;
    } else if (status === 'REPLIED') {
      where.isReplied = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactSubmission.count({ where }),
    ]);

    // Map response to include computed status
    const dataWithStatus = data.map((contact) => ({
      ...contact,
      status: contact.isReplied ? 'REPLIED' : contact.isRead ? 'READ' : 'NEW',
    }));

    return { data: dataWithStatus, total };
  }

  async findOne(id: string) {
    const contact = await this.prisma.contactSubmission.findUnique({
      where: { id },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID "${id}" not found`);
    }

    return contact;
  }

  async updateStatus(id: string, status: 'READ' | 'REPLIED') {
    await this.findOne(id);

    const updateData: any = {};

    if (status === 'READ') {
      updateData.isRead = true;
    } else if (status === 'REPLIED') {
      updateData.isRead = true;
      updateData.isReplied = true;
    }

    const updated = await this.prisma.contactSubmission.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updated,
      status: updated.isReplied ? 'REPLIED' : updated.isRead ? 'READ' : 'NEW',
    };
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.contactSubmission.delete({
      where: { id },
    });

    return { message: 'Contact deleted successfully' };
  }

  async getStats() {
    const total = await this.prisma.contactSubmission.count();
    const unread = await this.prisma.contactSubmission.count({
      where: { isRead: false },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await this.prisma.contactSubmission.count({
      where: { createdAt: { gte: today } },
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekCount = await this.prisma.contactSubmission.count({
      where: { createdAt: { gte: weekAgo } },
    });

    return { total, unread, today: todayCount, week: weekCount };
  }
}
