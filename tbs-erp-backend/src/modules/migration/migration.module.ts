import { Module } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

/**
 * Migration Module
 *
 * This module provides migration utilities and scripts for data migration tasks.
 * Scripts are run via CLI and not exposed as HTTP endpoints.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class MigrationModule {}
