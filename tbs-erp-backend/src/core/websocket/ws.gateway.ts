import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@core/database/prisma.service';
import { wsError } from './ws-error.util';
import { ErrorCode } from '@common/exceptions';

/**
 * WebSocket gateway for real-time communication.
 *
 * Features:
 * - JWT authentication on connection handshake
 * - Auto-join rooms based on user identity (user, role, branch)
 * - Event-driven emissions from BullMQ processors via EventEmitter2
 * - Graceful reconnection handling
 *
 * Rooms:
 * - `user:{userId}` - private room for a specific user
 * - `role:{role}` - room for all users with a given role
 * - `branch:{branch}` - room for all users in a given branch
 *
 * Namespace: /ws
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'https://app.tbslogistics.com',
      'https://nhaphangchinhngach.vn',
    ],
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class WsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WsGateway.name);
  private connectedClients = new Map<
    string,
    { userId: string; role: string; branch: string | null; lastHeartbeat: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized on namespace /ws');
  }

  // ─── Connection Lifecycle ───

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token — disconnecting`);
        client.emit('error', wsError(ErrorCode.WS_AUTH_REQUIRED, 'Authentication required'));
        client.disconnect(true);
        return;
      }

      // Verify JWT
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Verify user is still active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true, role: true, branch: true },
      });

      if (!user || !user.isActive) {
        this.logger.warn(`Client ${client.id} has inactive/missing user — disconnecting`);
        client.emit('error', wsError(ErrorCode.WS_ACCOUNT_INACTIVE, 'User account is inactive or not found'));
        client.disconnect(true);
        return;
      }

      // Store client metadata
      this.connectedClients.set(client.id, {
        userId: user.id,
        role: user.role,
        branch: user.branch,
        lastHeartbeat: Date.now(),
      });

      // Join identity-based rooms
      client.join(`user:${user.id}`);
      client.join(`role:${user.role}`);
      if (user.branch) {
        client.join(`branch:${user.branch}`);
      }

      // Attach user info to socket data for later use
      (client as any).user = {
        id: user.id,
        role: user.role,
        branch: user.branch,
      };

      this.logger.log(
        `Client ${client.id} connected: user=${user.id}, role=${user.role}, branch=${user.branch}` +
          ` (total: ${this.connectedClients.size})`,
      );

      // Confirm successful connection
      client.emit('connected', {
        userId: user.id,
        role: user.role,
        branch: user.branch,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(`Client ${client.id} auth failed: ${error.message}`);
      client.emit('error', wsError(ErrorCode.WS_AUTH_FAILED, 'Authentication failed'));
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);

    this.logger.log(
      `Client ${client.id} disconnected` +
        (clientInfo ? ` (user=${clientInfo.userId})` : '') +
        ` (remaining: ${this.connectedClients.size})`,
    );
  }

  // ─── Message Handlers ───

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    const meta = this.connectedClients.get(client.id);
    if (meta) {
      meta.lastHeartbeat = Date.now();
    }
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @Cron('*/5 * * * *')
  cleanupStaleClients(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, meta] of this.connectedClients) {
      if (now - meta.lastHeartbeat > 60_000) {
        this.connectedClients.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} stale WebSocket client(s) (remaining: ${this.connectedClients.size})`);
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ): void {
    if (!data?.channel) {
      return;
    }

    // Validate channel format
    const validChannelPattern =
      /^(user:[a-zA-Z0-9]+|role:[a-zA-Z0-9_]+|branch:[a-zA-Z0-9_]+|dashboard)$/;
    if (!validChannelPattern.test(data.channel)) {
      client.emit('error', wsError(ErrorCode.WS_INVALID_CHANNEL, 'Invalid channel format'));
      this.logger.warn(
        `Client ${client.id} attempted to subscribe to invalid channel: ${data.channel}`,
      );
      return;
    }

    // BAC-04 fix: Verify the user is authorized for the requested channel
    const clientMeta = this.connectedClients.get(client.id);
    if (!clientMeta) {
      client.emit('error', wsError(ErrorCode.WS_AUTH_REQUIRED, 'Not authenticated'));
      return;
    }

    const [channelType, channelValue] = data.channel.split(':');
    if (channelType === 'user' && channelValue !== clientMeta.userId) {
      client.emit('error', wsError(ErrorCode.WS_UNAUTHORIZED_CHANNEL, "Cannot subscribe to another user's channel"));
      this.logger.warn(
        `Client ${client.id} (user:${clientMeta.userId}) attempted to subscribe to user:${channelValue}`,
      );
      return;
    }
    if (channelType === 'role' && channelValue !== clientMeta.role) {
      client.emit('error', wsError(ErrorCode.WS_UNAUTHORIZED_CHANNEL, 'Cannot subscribe to a role channel you do not belong to'));
      this.logger.warn(
        `Client ${client.id} (role:${clientMeta.role}) attempted to subscribe to role:${channelValue}`,
      );
      return;
    }
    if (channelType === 'branch' && channelValue !== clientMeta.branch) {
      client.emit('error', wsError(ErrorCode.WS_UNAUTHORIZED_CHANNEL, "Cannot subscribe to another branch's channel"));
      this.logger.warn(
        `Client ${client.id} (branch:${clientMeta.branch}) attempted to subscribe to branch:${channelValue}`,
      );
      return;
    }

    // Limit max 20 subscriptions per client
    if (client.rooms.size > 20) {
      client.emit('error', wsError(ErrorCode.WS_MAX_SUBSCRIPTIONS, 'Maximum subscription limit reached'));
      this.logger.warn(`Client ${client.id} exceeded max subscriptions (${client.rooms.size})`);
      return;
    }

    client.join(data.channel);
    this.logger.debug(`Client ${client.id} subscribed to channel: ${data.channel}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ): void {
    if (data?.channel) {
      client.leave(data.channel);
      this.logger.debug(`Client ${client.id} unsubscribed from channel: ${data.channel}`);
    }
  }

  // ─── Emission Methods (called by event processors) ───

  /**
   * Emit an event to a specific user.
   */
  emitToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      _timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit an event to all users with a specific role.
   */
  emitToRole(role: string, event: string, data: any): void {
    this.server.to(`role:${role}`).emit(event, {
      ...data,
      _timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit an event to all users in a specific branch.
   */
  emitToBranch(branch: string, event: string, data: any): void {
    this.server.to(`branch:${branch}`).emit(event, {
      ...data,
      _timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast an event to all connected clients.
   */
  emitToAll(event: string, data: any): void {
    this.server.emit(event, {
      ...data,
      _timestamp: new Date().toISOString(),
    });
  }

  // ─── Event Listeners (bridge from EventEmitter2 to WebSocket) ───

  @OnEvent('ws.emit.user')
  onEmitToUser(payload: { userId: string; event: string; data: any }): void {
    this.emitToUser(payload.userId, payload.event, payload.data);
  }

  @OnEvent('ws.emit.role')
  onEmitToRole(payload: { role: string; event: string; data: any }): void {
    this.emitToRole(payload.role, payload.event, payload.data);
  }

  @OnEvent('ws.emit.branch')
  onEmitToBranch(payload: { branch: string; event: string; data: any }): void {
    this.emitToBranch(payload.branch, payload.event, payload.data);
  }

  @OnEvent('ws.emit.all')
  onEmitToAll(payload: { event: string; data: any }): void {
    this.emitToAll(payload.event, payload.data);
  }

  @OnEvent('dashboard.update')
  onDashboardUpdate(payload: { type: string; data: any }): void {
    // Broadcast dashboard updates to all connected clients
    this.emitToAll('dashboard_update', payload);
  }

  // ─── Utility ───

  /**
   * Get the number of currently connected clients.
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get unique userIds of all currently connected clients.
   * Used by ChatController to report online status.
   */
  getOnlineUserIds(): string[] {
    const ids = new Set<string>();
    this.connectedClients.forEach((info) => ids.add(info.userId));
    return Array.from(ids);
  }

  /**
   * Get connected client info (for admin/monitoring).
   */
  getConnectedClients(): Array<{
    clientId: string;
    userId: string;
    role: string;
    branch: string | null;
  }> {
    return Array.from(this.connectedClients.entries()).map(([clientId, info]) => ({
      clientId,
      ...info,
    }));
  }
}
