import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { QueryAnalyzerService } from './query-analyzer.service';

@Global()
@Module({
  providers: [PrismaService, QueryAnalyzerService],
  exports: [PrismaService, QueryAnalyzerService],
})
export class DatabaseModule {}
