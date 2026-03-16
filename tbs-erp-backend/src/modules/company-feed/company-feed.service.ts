import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { PostStatus, UserRole } from '@prisma/client';
import { CompanyFeedRepository } from './company-feed.repository';
import {
  CreatePostDto,
  UpdatePostDto,
  PostQueryDto,
  ReactPostDto,
  CreateCommentDto,
} from './dto/index';

@Injectable()
export class CompanyFeedService {
  private readonly logger = new Logger(CompanyFeedService.name);

  /** Roles được phép quản lý (sửa/xóa) bài viết của người khác */
  private readonly managerRoles: UserRole[] = [
    UserRole.CEO,
    UserRole.COO,
    UserRole.HR_MANAGER,
    UserRole.DIRECTOR_OPERATIONS,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CompanyFeedRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // POSTS
  // ---------------------------------------------------------------------------

  async createPost(userId: string, dto: CreatePostDto) {
    const now = new Date();
    const status = dto.publishNow ? PostStatus.PUBLISHED : PostStatus.DRAFT;
    const publishedAt = dto.publishNow ? now : null;

    const post = await this.prisma.companyPost.create({
      data: {
        title: dto.title,
        content: dto.content,
        excerpt: dto.excerpt,
        category: dto.category ?? 'GENERAL',
        status,
        isPinned: dto.isPinned ?? false,
        coverImage: dto.coverImage,
        authorId: userId,
        publishedAt,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
      include: {
        _count: { select: { reactions: true, comments: true } },
        reactions: { select: { type: true, userId: true } },
      },
    });

    this.logger.log(`Post "${post.title}" created by user ${userId}, status=${status}`);
    return post;
  }

  async updatePost(userId: string, postId: string, dto: UpdatePostDto, userRole: UserRole) {
    const post = await this.prisma.companyPost.findFirst({
      where: { id: postId, deletedAt: null },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    const isAuthor = post.authorId === userId;
    const isManager = this.managerRoles.includes(userRole);

    if (!isAuthor && !isManager) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này');
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.excerpt !== undefined) updateData.excerpt = dto.excerpt;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.isPinned !== undefined) updateData.isPinned = dto.isPinned;
    if (dto.coverImage !== undefined) updateData.coverImage = dto.coverImage;

    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === PostStatus.PUBLISHED && !post.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await this.prisma.companyPost.update({
      where: { id: postId },
      data: updateData,
      include: {
        _count: { select: { reactions: true, comments: true } },
        reactions: { select: { type: true, userId: true } },
      },
    });

    this.logger.log(`Post ${postId} updated by user ${userId}`);
    return updated;
  }

  async deletePost(userId: string, postId: string, userRole: UserRole) {
    const post = await this.prisma.companyPost.findFirst({
      where: { id: postId, deletedAt: null },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    const isAuthor = post.authorId === userId;
    const isManager = this.managerRoles.includes(userRole);

    if (!isAuthor && !isManager) {
      throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
    }

    await this.prisma.companyPost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Post ${postId} soft-deleted by user ${userId}`);
    return { success: true };
  }

  async getPosts(query: PostQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    return this.repo.findPosts({
      category: query.category,
      search: query.search,
      page,
      limit,
    });
  }

  async getPost(postId: string) {
    const post = await this.repo.findById(postId);

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    // Tăng view count bất đồng bộ, không block response
    this.prisma.companyPost
      .update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err: unknown) => this.logger.warn(`Failed to increment viewCount for post ${postId}: ${(err as Error).message}`));

    return post;
  }

  async getPinnedPosts() {
    return this.repo.findPinnedPosts();
  }

  // ---------------------------------------------------------------------------
  // REACTIONS
  // ---------------------------------------------------------------------------

  async reactToPost(userId: string, postId: string, dto: ReactPostDto) {
    // Kiểm tra post tồn tại
    const post = await this.prisma.companyPost.findFirst({
      where: { id: postId, deletedAt: null, status: PostStatus.PUBLISHED },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    // Toggle: nếu đã react cùng type thì xóa
    const existing = await this.repo.findReaction(postId, userId, dto.type);

    if (existing) {
      await this.prisma.postReaction.delete({ where: { id: existing.id } });
      this.logger.log(`User ${userId} removed reaction ${dto.type} from post ${postId}`);
      return { action: 'removed', type: dto.type };
    }

    // Upsert reaction (tạo mới, hoặc update nếu đã có unique constraint)
    await this.prisma.postReaction.upsert({
      where: {
        postId_userId_type: { postId, userId, type: dto.type },
      },
      create: { postId, userId, type: dto.type },
      update: { type: dto.type },
    });

    this.logger.log(`User ${userId} reacted ${dto.type} to post ${postId}`);
    return { action: 'added', type: dto.type };
  }

  // ---------------------------------------------------------------------------
  // COMMENTS
  // ---------------------------------------------------------------------------

  async getComments(postId: string) {
    const post = await this.prisma.companyPost.findFirst({
      where: { id: postId, deletedAt: null },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    return this.repo.findCommentsByPostId(postId);
  }

  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.companyPost.findFirst({
      where: { id: postId, deletedAt: null, status: PostStatus.PUBLISHED },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    // Nếu reply, kiểm tra parent tồn tại và cùng postId
    if (dto.parentId) {
      const parent = await this.repo.findCommentById(dto.parentId);
      if (!parent || parent.postId !== postId) {
        throw new NotFoundException(`Parent comment not found`);
      }
    }

    const comment = await this.prisma.postComment.create({
      data: {
        postId,
        authorId: userId,
        content: dto.content,
        parentId: dto.parentId ?? null,
      },
      include: {
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    this.logger.log(`User ${userId} commented on post ${postId}`);
    return comment;
  }

  async deleteComment(userId: string, commentId: string, userRole: UserRole) {
    const comment = await this.repo.findCommentById(commentId);

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    const isAuthor = comment.authorId === userId;
    const isManager = this.managerRoles.includes(userRole);

    if (!isAuthor && !isManager) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    await this.prisma.postComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Comment ${commentId} soft-deleted by user ${userId}`);
    return { success: true };
  }
}
