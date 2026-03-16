import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { PostCategory, PostStatus } from '@prisma/client';

@Injectable()
export class CompanyFeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPosts(params: {
    category?: PostCategory;
    search?: string;
    page: number;
    limit: number;
    authorId?: string;
  }) {
    const { category, search, page, limit, authorId } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      status: PostStatus.PUBLISHED,
      deletedAt: null,
    };

    if (category) where.category = category;
    if (authorId) where.authorId = authorId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.companyPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        include: {
          _count: { select: { reactions: true, comments: true } },
          reactions: { select: { type: true, userId: true } },
        },
      }),
      this.prisma.companyPost.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    return this.prisma.companyPost.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { reactions: true, comments: true } },
        reactions: { select: { type: true, userId: true } },
        comments: {
          where: { deletedAt: null, parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            replies: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  }

  async findPinnedPosts() {
    return this.prisma.companyPost.findMany({
      where: {
        isPinned: true,
        status: PostStatus.PUBLISHED,
        deletedAt: null,
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });
  }

  async findCommentsByPostId(postId: string) {
    return this.prisma.postComment.findMany({
      where: { postId, deletedAt: null, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findCommentById(id: string) {
    return this.prisma.postComment.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findReaction(postId: string, userId: string, type: string) {
    return this.prisma.postReaction.findFirst({
      where: { postId, userId, type: type as any },
    });
  }
}
