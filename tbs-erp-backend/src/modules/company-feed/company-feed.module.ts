import { Module } from '@nestjs/common';
import { CompanyFeedController } from './company-feed.controller';
import { CompanyFeedService } from './company-feed.service';
import { CompanyFeedRepository } from './company-feed.repository';

@Module({
  controllers: [CompanyFeedController],
  providers: [CompanyFeedService, CompanyFeedRepository],
  exports: [CompanyFeedService],
})
export class CompanyFeedModule {}
