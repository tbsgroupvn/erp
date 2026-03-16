import { Module } from '@nestjs/common';
import { RateCardService } from './rate-card.service';
import { RateCardController } from './rate-card.controller';

@Module({
  controllers: [RateCardController],
  providers: [RateCardService],
  exports: [RateCardService],
})
export class RateCardModule {}
