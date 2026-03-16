import { Module } from '@nestjs/common';
import { CmsBlogCategoriesController } from './categories.controller';
import { CmsBlogPostsController } from './posts.controller';
import { CmsBlogCommentsController } from './comments.controller';
import { CmsBlogService } from './cms-blog.service';

@Module({
  controllers: [CmsBlogCategoriesController, CmsBlogPostsController, CmsBlogCommentsController],
  providers: [CmsBlogService],
  exports: [CmsBlogService],
})
export class CmsBlogModule {}
