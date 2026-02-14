import { Module } from '@nestjs/common';
import { DatabaseModule } from '@core/database/database.module';
import { PublicController } from './public.controller';
import { PublicCmsController } from './public-cms.controller';
import { PublicService } from './public.service';
import { CrmModule } from '@modules/crm/crm.module';
import { CmsPagesModule } from '@modules/cms-pages/cms-pages.module';
import { CmsMenuModule } from '@modules/cms-menu/cms-menu.module';
import { CmsSettingsModule } from '@modules/cms-settings/cms-settings.module';

@Module({
  imports: [
    DatabaseModule,
    CrmModule,
    CmsPagesModule,
    CmsMenuModule,
    CmsSettingsModule,
  ],
  controllers: [PublicController, PublicCmsController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
