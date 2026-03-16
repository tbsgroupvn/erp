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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { CompanyFeedService } from './company-feed.service';
import {
  CreatePostDto,
  UpdatePostDto,
  PostQueryDto,
  ReactPostDto,
  CreateCommentDto,
} from './dto/index';

@ApiTags('Company Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company-feed')
export class CompanyFeedController {
  constructor(private readonly feedService: CompanyFeedService) {}

  // ---------------------------------------------------------------------------
  // POSTS
  // ---------------------------------------------------------------------------

  @Post('posts')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.HR_MANAGER,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bài viết mới', description: 'Chỉ HR Manager, Director, CEO/COO mới được đăng bài.' })
  @ApiResponse({ status: 201, description: 'Bài viết được tạo thành công' })
  async createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const post = await this.feedService.createPost(user.id, dto);
    return BaseResponse.ok(post, 'Bài viết được tạo thành công');
  }

  @Get('posts')
  @ApiOperation({ summary: 'Danh sách bài viết', description: 'Lấy danh sách bài đã đăng với phân trang và bộ lọc danh mục.' })
  @ApiResponse({ status: 200, description: 'Danh sách bài viết' })
  async getPosts(@Query() query: PostQueryDto) {
    const result = await this.feedService.getPosts(query);
    return BaseResponse.ok(result);
  }

  @Get('posts/pinned')
  @ApiOperation({ summary: 'Bài viết được ghim', description: 'Trả về tối đa 5 bài viết đang được ghim.' })
  @ApiResponse({ status: 200, description: 'Danh sách bài ghim' })
  async getPinnedPosts() {
    const posts = await this.feedService.getPinnedPosts();
    return BaseResponse.ok(posts);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Chi tiết bài viết' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết bài viết' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async getPost(@Param('id') id: string) {
    const post = await this.feedService.getPost(id);
    return BaseResponse.ok(post);
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Cập nhật bài viết', description: 'Tác giả hoặc HR Manager/CEO có thể cập nhật.' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Bài viết được cập nhật' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const post = await this.feedService.updatePost(user.id, id, dto, user.role);
    return BaseResponse.ok(post, 'Bài viết được cập nhật');
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa bài viết (soft delete)', description: 'Tác giả hoặc HR Manager/CEO có thể xóa.' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Bài viết đã được xóa' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.feedService.deletePost(user.id, id, user.role);
    return BaseResponse.ok(result, 'Bài viết đã được xóa');
  }

  // ---------------------------------------------------------------------------
  // REACTIONS
  // ---------------------------------------------------------------------------

  @Post('posts/:id/react')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle reaction', description: 'Nếu đã react cùng type thì xóa, ngược lại thì thêm.' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Reaction được xử lý' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async reactToPost(
    @Param('id') id: string,
    @Body() dto: ReactPostDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.feedService.reactToPost(user.id, id, dto);
    return BaseResponse.ok(result);
  }

  // ---------------------------------------------------------------------------
  // COMMENTS
  // ---------------------------------------------------------------------------

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Danh sách bình luận', description: 'Lấy toàn bộ comments và replies của bài viết.' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Danh sách bình luận' })
  async getComments(@Param('id') id: string) {
    const comments = await this.feedService.getComments(id);
    return BaseResponse.ok(comments);
  }

  @Post('posts/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm bình luận', description: 'Có thể trả lời comment khác bằng cách điền parentId.' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({ status: 201, description: 'Bình luận được thêm' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài viết' })
  async createComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const comment = await this.feedService.createComment(user.id, id, dto);
    return BaseResponse.ok(comment, 'Bình luận được thêm');
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa bình luận (soft delete)', description: 'Tác giả hoặc HR Manager/CEO có thể xóa.' })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({ status: 200, description: 'Bình luận đã được xóa' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bình luận' })
  async deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.feedService.deleteComment(user.id, id, user.role);
    return BaseResponse.ok(result, 'Bình luận đã được xóa');
  }
}
