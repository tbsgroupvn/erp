import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class InteractionNoteService {
  private readonly logger = new Logger(InteractionNoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * CSKH-5: Create a quick interaction note for a customer.
   *
   * Used for pasting conversation snippets from Zalo, WeChat, etc.
   */
  async create(customerId: string, content: string, channel: string, createdBy: string) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const note = await this.prisma.customerInteractionNote.create({
      data: {
        customerId,
        content,
        channel,
        createdBy,
      },
    });

    this.logger.log(
      `Interaction note created for customer ${customer.code} via ${channel} by ${createdBy}`,
    );

    return note;
  }

  /**
   * CSKH-5: Get paginated interaction notes for a customer, newest first.
   */
  async findByCustomer(customerId: string, page: number = 1, limit: number = 20) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerInteractionNote.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerInteractionNote.count({
        where: { customerId },
      }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * CSKH-5: Delete an interaction note.
   */
  async delete(id: string) {
    const note = await this.prisma.customerInteractionNote.findUnique({
      where: { id },
    });

    if (!note) {
      throw new NotFoundException(`Interaction note with ID ${id} not found`);
    }

    await this.prisma.customerInteractionNote.delete({
      where: { id },
    });

    this.logger.log(`Interaction note ${id} deleted`);

    return { deleted: true };
  }
}
