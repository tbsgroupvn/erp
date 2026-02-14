import { Module } from '@nestjs/common';
import { DatabaseModule } from '@core/database/database.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class CmsPagesModule {}
