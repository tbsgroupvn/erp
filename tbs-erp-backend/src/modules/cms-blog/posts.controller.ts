import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CmsBlogService } from './cms-blog.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CreateBlogPostDto, UpdateBlogPostDto, BlogPostFiltersDto } from './dto';
import { AuthenticatedRequest } from '@common/interfaces/authenticated-request.interface';

@Controller('cms/blog/posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CmsBlogPostsController {
  constructor(private readonly cmsBlogService: CmsBlogService) {}

  @Get()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findAll(@Query() filters: BlogPostFiltersDto) {
    return this.cmsBlogService.getAllPosts(filters);
  }

  @Get(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findOne(@Param('id') id: string) {
    return this.cmsBlogService.getPostById(id);
  }

  @Post()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async create(@Body() dto: CreateBlogPostDto, @Request() req: AuthenticatedRequest) {
    return this.cmsBlogService.createPost(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.cmsBlogService.updatePost(id, dto);
  }

  @Delete(':id')
  @Roles('CEO', 'COO')
  async remove(@Param('id') id: string) {
    return this.cmsBlogService.deletePost(id);
  }

  @Post(':id/duplicate')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async duplicate(@Param('id') id: string) {
    return this.cmsBlogService.duplicatePost(id);
  }
}
