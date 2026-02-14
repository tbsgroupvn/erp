import { Module } from '@nestjs/common';
import { DatabaseModule } from '@core/database/database.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class CmsMenuModule {}
