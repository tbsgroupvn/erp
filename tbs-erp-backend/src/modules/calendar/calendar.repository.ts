import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { ParticipantStatus } from '@prisma/client';

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEventsInRange(userId: string, from: Date, to: Date) {
    return this.prisma.calendarEvent.findMany({
      where: {
        deletedAt: null,
        startAt: { gte: from },
        endAt: { lte: to },
        OR: [
          { organizerId: userId },
          { participants: { some: { userId } } },
          { visibility: 'PUBLIC' },
        ],
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        reminders: true,
        room: true,
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findEventById(id: string) {
    return this.prisma.calendarEvent.findFirst({
      where: { id, deletedAt: null },
      include: {
        participants: {
          include: {
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        reminders: true,
        room: true,
        organizer: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async findRooms() {
    return this.prisma.meetingRoom.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { name: 'asc' },
    });
  }

  async findAllRooms() {
    return this.prisma.meetingRoom.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findRoomById(id: string) {
    return this.prisma.meetingRoom.findUnique({ where: { id } });
  }

  async checkRoomAvailability(
    roomId: string,
    startAt: Date,
    endAt: Date,
    excludeEventId?: string,
  ) {
    return this.prisma.calendarEvent.findFirst({
      where: {
        roomId,
        deletedAt: null,
        id: excludeEventId ? { not: excludeEventId } : undefined,
        // Overlap: existing.startAt < endAt AND existing.endAt > startAt
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true, title: true, startAt: true, endAt: true },
    });
  }

  async getFreeBusy(userId: string, from: Date, to: Date) {
    return this.prisma.calendarEvent.findMany({
      where: {
        deletedAt: null,
        startAt: { gte: from },
        endAt: { lte: to },
        OR: [
          { organizerId: userId },
          {
            participants: {
              some: {
                userId,
                status: { in: [ParticipantStatus.ACCEPTED, ParticipantStatus.TENTATIVE] },
              },
            },
          },
        ],
      },
      select: { startAt: true, endAt: true, allDay: true },
      orderBy: { startAt: 'asc' },
    });
  }
}
