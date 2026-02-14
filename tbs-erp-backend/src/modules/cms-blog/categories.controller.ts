import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CmsBlogService } from './cms-blog.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/rbac/guards/roles.guard';
import { Roles } from '@/core/rbac/decorators/roles.decorator';
import { CreateBlogCategoryDto, UpdateBlogCategoryDto } from './dto';

@Controller('cms/blog/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CmsBlogCategoriesController {
  constructor(private readonly cmsBlogService: CmsBlogService) {}

  @Get()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findAll() {
    return this.cmsBlogService.getAllCategories();
  }

  @Get(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findOne(@Param('id') id: string) {
    return this.cmsBlogService.getCategoryById(id);
  }

  @Post()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async create(@Body() dto: CreateBlogCategoryDto) {
    return this.cmsBlogService.createCategory(dto);
  }

  @Patch(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async update(@Param('id') id: string, @Body() dto: UpdateBlogCategoryDto) {
    return this.cmsBlogService.updateCategory(id, dto);
  }

  @Delete(':id')
  @Roles('CEO', 'COO')
  async remove(@Param('id') id: string) {
    return this.cmsBlogService.deleteCategory(id);
  }
}
