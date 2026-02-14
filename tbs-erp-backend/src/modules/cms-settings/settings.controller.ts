import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto, UpdateSettingDto } from './dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/rbac/guards/roles.guard';
import { Roles } from '@core/rbac/decorators/roles.decorator';
import { AuthenticatedRequest } from '@common/interfaces/authenticated-request.interface';

@Controller('cms/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  create(@Body() createSettingDto: CreateSettingDto, @Request() req: AuthenticatedRequest) {
    return this.settingsService.create(createSettingDto, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findAll(@Query('group') group?: string) {
    return this.settingsService.findAll(group);
  }

  @Get('groups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  getGroups() {
    return this.settingsService.getGroups();
  }

  @Get('group/:group')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findByGroup(@Param('group') group: string) {
    return this.settingsService.findByGroup(group);
  }

  @Get(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  update(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.settingsService.update(key, updateSettingDto, req.user.id);
  }

  @Post('batch-update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  updateMany(
    @Body() body: { settings: { key: string; value: string }[] },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.settingsService.updateMany(body.settings, req.user.id);
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  delete(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }
}
