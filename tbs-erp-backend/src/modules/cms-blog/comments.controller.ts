import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CmsBlogService } from './cms-blog.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/rbac/guards/roles.guard';
import { Roles } from '@/core/rbac/decorators/roles.decorator';
import { BlogCommentFiltersDto } from './dto';

@Controller('cms/blog/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CmsBlogCommentsController {
  constructor(private readonly cmsBlogService: CmsBlogService) {}

  @Get()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findAll(@Query() filters: BlogCommentFiltersDto) {
    return this.cmsBlogService.getAllComments(filters);
  }

  @Get(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findOne(@Param('id') id: string) {
    return this.cmsBlogService.getCommentById(id);
  }

  @Patch(':id/approve')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async approve(@Param('id') id: string) {
    return this.cmsBlogService.approveComment(id);
  }

  @Patch(':id/reject')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async reject(@Param('id') id: string) {
    return this.cmsBlogService.rejectComment(id);
  }

  @Delete(':id')
  @Roles('CEO', 'COO')
  async remove(@Param('id') id: string) {
    return this.cmsBlogService.deleteComment(id);
  }
}
