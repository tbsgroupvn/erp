import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaEncryptionProvider } from './prisma-encryption.provider';
import { QueryAnalyzerService } from './query-analyzer.service';

@Global()
@Module({
  providers: [PrismaService, PrismaEncryptionProvider, QueryAnalyzerService],
  exports: [PrismaService, QueryAnalyzerService],
})
export class DatabaseModule {}
