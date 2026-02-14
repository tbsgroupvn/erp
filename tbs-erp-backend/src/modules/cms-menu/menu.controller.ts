import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import {
  CreateMenuDto,
  UpdateMenuDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/rbac/guards/roles.guard';
import { Roles } from '@core/rbac/decorators/roles.decorator';
import { MenuLocation } from '@prisma/client';

@Controller('cms/menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ============ Menu CRUD ============

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  createMenu(@Body() createMenuDto: CreateMenuDto) {
    return this.menuService.createMenu(createMenuDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findAllMenus() {
    return this.menuService.findAllMenus();
  }

  @Get('by-location/:location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findMenuByLocation(
    @Param('location') location: MenuLocation,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.menuService.findMenuByLocation(
      location,
      activeOnly !== 'false',
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findMenu(@Param('id') id: string) {
    return this.menuService.findMenu(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  updateMenu(@Param('id') id: string, @Body() updateMenuDto: UpdateMenuDto) {
    return this.menuService.updateMenu(id, updateMenuDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  deleteMenu(@Param('id') id: string) {
    return this.menuService.deleteMenu(id);
  }

  // ============ Menu Items CRUD ============

  @Post(':menuId/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  createMenuItem(
    @Param('menuId') menuId: string,
    @Body() createMenuItemDto: CreateMenuItemDto,
  ) {
    return this.menuService.createMenuItem(menuId, createMenuItemDto);
  }

  @Get('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findMenuItem(@Param('id') id: string) {
    return this.menuService.findMenuItem(id);
  }

  @Patch('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  updateMenuItem(
    @Param('id') id: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateMenuItem(id, updateMenuItemDto);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  deleteMenuItem(@Param('id') id: string) {
    return this.menuService.deleteMenuItem(id);
  }

  @Post('items/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  reorderMenuItems(
    @Body() body: { items: { id: string; order: number; parentId?: string }[] },
  ) {
    return this.menuService.reorderMenuItems(body.items);
  }
}
