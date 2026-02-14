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
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '@/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/rbac/guards/roles.guard';
import { Roles } from '@/core/rbac/decorators/roles.decorator';
import { GetContactsDto } from './dto';

@ApiTags('CMS - Contacts')
@ApiBearerAuth()
@Controller('cms/contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  @ApiOperation({ summary: 'List contact submissions' })
  async findAll(@Query() query: GetContactsDto) {
    const { data, total } = await this.contactsService.findAll(query);
    return { success: true, data, total };
  }

  @Get('stats')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) // Cache for 60 seconds
  @ApiOperation({ summary: 'Get contact submission statistics' })
  async getStats() {
    const stats = await this.contactsService.getStats();
    return { success: true, data: stats };
  }

  @Get('export/excel')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async exportToExcel(@Query() query: GetContactsDto) {
    // TODO: Implement Excel export
    return { success: true, message: 'Export feature coming soon' };
  }

  @Get(':id')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async findOne(@Param('id') id: string) {
    const data = await this.contactsService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id/read')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async markAsRead(@Param('id') id: string) {
    const data = await this.contactsService.updateStatus(id, 'READ');
    return { success: true, data };
  }

  @Patch(':id/replied')
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  async markAsReplied(@Param('id') id: string) {
    const data = await this.contactsService.updateStatus(id, 'REPLIED');
    return { success: true, data };
  }

  @Delete(':id')
  @Roles('CEO', 'COO')
  async remove(@Param('id') id: string) {
    await this.contactsService.remove(id);
    return { success: true, message: 'Contact deleted successfully' };
  }
}
