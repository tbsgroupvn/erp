import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreatePageDto, UpdatePageDto, PageFiltersDto } from './dto';
import { PageStatus, Prisma } from '@prisma/client';
import { sanitizeHtml } from '@common/utils/html-sanitizer.util';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePageDto, authorId: string) {
    // Check if slug already exists
    const existing = await this.prisma.page.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Page with slug "${dto.slug}" already exists`);
    }

    return this.prisma.page.create({
      data: {
        ...dto,
        content: sanitizeHtml(dto.content),
        authorId,
        publishedAt: dto.status === PageStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async findAll(filters: PageFiltersDto) {
    const { status, search, parentId, page = 1, limit = 20 } = filters;

    const where: Prisma.PageWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (parentId !== undefined) {
      where.parentId = parentId === 'null' ? null : parentId;
    }

    const [data, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        include: {
          parent: {
            select: { id: true, title: true, slug: true },
          },
          children: {
            select: { id: true, title: true, slug: true },
          },
        },
      }),
      this.prisma.page.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, title: true, slug: true },
        },
        children: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    if (!page) {
      throw new NotFoundException(`Page with ID "${id}" not found`);
    }

    return page;
  }

  async findBySlug(slug: string) {
    const page = await this.prisma.page.findUnique({
      where: { slug },
      include: {
        parent: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    if (!page) {
      throw new NotFoundException(`Page with slug "${slug}" not found`);
    }

    // Only return published pages for public access
    if (page.status !== PageStatus.PUBLISHED) {
      throw new NotFoundException(`Page with slug "${slug}" not found`);
    }

    return page;
  }

  async update(id: string, dto: UpdatePageDto) {
    const page = await this.findOne(id);

    // Check slug conflict if changing slug
    if (dto.slug && dto.slug !== page.slug) {
      const existing = await this.prisma.page.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException(`Page with slug "${dto.slug}" already exists`);
      }
    }

    // Set publishedAt if changing status to PUBLISHED
    const publishedAt =
      dto.status === PageStatus.PUBLISHED && !page.publishedAt ? new Date() : page.publishedAt;

    return this.prisma.page.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.content != null ? { content: sanitizeHtml(dto.content) } : {}),
        publishedAt,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.page.delete({
      where: { id },
    });
  }

  async reorder(items: { id: string; order: number }[]) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.page.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    return { success: true };
  }

  async duplicate(id: string) {
    const page = await this.findOne(id);

    // Generate unique slug
    let newSlug = `${page.slug}-copy`;
    let counter = 1;
    while (await this.prisma.page.findUnique({ where: { slug: newSlug } })) {
      newSlug = `${page.slug}-copy-${counter}`;
      counter++;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      parent: _parent,
      children: _children,
      ...pageData
    } = page;

    return this.prisma.page.create({
      data: {
        ...pageData,
        slug: newSlug,
        title: `${page.title} (Copy)`,
        status: PageStatus.DRAFT,
        publishedAt: null,
      },
    });
  }
}
