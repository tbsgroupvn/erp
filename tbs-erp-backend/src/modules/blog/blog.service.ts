import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { BlogPostStatus, Prisma } from '@prisma/client';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { BlogPostQueryDto } from './dto/blog-post-query.dto';

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a URL-friendly slug from the title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .substring(0, 255); // Limit to max length
  }

  /**
   * Ensure slug is unique by appending a number if needed
   */
  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.blogPost.findUnique({
        where: { slug },
        select: { id: true },
      });

      // If no conflict or it's the same post being updated, we're good
      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }

      // Append counter and try again
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Create a new blog post
   */
  async create(dto: CreateBlogPostDto) {
    // Generate slug from title
    const baseSlug = this.generateSlug(dto.title);
    const slug = await this.ensureUniqueSlug(baseSlug);

    // If status is PUBLISHED, set publishedAt
    const publishedAt = dto.status === BlogPostStatus.PUBLISHED ? new Date() : null;

    const blogPost = await this.prisma.blogPost.create({
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImage: dto.coverImage,
        authorId: 'system', // Placeholder - will be updated when auth is integrated
        authorName: dto.author,
        tags: dto.tags || [],
        status: dto.status || BlogPostStatus.DRAFT,
        publishedAt,
      },
    });

    this.logger.log(`Blog post created: ${blogPost.slug} (ID: ${blogPost.id})`);
    return blogPost;
  }

  /**
   * Find all blog posts with pagination and filters
   */
  async findAll(query: BlogPostQueryDto) {
    const where: Prisma.BlogPostWhereInput = {};

    // Filter by status
    if (query.status) {
      where.status = query.status;
    }

    // Filter by tag
    if (query.tag) {
      where.tags = { has: query.tag };
    }

    // Search functionality
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Build order by clause
    const orderBy: Prisma.BlogPostOrderByWithRelationInput = {};
    if (query.sortBy === 'publishedAt') {
      orderBy.publishedAt = query.sortOrder;
    } else if (query.sortBy === 'createdAt') {
      orderBy.createdAt = query.sortOrder;
    } else if (query.sortBy === 'title') {
      orderBy.title = query.sortOrder;
    }

    // Execute query with pagination
    const [data, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    const limit = query.limit || 10;
    const page = query.page || 1;

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a blog post by slug (public endpoint)
   */
  async findBySlug(slug: string) {
    const blogPost = await this.prisma.blogPost.findUnique({
      where: { slug },
    });

    if (!blogPost) {
      throw new NotFoundException(`Blog post with slug "${slug}" not found`);
    }

    return blogPost;
  }

  /**
   * Find a blog post by ID
   */
  async findById(id: string) {
    const blogPost = await this.prisma.blogPost.findUnique({
      where: { id },
    });

    if (!blogPost) {
      throw new NotFoundException(`Blog post with ID "${id}" not found`);
    }

    return blogPost;
  }

  /**
   * Update a blog post
   */
  async update(id: string, dto: UpdateBlogPostDto) {
    // Check if post exists
    const existing = await this.findById(id);

    const updateData: Prisma.BlogPostUpdateInput = {};

    // If title is updated, regenerate slug
    if (dto.title && dto.title !== existing.title) {
      const baseSlug = this.generateSlug(dto.title);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, id);
      updateData.title = dto.title;
    }

    if (dto.excerpt !== undefined) {
      updateData.excerpt = dto.excerpt;
    }

    if (dto.content !== undefined) {
      updateData.content = dto.content;
    }

    if (dto.coverImage !== undefined) {
      updateData.coverImage = dto.coverImage;
    }

    if (dto.author !== undefined) {
      updateData.authorName = dto.author;
    }

    if (dto.tags !== undefined) {
      updateData.tags = dto.tags;
    }

    // Handle status change
    if (dto.status !== undefined && dto.status !== existing.status) {
      updateData.status = dto.status;

      // If changing from DRAFT to PUBLISHED, set publishedAt
      if (dto.status === BlogPostStatus.PUBLISHED && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Blog post updated: ${updated.slug} (ID: ${id})`);
    return updated;
  }

  /**
   * Delete a blog post
   */
  async remove(id: string) {
    // Check if post exists
    await this.findById(id);

    await this.prisma.blogPost.delete({
      where: { id },
    });

    this.logger.log(`Blog post deleted: ID ${id}`);
    return { message: 'Blog post deleted successfully' };
  }

  /**
   * Get all unique tags
   */
  async getAllTags() {
    const posts = await this.prisma.blogPost.findMany({
      where: {
        status: BlogPostStatus.PUBLISHED,
      },
      select: {
        tags: true,
      },
      take: 5000,
    });

    const tagsSet = new Set<string>();
    posts.forEach((post) => {
      post.tags.forEach((tag) => tagsSet.add(tag));
    });

    return Array.from(tagsSet).sort();
  }
}
