import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/rbac/guards/roles.guard';
import { Roles } from '@/core/rbac/decorators/roles.decorator';
import { GetNewsletterDto } from './dto';

@ApiTags('CMS - Newsletter')
@ApiBearerAuth()
@Controller('cms/newsletter')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  @ApiOperation({ summary: 'List newsletter subscribers' })
  async findAll(@Query() query: GetNewsletterDto) {
    const { data, total } = await this.newsletterService.findAll(query);
    return { success: true, data, total };
  }

  @Get('stats')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  @ApiOperation({ summary: 'Get newsletter statistics' })
  async getStats() {
    const stats = await this.newsletterService.getStats();
    return { success: true, data: stats };
  }

  @Get(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findOne(@Param('id') id: string) {
    const data = await this.newsletterService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id/unsubscribe')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async unsubscribe(@Param('id') id: string) {
    const data = await this.newsletterService.unsubscribe(id);
    return { success: true, data };
  }

  @Get('export/excel')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 exports per minute
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async exportToExcel() {
    // TODO: Implement Excel export
    return { success: true, message: 'Export feature coming soon' };
  }

  @Delete(':id')
  @Roles('CEO', 'COO')
  async remove(@Param('id') id: string) {
    await this.newsletterService.remove(id);
    return { success: true, message: 'Subscriber deleted successfully' };
  }
}
