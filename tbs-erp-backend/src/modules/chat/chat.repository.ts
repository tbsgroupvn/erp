import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { MessageStatus } from '@prisma/client';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Conversation queries ───

  async findDirectConversation(uid1: string, uid2: string) {
    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM chat_conversations c
      JOIN chat_participants p1
        ON p1.conversation_id = c.id AND p1.user_id = ${uid1} AND p1.left_at IS NULL
      JOIN chat_participants p2
        ON p2.conversation_id = c.id AND p2.user_id = ${uid2} AND p2.left_at IS NULL
      WHERE c.type = 'DIRECT'
      LIMIT 1
    `;
    if (!result.length) return null;
    return this.prisma.chatConversation.findUnique({
      where: { id: result[0].id },
      include: { participants: true },
    });
  }

  async findUserConversations(userId: string, search?: string) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        participants: {
          some: { userId, leftAt: null },
        },
      },
      include: {
        participants: {
          where: { leftAt: null },
        },
        messages: {
          where: { status: { not: MessageStatus.DELETED } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (search) {
      const q = search.toLowerCase();
      return conversations.filter((c) => {
        if (c.type === 'GROUP' && c.name) {
          return c.name.toLowerCase().includes(q);
        }
        return true; // DM: filter by user name in service
      });
    }
    return conversations;
  }

  async findConversationById(id: string) {
    return this.prisma.chatConversation.findUnique({
      where: { id },
      include: {
        participants: { where: { leftAt: null } },
      },
    });
  }

  // ─── Message queries ───

  async findMessages(
    conversationId: string,
    limit: number,
    cursor?: string,
  ) {
    const take = limit + 1;
    const items = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        replyTo: {
          select: { id: true, content: true, senderId: true, status: true },
        },
        reactions: {
          select: { emoji: true, userId: true },
        },
      },
    });

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async findMessageById(id: string) {
    return this.prisma.chatMessage.findUnique({ where: { id } });
  }

  // ─── Unread count ───

  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    const since = participant?.lastReadAt ?? new Date(0);

    return this.prisma.chatMessage.count({
      where: {
        conversationId,
        senderId: { not: userId },
        status: { not: MessageStatus.DELETED },
        createdAt: { gt: since },
      },
    });
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId, leftAt: null },
      select: { conversationId: true, lastReadAt: true },
    });

    let total = 0;
    for (const p of participants) {
      const since = p.lastReadAt ?? new Date(0);
      const count = await this.prisma.chatMessage.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: userId },
          status: { not: MessageStatus.DELETED },
          createdAt: { gt: since },
        },
      });
      total += count;
    }
    return total;
  }

  // ─── Participant queries ───

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const p = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!p && !p.leftAt;
  }

  async getParticipantRole(conversationId: string, userId: string): Promise<string | null> {
    const p = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!p || p.leftAt) return null;
    return p.role;
  }

  // ─── User search ───

  async searchUsers(query: string, limit: number, excludeId: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: excludeId },
        isActive: true,
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, fullName: true, email: true, role: true, branch: true },
      take: limit,
    });
  }
}
