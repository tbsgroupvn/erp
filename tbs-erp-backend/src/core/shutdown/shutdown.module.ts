import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { GracefulShutdownService } from './graceful-shutdown.service';

/**
 * Shutdown module that registers the GracefulShutdownService.
 *
 * Imports DiscoveryModule to enable DiscoveryService injection,
 * which is used to find all WorkerHost instances at shutdown time.
 *
 * Import this module in AppModule to enable graceful shutdown.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [GracefulShutdownService],
  exports: [GracefulShutdownService],
})
export class ShutdownModule {}
