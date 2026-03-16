import { Module } from '@nestjs/common';
import { WikiController } from './wiki.controller';
import { WikiService } from './wiki.service';
import { WikiRepository } from './wiki.repository';

@Module({
  controllers: [WikiController],
  providers: [WikiService, WikiRepository],
  exports: [WikiService],
})
export class WikiModule {}
