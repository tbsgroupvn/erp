import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { BlogService } from './blog.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { BlogPostQueryDto } from './dto/blog-post-query.dto';

@ApiTags('Blog')
@Controller('blog-posts')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CEO, UserRole.COO, UserRole.MARKETING_STAFF)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new blog post',
    description: 'Creates a new blog post with auto-generated slug. Requires JWT authentication.',
  })
  @ApiResponse({ status: 201, description: 'Blog post created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() dto: CreateBlogPostDto) {
    const blogPost = await this.blogService.create(dto);
    return BaseResponse.ok(blogPost, 'Blog post created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List blog posts',
    description:
      'Returns paginated blog posts with filtering by status, tag, and search. Public endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Blog posts retrieved successfully' })
  async findAll(@Query() query: BlogPostQueryDto) {
    const result = await this.blogService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page || 1,
      result.limit || 10,
    );
  }

  @Get('tags')
  @ApiOperation({
    summary: 'Get all unique tags',
    description: 'Returns a list of all unique tags from published blog posts. Public endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Tags retrieved successfully' })
  async getAllTags() {
    const tags = await this.blogService.getAllTags();
    return BaseResponse.ok(tags);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get blog post by slug',
    description: 'Returns a single blog post by its slug. Public endpoint.',
  })
  @ApiParam({ name: 'slug', description: 'Blog post slug', example: 'how-to-optimize-logistics' })
  @ApiResponse({ status: 200, description: 'Blog post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async findBySlug(@Param('slug') slug: string) {
    const blogPost = await this.blogService.findBySlug(slug);
    return BaseResponse.ok(blogPost);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CEO, UserRole.COO, UserRole.MARKETING_STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a blog post',
    description:
      'Updates an existing blog post. Slug is auto-regenerated if title changes. Requires JWT authentication.',
  })
  @ApiParam({ name: 'id', description: 'Blog post ID' })
  @ApiResponse({ status: 200, description: 'Blog post updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    const blogPost = await this.blogService.update(id, dto);
    return BaseResponse.ok(blogPost, 'Blog post updated successfully');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CEO, UserRole.COO)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a blog post',
    description: 'Permanently deletes a blog post. Requires JWT authentication.',
  })
  @ApiParam({ name: 'id', description: 'Blog post ID' })
  @ApiResponse({ status: 200, description: 'Blog post deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  async remove(@Param('id') id: string) {
    const result = await this.blogService.remove(id);
    return BaseResponse.ok(result);
  }

  @Post('upload-cover')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 uploads per minute
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CEO, UserRole.COO, UserRole.MARKETING_STAFF)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload cover image',
    description: 'Uploads a cover image for blog posts. Requires JWT authentication.',
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Basic validation
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed (jpg, jpeg, png, gif, webp)');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `cover-${uniqueSuffix}${ext}`;

    // In a real implementation, you would save the file here
    // For now, return a mock URL
    const fileUrl = `/uploads/blog/${filename}`;
    return BaseResponse.ok({ url: fileUrl }, 'Image uploaded successfully');
  }
}
