import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateEmojiDto } from './dto/create-emoji.dto';

@Injectable()
export class EmojiService {
  private readonly logger = new Logger(EmojiService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customEmoji.findMany({
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateEmojiDto, uploadedBy: string) {
    const existing = await this.prisma.customEmoji.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Emoji "${dto.name}" đã tồn tại`);
    }

    const emoji = await this.prisma.customEmoji.create({
      data: {
        name: dto.name,
        imageUrl: dto.imageUrl,
        category: dto.category ?? 'general',
        uploadedBy,
      },
    });

    this.logger.log(`Custom emoji created: ${emoji.name} by ${uploadedBy}`);
    return emoji;
  }

  async remove(id: string): Promise<void> {
    const emoji = await this.prisma.customEmoji.findUnique({ where: { id } });
    if (!emoji) {
      throw new NotFoundException(`Emoji ${id} không tồn tại`);
    }

    await this.prisma.customEmoji.delete({ where: { id } });
    this.logger.log(`Custom emoji deleted: ${emoji.name}`);
  }

  async incrementUsage(id: string) {
    const emoji = await this.prisma.customEmoji.findUnique({ where: { id } });
    if (!emoji) {
      throw new NotFoundException(`Emoji ${id} không tồn tại`);
    }

    return this.prisma.customEmoji.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }
}
