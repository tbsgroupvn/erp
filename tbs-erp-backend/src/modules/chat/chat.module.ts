import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { ChatGateway } from './chat.gateway';
import { WsModule } from '@core/websocket/ws.module';

/**
 * ChatModule provides real-time messaging (DM + Group) via REST + WebSocket.
 *
 * Circular dep: ChatService <-> ChatGateway resolved with forwardRef()
 * at constructor injection level in each class.
 *
 * Imports WsModule to access WsGateway.getOnlineUserIds() in ChatController.
 */
@Module({
  imports: [WsModule],
  controllers: [ChatController],
  providers: [ChatRepository, ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
