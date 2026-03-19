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
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ALL_ROLES } from '@core/rbac/roles.enum';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { WikiService } from './wiki.service';
import {
  CreateSpaceDto,
  UpdateSpaceDto,
  CreatePageDto,
  UpdatePageDto,
  MovePageDto,
  WikiQueryDto,
} from './dto/index';

@Roles(...ALL_ROLES)
@ApiTags('Wiki')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wiki')
export class WikiController {
  constructor(private readonly wikiService: WikiService) {}

  // ============================================================
  // SPACES
  // ============================================================

  @Get('spaces')
  @ApiOperation({ summary: 'Danh sách spaces', description: 'Trả về tất cả spaces user có quyền xem' })
  @ApiResponse({ status: 200, description: 'OK' })
  async getSpaces(@CurrentUser() user: ICurrentUser) {
    const spaces = await this.wikiService.getSpaces(user.id);
    return BaseResponse.ok(spaces);
  }

  @Post('spaces')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo space mới' })
  @ApiResponse({ status: 201, description: 'Space created' })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  async createSpace(@Body() dto: CreateSpaceDto, @CurrentUser() user: ICurrentUser) {
    const space = await this.wikiService.createSpace(user.id, dto);
    return BaseResponse.ok(space, 'Space đã được tạo');
  }

  @Get('spaces/:slug')
  @ApiOperation({ summary: 'Chi tiết space theo slug' })
  @ApiParam({ name: 'slug', description: 'Space slug' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Space không tồn tại' })
  async getSpaceBySlug(@Param('slug') slug: string) {
    const space = await this.wikiService.getSpaceBySlug(slug);
    return BaseResponse.ok(space);
  }

  @Patch('spaces/:id')
  @ApiOperation({ summary: 'Cập nhật space', description: 'Chỉ owner mới được chỉnh sửa' })
  @ApiParam({ name: 'id', description: 'Space ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Space không tồn tại' })
  async updateSpace(
    @Param('id') id: string,
    @Body() dto: UpdateSpaceDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const space = await this.wikiService.updateSpace(user.id, id, dto);
    return BaseResponse.ok(space, 'Space đã được cập nhật');
  }

  @Delete('spaces/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa space (cascade xóa tất cả pages)' })
  @ApiParam({ name: 'id', description: 'Space ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async deleteSpace(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.wikiService.deleteSpace(user.id, id);
    return BaseResponse.ok(result, 'Space đã được xóa');
  }

  // ============================================================
  // PAGES — Tree
  // ============================================================

  @Get('spaces/:spaceId/pages')
  @ApiOperation({ summary: 'Cây trang trong space' })
  @ApiParam({ name: 'spaceId', description: 'Space ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  async getPageTree(
    @Param('spaceId') spaceId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const tree = await this.wikiService.getPageTree(spaceId, user.id);
    return BaseResponse.ok(tree);
  }

  // ============================================================
  // PAGES — CRUD
  // ============================================================

  @Post('pages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo trang mới' })
  @ApiResponse({ status: 201, description: 'OK' })
  async createPage(@Body() dto: CreatePageDto, @CurrentUser() user: ICurrentUser) {
    const page = await this.wikiService.createPage(user.id, dto);
    return BaseResponse.ok(page, 'Trang đã được tạo');
  }

  @Get('pages/search')
  @ApiOperation({ summary: 'Tìm kiếm trang theo từ khóa' })
  @ApiQuery({ name: 'search', required: true, description: 'Từ khóa (min 2 ký tự)' })
  @ApiQuery({ name: 'spaceId', required: false, description: 'Giới hạn tìm trong space' })
  @ApiResponse({ status: 200, description: 'OK' })
  async searchPages(@Query() query: WikiQueryDto, @CurrentUser() user: ICurrentUser) {
    const results = await this.wikiService.searchPages(user.id, query);
    return BaseResponse.ok(results);
  }

  @Get('pages/:id')
  @ApiOperation({ summary: 'Chi tiết trang (tăng view count)' })
  @ApiParam({ name: 'id', description: 'Page ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Trang không tồn tại' })
  async getPage(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const page = await this.wikiService.getPage(user.id, id);
    return BaseResponse.ok(page);
  }

  @Patch('pages/:id')
  @ApiOperation({ summary: 'Cập nhật trang (tạo version mới)' })
  @ApiParam({ name: 'id', description: 'Page ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Trang không tồn tại' })
  async updatePage(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const page = await this.wikiService.updatePage(user.id, id, dto);
    return BaseResponse.ok(page, 'Trang đã được cập nhật');
  }

  @Delete('pages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa mềm trang' })
  @ApiParam({ name: 'id', description: 'Page ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async deletePage(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.wikiService.deletePage(user.id, id);
    return BaseResponse.ok(result, 'Trang đã được xóa');
  }

  @Patch('pages/:id/move')
  @ApiOperation({ summary: 'Di chuyển / reorder trang' })
  @ApiParam({ name: 'id', description: 'Page ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  async movePage(
    @Param('id') id: string,
    @Body() dto: MovePageDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const page = await this.wikiService.movePage(user.id, id, dto);
    return BaseResponse.ok(page, 'Trang đã được di chuyển');
  }

  // ============================================================
  // VERSIONS
  // ============================================================

  @Get('pages/:id/versions')
  @ApiOperation({ summary: 'Lịch sử phiên bản của trang' })
  @ApiParam({ name: 'id', description: 'Page ID' })
  @ApiResponse({ status: 200, description: 'OK' })
  async getVersions(@Param('id') id: string) {
    const versions = await this.wikiService.getVersions(id);
    return BaseResponse.ok(versions);
  }

  @Get('pages/:id/versions/:v')
  @ApiOperation({ summary: 'Lấy nội dung một phiên bản cụ thể (restore point)' })
  @ApiParam({ name: 'id', description: 'Page ID' })
  @ApiParam({ name: 'v', description: 'Số phiên bản' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 404, description: 'Phiên bản không tồn tại' })
  async getVersion(
    @Param('id') id: string,
    @Param('v', ParseIntPipe) v: number,
  ) {
    const version = await this.wikiService.getVersion(id, v);
    return BaseResponse.ok(version);
  }
}
