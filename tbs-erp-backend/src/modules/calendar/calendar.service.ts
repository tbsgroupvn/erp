import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CalendarRepository } from './calendar.repository';
import { CreateEventDto, UpdateEventDto, RespondEventDto, EventQueryDto } from './dto/create-event.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { ParticipantStatus } from '@prisma/client';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CalendarRepository,
  ) {}

  // ─── Events ───────────────────────────────────────────────────────────────

  async createEvent(userId: string, dto: CreateEventDto) {
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);

    if (end <= start) {
      throw new BadRequestException('endAt phai sau startAt');
    }

    if (dto.roomId) {
      const conflict = await this.repo.checkRoomAvailability(dto.roomId, start, end);
      if (conflict) {
        throw new BadRequestException(
          `Phong hop da duoc dat trong khoang thoi gian nay (su kien: "${conflict.title}")`,
        );
      }
    }

    // Organizer luon la participant ACCEPTED
    const participantIds = [...new Set([...(dto.participantIds ?? []), userId])];

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        color: dto.color ?? '#3b82f6',
        allDay: dto.allDay ?? false,
        startAt: start,
        endAt: end,
        recurrence: dto.recurrence,
        visibility: dto.visibility ?? 'PUBLIC',
        organizerId: userId,
        roomId: dto.roomId ?? null,
        participants: {
          create: participantIds.map((uid) => ({
            userId: uid,
            status: uid === userId ? ParticipantStatus.ACCEPTED : ParticipantStatus.INVITED,
          })),
        },
        reminders:
          dto.reminderMinutes && dto.reminderMinutes.length > 0
            ? {
                create: dto.reminderMinutes.map((m) => ({ minutesBefore: m, sent: false })),
              }
            : undefined,
      },
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

    this.logger.log(`Su kien "${event.title}" duoc tao boi user ${userId}`);
    return event;
  }

  async updateEvent(userId: string, eventId: string, dto: UpdateEventDto) {
    const event = await this.repo.findEventById(eventId);
    if (!event) throw new NotFoundException('Khong tim thay su kien');
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Chi nguoi to chuc moi co the chinh sua su kien');
    }

    if (dto.startAt && dto.endAt) {
      const start = new Date(dto.startAt);
      const end = new Date(dto.endAt);
      if (end <= start) {
        throw new BadRequestException('endAt phai sau startAt');
      }
      const roomId = dto.roomId ?? event.roomId;
      if (roomId) {
        const conflict = await this.repo.checkRoomAvailability(roomId, start, end, eventId);
        if (conflict) {
          throw new BadRequestException(
            `Phong hop da duoc dat trong khoang thoi gian nay (su kien: "${conflict.title}")`,
          );
        }
      }
    } else if (dto.startAt && !dto.endAt) {
      // Validate start < existing end
      const start = new Date(dto.startAt);
      if (start >= event.endAt) {
        throw new BadRequestException('startAt phai truoc thoi gian ket thuc hien tai');
      }
    } else if (!dto.startAt && dto.endAt) {
      const end = new Date(dto.endAt);
      if (end <= event.startAt) {
        throw new BadRequestException('endAt phai sau thoi gian bat dau hien tai');
      }
    }

    const updated = await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        color: dto.color,
        allDay: dto.allDay,
        visibility: dto.visibility,
        roomId: dto.roomId,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
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

    this.logger.log(`Su kien "${updated.title}" (${eventId}) duoc cap nhat boi ${userId}`);
    return updated;
  }

  async deleteEvent(userId: string, eventId: string) {
    const event = await this.repo.findEventById(eventId);
    if (!event) throw new NotFoundException('Khong tim thay su kien');
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Chi nguoi to chuc moi co the xoa su kien');
    }

    await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Su kien "${event.title}" (${eventId}) da bi xoa boi ${userId}`);
    return { deleted: true, id: eventId };
  }

  async respondToEvent(userId: string, eventId: string, dto: RespondEventDto) {
    // Kiem tra event ton tai
    const event = await this.repo.findEventById(eventId);
    if (!event) throw new NotFoundException('Khong tim thay su kien');

    const participant = await this.prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!participant) {
      throw new ForbiddenException('Ban khong duoc moi tham gia su kien nay');
    }

    const updated = await this.prisma.eventParticipant.update({
      where: { eventId_userId: { eventId, userId } },
      data: {
        status: dto.status as ParticipantStatus,
        respondedAt: new Date(),
      },
    });

    this.logger.log(`User ${userId} da ${dto.status} su kien ${eventId}`);
    return updated;
  }

  async getEvents(userId: string, query: EventQueryDto) {
    let from: Date;
    let to: Date;

    if (query.from) {
      from = new Date(query.from);
    } else {
      from = new Date();
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
    }

    if (query.to) {
      to = new Date(query.to);
    } else {
      to = new Date(from);
      to.setMonth(to.getMonth() + 1);
    }

    return this.repo.findEventsInRange(userId, from, to);
  }

  async getEvent(userId: string, eventId: string) {
    const event = await this.repo.findEventById(eventId);
    if (!event) throw new NotFoundException('Khong tim thay su kien');

    const isParticipant = event.participants.some((p) => p.userId === userId);
    const isOrganizer = event.organizerId === userId;

    if (event.visibility === 'PRIVATE' && !isOrganizer && !isParticipant) {
      throw new ForbiddenException('Khong co quyen xem su kien nay');
    }

    return event;
  }

  async getFreeBusy(
    _requestingUserId: string,
    targetUserId: string,
    from: string,
    to: string,
  ) {
    return this.repo.getFreeBusy(targetUserId, new Date(from), new Date(to));
  }

  // ─── Rooms ────────────────────────────────────────────────────────────────

  async getRooms() {
    return this.repo.findRooms();
  }

  async createRoom(dto: CreateRoomDto) {
    const room = await this.prisma.meetingRoom.create({
      data: {
        name: dto.name,
        location: dto.location ?? null,
        capacity: dto.capacity,
        features: dto.features ?? [],
        status: 'AVAILABLE',
      },
    });
    this.logger.log(`Phong hop "${room.name}" (${room.id}) da duoc tao`);
    return room;
  }

  async checkRoomAvailability(roomId: string, startAt: string, endAt: string) {
    const room = await this.repo.findRoomById(roomId);
    if (!room) throw new NotFoundException('Khong tim thay phong hop');

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (end <= start) {
      throw new BadRequestException('endAt phai sau startAt');
    }

    const conflict = await this.repo.checkRoomAvailability(roomId, start, end);
    return {
      available: !conflict,
      conflict: conflict
        ? {
            eventId: conflict.id,
            title: conflict.title,
            startAt: conflict.startAt,
            endAt: conflict.endAt,
          }
        : null,
    };
  }
}
