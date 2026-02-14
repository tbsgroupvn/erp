import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateBlogCategoryDto,
  UpdateBlogCategoryDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
  BlogPostFiltersDto,
  BlogCommentFiltersDto,
} from './dto';

@Injectable()
export class CmsBlogService {
  constructor(private prisma: PrismaService) {}

  // ========== CATEGORIES ==========
  async getAllCategories() {
    const categories = await this.prisma.blogCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        parent: true,
        children: true,
        _count: { select: { posts: true } },
      },
    });
    return { data: categories };
  }

  async getCategoryById(id: string) {
    const category = await this.prisma.blogCategory.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: { select: { posts: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return { data: category };
  }

  async createCategory(dto: CreateBlogCategoryDto) {
    const category = await this.prisma.blogCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parentId: dto.parentId,
        order: dto.order ?? 0,
      },
    });
    return { data: category };
  }

  async updateCategory(id: string, dto: UpdateBlogCategoryDto) {
    await this.getCategoryById(id);

    const category = await this.prisma.blogCategory.update({
      where: { id },
      data: dto,
    });
    return { data: category };
  }

  async deleteCategory(id: string) {
    await this.getCategoryById(id);

    await this.prisma.blogCategory.delete({
      where: { id },
    });
    return { success: true, message: 'Category deleted successfully' };
  }

  // ========== POSTS ==========
  async getAllPosts(filters: BlogPostFiltersDto) {
    const { status, categoryId, search, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.BlogPostWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { data, total };
  }

  async getPostById(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Blog post with ID "${id}" not found`);
    }

    return { data: post };
  }

  async createPost(dto: CreateBlogPostDto, userId: string) {
    // Get user info for authorName
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    const post = await this.prisma.blogPost.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        content: dto.content,
        excerpt: dto.excerpt,
        coverImage: dto.featuredImage,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        metaKeywords: dto.metaKeywords || [],
        status: dto.status || 'DRAFT',
        categoryId: dto.categoryId,
        authorId: userId,
        authorName: user?.fullName || 'Unknown',
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
    });
    return { data: post };
  }

  async updatePost(id: string, dto: UpdateBlogPostDto) {
    await this.getPostById(id);

    const updateData: any = { ...dto };

    // If changing to PUBLISHED and no publishedAt, set it
    if (dto.status === 'PUBLISHED') {
      const existing = await this.prisma.blogPost.findUnique({
        where: { id },
        select: { publishedAt: true },
      });
      if (!existing?.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const post = await this.prisma.blogPost.update({
      where: { id },
      data: updateData,
    });
    return { data: post };
  }

  async deletePost(id: string) {
    await this.getPostById(id);

    await this.prisma.blogPost.delete({
      where: { id },
    });
    return { success: true, message: 'Blog post deleted successfully' };
  }

  async duplicatePost(id: string) {
    const original = await this.prisma.blogPost.findUnique({
      where: { id },
    });

    if (!original) {
      throw new NotFoundException(`Blog post with ID "${id}" not found`);
    }

    const post = await this.prisma.blogPost.create({
      data: {
        title: `${original.title} (Copy)`,
        slug: `${original.slug}-copy-${Date.now()}`,
        content: original.content,
        excerpt: original.excerpt,
        coverImage: original.coverImage,
        metaTitle: original.metaTitle,
        metaDescription: original.metaDescription,
        metaKeywords: original.metaKeywords,
        status: 'DRAFT',
        categoryId: original.categoryId,
        authorId: original.authorId,
        authorName: original.authorName,
      },
    });
    return { data: post };
  }

  // ========== COMMENTS ==========
  async getAllComments(filters: BlogCommentFiltersDto) {
    const { status, postId, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.BlogCommentWhereInput = {};

    // Map status filter to isApproved boolean
    if (status === 'APPROVED') {
      where.isApproved = true;
    } else if (status === 'PENDING') {
      where.isApproved = false;
    }
    // 'REJECTED' - we'll need to add a separate field or handle differently

    if (postId) {
      where.postId = postId;
    }

    const [comments, total] = await Promise.all([
      this.prisma.blogComment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.blogComment.count({ where }),
    ]);

    // Fetch post titles for each comment
    const postIds = [...new Set(comments.map(c => c.postId))];
    const posts = await this.prisma.blogPost.findMany({
      where: { id: { in: postIds } },
      select: { id: true, title: true, slug: true },
    });
    const postMap = new Map(posts.map(p => [p.id, p]));

    // Map comments with post data and computed status
    const data = comments.map(comment => ({
      ...comment,
      status: comment.isApproved ? 'APPROVED' : 'PENDING',
      post: postMap.get(comment.postId),
    }));

    return { data, total };
  }

  async getCommentById(id: string) {
    const comment = await this.prisma.blogComment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID "${id}" not found`);
    }

    // Fetch post data
    const post = await this.prisma.blogPost.findUnique({
      where: { id: comment.postId },
      select: { id: true, title: true, slug: true },
    });

    return {
      data: {
        ...comment,
        status: comment.isApproved ? 'APPROVED' : 'PENDING',
        post,
      },
    };
  }

  async approveComment(id: string) {
    await this.getCommentById(id);

    const comment = await this.prisma.blogComment.update({
      where: { id },
      data: { isApproved: true },
    });
    return {
      data: {
        ...comment,
        status: 'APPROVED',
      },
    };
  }

  async rejectComment(id: string) {
    await this.getCommentById(id);

    const comment = await this.prisma.blogComment.update({
      where: { id },
      data: { isApproved: false },
    });
    return {
      data: {
        ...comment,
        status: 'REJECTED',
      },
    };
  }

  async deleteComment(id: string) {
    await this.getCommentById(id);

    await this.prisma.blogComment.delete({
      where: { id },
    });
    return { success: true, message: 'Comment deleted successfully' };
  }
}
