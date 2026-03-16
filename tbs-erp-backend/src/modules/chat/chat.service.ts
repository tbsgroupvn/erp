import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { MessageStatus } from '@prisma/client';
import { ChatRepository } from './chat.repository';
import { ChatGateway } from './chat.gateway';
import { CreateDMDto, CreateGroupDto, UpdateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { AddParticipantsDto } from './dto/participant.dto';

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatRepo: ChatRepository,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  // ─── Conversations ───

  async createOrGetDM(userId: string, dto: CreateDMDto) {
    if (dto.targetUserId === userId) {
      throw new BadRequestException('Cannot start DM with yourself');
    }

    // Check target user exists and is active
    const target = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      select: { id: true, isActive: true, fullName: true },
    });
    if (!target || !target.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    // Return existing DM if found
    const existing = await this.chatRepo.findDirectConversation(userId, dto.targetUserId);
    if (existing) return this.enrichConversation(existing, userId);

    // Create new DM
    const conv = await this.prisma.chatConversation.create({
      data: {
        type: 'DIRECT',
        createdBy: userId,
        participants: {
          create: [
            { userId, role: 'MEMBER' },
            { userId: dto.targetUserId, role: 'MEMBER' },
          ],
        },
      },
      include: { participants: true },
    });

    // Notify both participants
    for (const p of conv.participants) {
      this.chatGateway.emitToUser(p.userId, 'chat:conversation:created', {
        conversation: await this.enrichConversation(conv, p.userId),
      });
    }

    return this.enrichConversation(conv, userId);
  }

  async createGroup(userId: string, dto: CreateGroupDto) {
    const participantIds = [...new Set([userId, ...dto.participantIds])];

    const conv = await this.prisma.chatConversation.create({
      data: {
        type: 'GROUP',
        name: dto.name,
        createdBy: userId,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        participants: {
          create: participantIds.map((uid) => ({
            userId: uid,
            role: uid === userId ? 'OWNER' : 'MEMBER',
          })),
        },
      },
      include: { participants: true },
    });

    for (const p of conv.participants) {
      this.chatGateway.emitToUser(p.userId, 'chat:conversation:created', {
        conversation: await this.enrichConversation(conv, p.userId),
      });
    }

    return this.enrichConversation(conv, userId);
  }

  async updateConversation(userId: string, conversationId: string, dto: UpdateConversationDto) {
    await this.assertParticipantRole(conversationId, userId, 'OWNER');
    const conv = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { name: dto.name },
      include: { participants: true },
    });
    return this.enrichConversation(conv, userId);
  }

  async getConversations(userId: string, search?: string) {
    const convs = await this.chatRepo.findUserConversations(userId, search);
    const enriched = await Promise.all(
      convs.map(async (c) => {
        const unreadCount = await this.chatRepo.getUnreadCount(c.id, userId);
        const base = await this.enrichConversation(c, userId);
        return { ...base, unreadCount };
      }),
    );
    return enriched;
  }

  // ─── Messages ───

  async getMessages(userId: string, conversationId: string, cursor?: string, limit = 30) {
    await this.assertParticipant(conversationId, userId);
    const result = await this.chatRepo.findMessages(conversationId, limit, cursor);
    // Enrich sender info
    const senderIds = [...new Set(result.items.map((m) => m.senderId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, fullName: true, role: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return {
      ...result,
      items: result.items.map((m) => ({
        ...m,
        sender: userMap[m.senderId] ?? null,
      })),
    };
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    await this.assertParticipant(conversationId, userId);

    if (dto.replyToId) {
      const parent = await this.chatRepo.findMessageById(dto.replyToId);
      if (!parent || parent.conversationId !== conversationId) {
        throw new BadRequestException('Invalid replyToId');
      }
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content: dto.content,
        replyToId: dto.replyToId,
      },
      include: {
        replyTo: {
          select: { id: true, content: true, senderId: true, status: true },
        },
      },
    });

    // Touch conversation updatedAt for ordering
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, role: true },
    });

    const payload = { ...message, sender };
    this.chatGateway.emitToConversation(conversationId, 'chat:message:new', payload);

    return payload;
  }

  async editMessage(userId: string, messageId: string, dto: EditMessageDto) {
    const message = await this.chatRepo.findMessageById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot edit others\' messages');
    if (message.status === MessageStatus.DELETED) {
      throw new BadRequestException('Cannot edit deleted message');
    }

    const age = Date.now() - message.createdAt.getTime();
    if (age > EDIT_WINDOW_MS) {
      throw new BadRequestException('Edit window (5 minutes) has expired');
    }

    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        status: MessageStatus.EDITED,
        editedAt: new Date(),
      },
    });

    this.chatGateway.emitToConversation(message.conversationId, 'chat:message:edited', updated);
    return updated;
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.chatRepo.findMessageById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot delete others\' messages');

    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.DELETED,
        deletedAt: new Date(),
      },
    });

    this.chatGateway.emitToConversation(message.conversationId, 'chat:message:deleted', {
      id: messageId,
      conversationId: message.conversationId,
      status: MessageStatus.DELETED,
    });

    return updated;
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.chatParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    const total = await this.chatRepo.getTotalUnreadCount(userId);
    this.chatGateway.emitToUser(userId, 'chat:unread:update', { total });
  }

  // ─── Participants ───

  async addParticipants(requesterId: string, conversationId: string, dto: AddParticipantsDto) {
    await this.assertParticipantRole(conversationId, requesterId, 'OWNER');

    const conv = await this.chatRepo.findConversationById(conversationId);
    if (!conv || conv.type !== 'GROUP') {
      throw new BadRequestException('Can only add participants to group conversations');
    }

    const existingUserIds = conv.participants.map((p) => p.userId);
    const toAdd = dto.userIds.filter((id) => !existingUserIds.includes(id));

    if (toAdd.length === 0) return conv;

    await this.prisma.chatParticipant.createMany({
      data: toAdd.map((userId) => ({ conversationId, userId, role: 'MEMBER' })),
      skipDuplicates: true,
    });

    // Notify new members
    for (const uid of toAdd) {
      const enriched = await this.enrichConversation(conv, uid);
      this.chatGateway.emitToUser(uid, 'chat:conversation:created', { conversation: enriched });
    }

    return this.chatRepo.findConversationById(conversationId);
  }

  async removeParticipant(requesterId: string, conversationId: string, targetUserId: string) {
    await this.assertParticipantRole(conversationId, requesterId, 'OWNER');
    if (targetUserId === requesterId) {
      throw new BadRequestException('Use /leave to leave a group');
    }
    await this.softLeave(conversationId, targetUserId);
  }

  async leaveConversation(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    const role = await this.chatRepo.getParticipantRole(conversationId, userId);
    if (role === 'OWNER') {
      // Transfer ownership to oldest MEMBER, else dissolve
      const other = await this.prisma.chatParticipant.findFirst({
        where: { conversationId, userId: { not: userId }, leftAt: null, role: 'MEMBER' },
        orderBy: { joinedAt: 'asc' },
      });
      if (other) {
        await this.prisma.chatParticipant.update({
          where: { id: other.id },
          data: { role: 'OWNER' },
        });
      }
    }
    await this.softLeave(conversationId, userId);
  }

  // ─── Reactions & Pin ───

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const allowed = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
    if (!allowed.includes(emoji)) throw new BadRequestException('Invalid emoji');

    const message = await this.chatRepo.findMessageById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    await this.assertParticipant(message.conversationId, userId);

    const existing = await this.prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.chatReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.chatReaction.create({ data: { messageId, userId, emoji } });
    }

    const reactions = await this.prisma.chatReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true },
    });

    const payload = { messageId, conversationId: message.conversationId, reactions };
    this.chatGateway.emitToConversation(message.conversationId, 'chat:reaction:update', payload);
    return payload;
  }

  async pinMessage(userId: string, conversationId: string, messageId: string | null) {
    await this.assertParticipantRole(conversationId, userId, 'OWNER');
    if (messageId) {
      const msg = await this.chatRepo.findMessageById(messageId);
      if (!msg || msg.conversationId !== conversationId) {
        throw new BadRequestException('Invalid messageId');
      }
    }
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { pinnedMessageId: messageId },
    });
    this.chatGateway.emitToConversation(conversationId, 'chat:pinned:update', {
      conversationId,
      messageId,
    });
    return { success: true };
  }

  // ─── Utility ───

  async searchUsers(query: string, limit: number, requesterId: string) {
    return this.chatRepo.searchUsers(query, Math.min(limit, 20), requesterId);
  }

  async getTotalUnreadCount(userId: string) {
    return this.chatRepo.getTotalUnreadCount(userId);
  }

  // ─── Private helpers ───

  private async assertParticipant(conversationId: string, userId: string) {
    const is = await this.chatRepo.isParticipant(conversationId, userId);
    if (!is) throw new ForbiddenException('Not a participant of this conversation');
  }

  private async assertParticipantRole(
    conversationId: string,
    userId: string,
    requiredRole: string,
  ) {
    const role = await this.chatRepo.getParticipantRole(conversationId, userId);
    if (!role) throw new ForbiddenException('Not a participant of this conversation');
    if (requiredRole === 'OWNER' && role !== 'OWNER') {
      throw new ForbiddenException('Only the group owner can perform this action');
    }
  }

  private async softLeave(conversationId: string, userId: string) {
    await this.prisma.chatParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { leftAt: new Date() },
    });
  }

  private async enrichConversation(conv: any, viewerUserId: string) {
    // For DM: resolve display name from the other participant
    let displayName = conv.name ?? null;
    let dmTargetUser: any = null;

    if (conv.type === 'DIRECT') {
      const otherParticipant = conv.participants?.find(
        (p: any) => p.userId !== viewerUserId && !p.leftAt,
      );
      if (otherParticipant) {
        const user = await this.prisma.user.findUnique({
          where: { id: otherParticipant.userId },
          select: { id: true, fullName: true, role: true },
        });
        displayName = user?.fullName ?? null;
        dmTargetUser = user;
      }
    }

    return {
      ...conv,
      displayName,
      dmTargetUser,
    };
  }
}
