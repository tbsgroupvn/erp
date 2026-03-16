import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WsGateway } from './ws.gateway';

/**
 * WebSocket module providing real-time communication capabilities.
 *
 * The WsGateway handles:
 * - Client connection/disconnection with JWT authentication
 * - Room-based message routing (user, role, branch)
 * - Bridge between EventEmitter2 events and WebSocket emissions
 *
 * This module uses the same JWT configuration as the REST API auth,
 * ensuring consistent authentication across HTTP and WebSocket connections.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn', '15m') as any,
        },
      }),
    }),
  ],
  providers: [WsGateway],
  exports: [WsGateway],
})
export class WsModule {}
