import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, forwardRef, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

/**
 * Chat gateway — shares the /ws namespace with WsGateway.
 * Client must be authenticated (WsGateway sets client.user on connection).
 *
 * Client emits:
 *   chat:join          { conversationId } — join room to receive messages
 *   chat:typing:start  { conversationId }
 *   chat:typing:stop   { conversationId }
 *   chat:mark:read     { conversationId }
 *
 * Server emits:
 *   chat:message:new      → room chat:{conversationId}
 *   chat:message:edited   → room chat:{conversationId}
 *   chat:message:deleted  → room chat:{conversationId}
 *   chat:typing           → room chat:{conversationId}
 *   chat:conversation:created → room user:{userId}
 *   chat:unread:update    → room user:{userId}
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'https://app.tbslogistics.com',
      'https://nhaphangchinhngach.vn',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /** Track online users: userId -> timeout handle for 35s expiry */
  private onlineUsers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  afterInit() {
    this.logger.log('ChatGateway initialized on /ws namespace');
  }

  // ─── Presence ───

  handleOnline(client: Socket) {
    const user = (client as any).user;
    if (!user) return;

    const existing = this.onlineUsers.get(user.id);
    if (existing) clearTimeout(existing);

    this.onlineUsers.set(
      user.id,
      setTimeout(() => {
        this.onlineUsers.delete(user.id);
        this.server.emit('chat:presence', { userId: user.id, online: false });
      }, 35_000),
    );

    this.server.emit('chat:presence', { userId: user.id, online: true });
  }

  @SubscribeMessage('chat:heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    this.handleOnline(client);
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  // ─── Handlers ───

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = (client as any).user;
    if (!user || !data?.conversationId) return;

    const room = `chat:${data.conversationId}`;
    client.join(room);
    this.logger.debug(`User ${user.id} joined room ${room}`);
  }

  @SubscribeMessage('chat:typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = (client as any).user;
    if (!user || !data?.conversationId) return;

    this.server.to(`chat:${data.conversationId}`).emit('chat:typing', {
      conversationId: data.conversationId,
      userId: user.id,
      isTyping: true,
    });
  }

  @SubscribeMessage('chat:typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = (client as any).user;
    if (!user || !data?.conversationId) return;

    this.server.to(`chat:${data.conversationId}`).emit('chat:typing', {
      conversationId: data.conversationId,
      userId: user.id,
      isTyping: false,
    });
  }

  @SubscribeMessage('chat:mark:read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = (client as any).user;
    if (!user || !data?.conversationId) return;

    await this.chatService.markAsRead(data.conversationId, user.id);
  }

  // ─── Emit helpers (called by ChatService) ───

  emitToConversation(conversationId: string, event: string, data: any) {
    this.server.to(`chat:${conversationId}`).emit(event, {
      ...data,
      _timestamp: new Date().toISOString(),
    });
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      _timestamp: new Date().toISOString(),
    });
  }
}
