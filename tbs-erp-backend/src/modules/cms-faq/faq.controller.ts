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
import { FaqService } from './faq.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/rbac/guards/roles.guard';
import { Roles } from '@/core/rbac/decorators/roles.decorator';
import { GetFaqDto, CreateFaqDto, UpdateFaqDto } from './dto';
import { AuthenticatedRequest } from '@common/interfaces/authenticated-request.interface';

@Controller('cms/faq')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findAll(@Query() query: GetFaqDto) {
    const { data, total } = await this.faqService.findAll(query);
    return { success: true, data, total };
  }

  @Get('stats')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async getStats() {
    const stats = await this.faqService.getStats();
    return { success: true, data: stats };
  }

  @Get(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findOne(@Param('id') id: string) {
    const data = await this.faqService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async create(@Body() dto: CreateFaqDto, @Request() req: AuthenticatedRequest) {
    const data = await this.faqService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const data = await this.faqService.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles('CEO', 'COO')
  async remove(@Param('id') id: string) {
    await this.faqService.remove(id);
    return { success: true, message: 'FAQ deleted successfully' };
  }

  @Patch(':id/publish')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async publish(@Param('id') id: string) {
    const data = await this.faqService.togglePublish(id, true);
    return { success: true, data };
  }

  @Patch(':id/unpublish')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async unpublish(@Param('id') id: string) {
    const data = await this.faqService.togglePublish(id, false);
    return { success: true, data };
  }

  @Post(':id/view')
  async incrementViews(@Param('id') id: string) {
    const data = await this.faqService.incrementViews(id);
    return { success: true, data };
  }
}
