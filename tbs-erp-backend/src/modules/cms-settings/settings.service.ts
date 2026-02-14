import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateSettingDto, UpdateSettingDto } from './dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSettingDto, updatedBy: string) {
    return this.prisma.siteSetting.create({
      data: {
        ...dto,
        updatedBy,
      },
    });
  }

  async findAll(group?: string) {
    const where = group ? { group } : {};

    return this.prisma.siteSetting.findMany({
      where,
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
  }

  async findByGroup(group: string) {
    return this.prisma.siteSetting.findMany({
      where: { group },
      orderBy: { order: 'asc' },
    });
  }

  async findByKey(key: string) {
    const setting = await this.prisma.siteSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    return setting;
  }

  async findPublicSettings() {
    return this.prisma.siteSetting.findMany({
      where: { isPublic: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
  }

  async update(key: string, dto: UpdateSettingDto, updatedBy: string) {
    await this.findByKey(key);

    return this.prisma.siteSetting.update({
      where: { key },
      data: {
        ...dto,
        updatedBy,
      },
    });
  }

  async updateMany(
    settings: { key: string; value: string }[],
    updatedBy: string,
  ) {
    await this.prisma.$transaction(
      settings.map((setting) =>
        this.prisma.siteSetting.update({
          where: { key: setting.key },
          data: {
            value: setting.value,
            updatedBy,
          },
        }),
      ),
    );

    return { success: true };
  }

  async delete(key: string) {
    await this.findByKey(key);

    return this.prisma.siteSetting.delete({
      where: { key },
    });
  }

  async getGroups() {
    const result = await this.prisma.siteSetting.groupBy({
      by: ['group'],
      _count: true,
      orderBy: { group: 'asc' },
    });

    return result.map((item) => ({
      group: item.group,
      count: item._count,
    }));
  }

  // Helper method to get typed value
  async getValue<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      const setting = await this.findByKey(key);
      return this.parseValue<T>(setting.value, setting.type);
    } catch {
      return defaultValue as T;
    }
  }

  private parseValue<T>(value: string, type: string): T {
    switch (type) {
      case 'number':
        return Number(value) as T;
      case 'boolean':
        return (value === 'true') as T;
      case 'json':
        return JSON.parse(value) as T;
      default:
        return value as T;
    }
  }
}
