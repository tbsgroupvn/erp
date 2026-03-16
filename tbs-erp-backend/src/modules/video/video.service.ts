import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import { VideoRoomStatus } from '@prisma/client';
import { CreateRoomDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly jitsiDomain: string;
  private readonly jitsiAppId: string;
  private readonly jitsiSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.jitsiDomain = config.get<string>('JITSI_DOMAIN', 'meet.jit.si');
    this.jitsiAppId = config.get<string>('JITSI_APP_ID', '');
    this.jitsiSecret = config.get<string>('JITSI_SECRET', '');
  }

  async createRoom(userId: string, dto: CreateRoomDto) {
    // Generate unique room name: tbs-{random-8hex}
    const roomName = `tbs-${crypto.randomBytes(4).toString('hex')}`;

    // Deduplicate participantIds and always include host
    const rawIds = dto.participantIds ?? [];
    const uniqueIds = [...new Set([userId, ...rawIds])];

    const room = await this.prisma.videoRoom.create({
      data: {
        title: dto.title,
        roomName,
        hostId: userId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        maxParticipants: dto.maxParticipants ?? null,
        conversationId: dto.conversationId ?? null,
        calendarEventId: dto.calendarEventId ?? null,
        participants: {
          create: uniqueIds.map((uid) => ({ userId: uid })),
        },
      },
      include: { participants: true },
    });

    this.logger.log(`VideoRoom created: ${room.id} by user ${userId}`);
    return { ...room, joinUrl: this.buildJoinUrl(room.roomName) };
  }

  async getRoomToken(userId: string, roomId: string) {
    const room = await this.prisma.videoRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    // Check participant or host
    const isAllowed =
      room.hostId === userId ||
      room.participants.some((p) => p.userId === userId);
    if (!isAllowed) throw new ForbiddenException('Not invited to this room');

    // Get user info for display name
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    // Generate JWT only if JITSI_SECRET is configured (private Jitsi deployments)
    // Uses HS256 signing compatible with Jitsi Meet JWT auth
    let token: string | undefined;
    if (this.jitsiSecret) {
      token = this.signJitsiJwt(
        {
          context: {
            user: {
              name: user?.fullName ?? 'User',
              email: user?.email ?? '',
              id: userId,
            },
          },
          aud: 'jitsi',
          iss: this.jitsiAppId,
          sub: this.jitsiDomain,
          room: room.roomName,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        this.jitsiSecret,
      );
    }

    // Mark as ACTIVE if not yet started
    if (!room.startedAt) {
      await this.prisma.videoRoom.update({
        where: { id: roomId },
        data: { status: VideoRoomStatus.ACTIVE, startedAt: new Date() },
      });
    }

    // Record join time — upsert pattern
    const existingParticipant = room.participants.find(
      (p) => p.userId === userId,
    );
    if (existingParticipant) {
      await this.prisma.videoParticipant.update({
        where: { roomId_userId: { roomId, userId } },
        data: { joinedAt: new Date(), leftAt: null },
      });
    } else {
      await this.prisma.videoParticipant.create({
        data: { roomId, userId, joinedAt: new Date() },
      });
    }

    return {
      roomName: room.roomName,
      domain: this.jitsiDomain,
      token,
      joinUrl: this.buildJoinUrl(room.roomName),
      displayName: user?.fullName ?? 'User',
    };
  }

  async endRoom(userId: string, roomId: string) {
    const room = await this.prisma.videoRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostId !== userId)
      throw new ForbiddenException('Only host can end the meeting');

    // Mark all participants as left
    await this.prisma.videoParticipant.updateMany({
      where: { roomId, leftAt: null },
      data: { leftAt: new Date() },
    });

    return this.prisma.videoRoom.update({
      where: { id: roomId },
      data: { status: VideoRoomStatus.ENDED, endedAt: new Date() },
    });
  }

  async getMyRooms(userId: string) {
    const rooms = await this.prisma.videoRoom.findMany({
      where: {
        OR: [
          { hostId: userId },
          { participants: { some: { userId } } },
        ],
        status: { not: VideoRoomStatus.ENDED },
      },
      include: {
        participants: {
          select: { userId: true, joinedAt: true, leftAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return rooms.map((r) => ({
      ...r,
      joinUrl: this.buildJoinUrl(r.roomName),
    }));
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.videoRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          select: { userId: true, joinedAt: true, leftAt: true },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    return { ...room, joinUrl: this.buildJoinUrl(room.roomName) };
  }

  /**
   * Quick DM call — create room for 2 people linked to a conversation
   */
  async startDMCall(userId: string, conversationId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { participants: { where: { leftAt: null } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const participantIds = conv.participants.map((p) => p.userId);
    return this.createRoom(userId, {
      title: 'Video call',
      conversationId,
      participantIds,
    });
  }

  private buildJoinUrl(roomName: string): string {
    return `https://${this.jitsiDomain}/${roomName}`;
  }

  /**
   * Sign a Jitsi Meet JWT using HS256 (HMAC-SHA256).
   * Avoids dependency on jsonwebtoken — uses only Node.js built-in crypto.
   */
  private signJitsiJwt(payload: Record<string, unknown>, secret: string): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encode = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const headerB64 = encode(header);
    const payloadB64 = encode(payload);
    const signing = `${headerB64}.${payloadB64}`;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(signing)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${signing}.${signature}`;
  }
}
