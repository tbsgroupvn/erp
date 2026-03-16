import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateMenuDto, UpdateMenuDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto';
import { MenuLocation, Prisma } from '@prisma/client';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async createMenu(dto: CreateMenuDto) {
    // Check if menu with this name and location exists
    const existing = await this.prisma.menu.findUnique({
      where: {
        name_location: {
          name: dto.name,
          location: dto.location,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Menu "${dto.name}" already exists for location "${dto.location}"`,
      );
    }

    return this.prisma.menu.create({
      data: dto,
    });
  }

  async findAllMenus() {
    return this.prisma.menu.findMany({
      take: 100,
      include: {
        items: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: {
            children: {
              orderBy: { order: 'asc' },
              include: {
                children: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMenuByLocation(location: MenuLocation, activeOnly = true) {
    const where: Prisma.MenuWhereInput = { location };
    if (activeOnly) {
      where.isActive = true;
    }

    const menu = await this.prisma.menu.findFirst({
      where,
      include: {
        items: {
          where: {
            parentId: null,
            ...(activeOnly && { isVisible: true }),
          },
          orderBy: { order: 'asc' },
          include: {
            children: {
              where: activeOnly ? { isVisible: true } : {},
              orderBy: { order: 'asc' },
              include: {
                children: {
                  where: activeOnly ? { isVisible: true } : {},
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    return menu;
  }

  async findMenu(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: {
        items: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: {
            children: {
              orderBy: { order: 'asc' },
              include: {
                children: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException(`Menu with ID "${id}" not found`);
    }

    return menu;
  }

  async updateMenu(id: string, dto: UpdateMenuDto) {
    await this.findMenu(id);

    return this.prisma.menu.update({
      where: { id },
      data: dto,
    });
  }

  async deleteMenu(id: string) {
    await this.findMenu(id);

    return this.prisma.menu.delete({
      where: { id },
    });
  }

  async createMenuItem(menuId: string, dto: CreateMenuItemDto) {
    await this.findMenu(menuId);

    // If parentId provided, verify it exists and belongs to this menu
    if (dto.parentId) {
      const parent = await this.prisma.menuItem.findFirst({
        where: {
          id: dto.parentId,
          menuId,
        },
      });

      if (!parent) {
        throw new NotFoundException(`Parent menu item "${dto.parentId}" not found`);
      }
    }

    return this.prisma.menuItem.create({
      data: {
        ...dto,
        menuId,
      },
    });
  }

  async findMenuItem(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Menu item with ID "${id}" not found`);
    }

    return item;
  }

  async updateMenuItem(id: string, dto: UpdateMenuItemDto) {
    const item = await this.findMenuItem(id);

    // If changing parent, verify new parent exists
    if (dto.parentId && dto.parentId !== item.parentId) {
      const parent = await this.prisma.menuItem.findFirst({
        where: {
          id: dto.parentId,
          menuId: item.menuId,
        },
      });

      if (!parent) {
        throw new NotFoundException(`Parent menu item "${dto.parentId}" not found`);
      }

      // Prevent circular reference
      if (dto.parentId === id) {
        throw new ConflictException('Menu item cannot be its own parent');
      }
    }

    return this.prisma.menuItem.update({
      where: { id },
      data: dto,
    });
  }

  async deleteMenuItem(id: string) {
    await this.findMenuItem(id);

    // This will cascade delete children
    return this.prisma.menuItem.delete({
      where: { id },
    });
  }

  async reorderMenuItems(items: { id: string; order: number; parentId?: string }[]) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.menuItem.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.parentId !== undefined && { parentId: item.parentId }),
          },
        }),
      ),
    );

    return { success: true };
  }
}
