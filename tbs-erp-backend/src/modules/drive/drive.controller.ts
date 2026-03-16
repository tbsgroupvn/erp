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
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { DriveService } from './drive.service';
import {
  CreateFolderDto,
  RenameFolderDto,
  RequestUploadDto,
  ConfirmUploadDto,
  MoveFileDto,
  ShareFileDto,
  FileQueryDto,
  SearchFilesDto,
  RequestNewVersionDto,
  ConfirmNewVersionDto,
} from './dto';

@ApiTags('Drive')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  // ─────────────────────────────────────────────
  // FOLDERS
  // ─────────────────────────────────────────────

  @Get('folders')
  @ApiOperation({ summary: 'Lấy danh sách thư mục (tree)' })
  async getFolders(
    @CurrentUser() user: ICurrentUser,
    @Query('parentId') parentId?: string,
  ) {
    const folders = await this.driveService.getFolders(user.id, parentId || undefined);
    return BaseResponse.ok(folders);
  }

  @Post('folders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo thư mục mới' })
  async createFolder(@Body() dto: CreateFolderDto, @CurrentUser() user: ICurrentUser) {
    const folder = await this.driveService.createFolder(user.id, dto);
    return BaseResponse.ok(folder, 'Tạo thư mục thành công');
  }

  @Patch('folders/:id')
  @ApiOperation({ summary: 'Đổi tên thư mục' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  async renameFolder(
    @Param('id') id: string,
    @Body() dto: RenameFolderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const folder = await this.driveService.renameFolder(user.id, id, dto);
    return BaseResponse.ok(folder, 'Đổi tên thư mục thành công');
  }

  @Delete('folders/:id')
  @ApiOperation({ summary: 'Xoá thư mục (soft delete)' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  async deleteFolder(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.driveService.deleteFolder(user.id, id);
    return BaseResponse.ok(result, 'Đã xoá thư mục');
  }

  // ─────────────────────────────────────────────
  // FILES
  // ─────────────────────────────────────────────

  @Get('files')
  @ApiOperation({ summary: 'Lấy danh sách file (phân trang)' })
  async getFiles(@Query() query: FileQueryDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.driveService.getFiles(user.id, query);
    return PaginatedResponse.paginate(result.items, result.total, result.page, result.limit);
  }

  @Post('files/request-upload')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy presigned URL để upload file trực tiếp lên MinIO' })
  async requestUpload(@Body() dto: RequestUploadDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.driveService.requestUpload(user.id, dto);
    return BaseResponse.ok(result);
  }

  @Post('files/confirm-upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Xác nhận đã upload xong, tạo record trong DB' })
  async confirmUpload(@Body() dto: ConfirmUploadDto, @CurrentUser() user: ICurrentUser) {
    const file = await this.driveService.confirmUpload(user.id, dto);
    return BaseResponse.ok(file, 'Upload thành công');
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Lấy chi tiết file' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async getFile(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const file = await this.driveService.getFile(user.id, id);
    return BaseResponse.ok(file);
  }

  @Get('files/:id/download')
  @ApiOperation({ summary: 'Lấy presigned download URL, trả về { url }' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.driveService.getDownloadUrl(user.id, id);
    return BaseResponse.ok(result);
  }

  @Patch('files/:id/move')
  @ApiOperation({ summary: 'Di chuyển file sang thư mục khác' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async moveFile(
    @Param('id') id: string,
    @Body() dto: MoveFileDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const file = await this.driveService.moveFile(user.id, id, dto);
    return BaseResponse.ok(file, 'Di chuyển file thành công');
  }

  @Delete('files/:id')
  @ApiOperation({ summary: 'Xoá file (soft delete)' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async deleteFile(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.driveService.deleteFile(user.id, id);
    return BaseResponse.ok(result, 'Đã xoá file');
  }

  // ─────────────────────────────────────────────
  // VERSIONS
  // ─────────────────────────────────────────────

  @Get('files/:id/versions')
  @ApiOperation({ summary: 'Lấy lịch sử phiên bản của file' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async getVersions(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const versions = await this.driveService.getVersions(user.id, id);
    return BaseResponse.ok(versions);
  }

  @Post('files/:id/versions')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy presigned URL để upload phiên bản mới' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async requestNewVersion(
    @Param('id') id: string,
    @Body() dto: RequestNewVersionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.driveService.requestNewVersion(user.id, id, dto);
    return BaseResponse.ok(result);
  }

  @Post('files/:id/versions/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận upload phiên bản mới thành công' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async confirmNewVersion(
    @Param('id') id: string,
    @Body() dto: ConfirmNewVersionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const file = await this.driveService.confirmNewVersion(user.id, id, dto);
    return BaseResponse.ok(file, 'Đã cập nhật phiên bản mới');
  }

  // ─────────────────────────────────────────────
  // SHARES
  // ─────────────────────────────────────────────

  @Post('files/:id/share')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Chia sẻ file với user hoặc tạo public link' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async shareFile(
    @Param('id') id: string,
    @Body() dto: ShareFileDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const share = await this.driveService.shareFile(user.id, id, dto);
    return BaseResponse.ok(share, 'Chia sẻ thành công');
  }

  @Get('files/:id/shares')
  @ApiOperation({ summary: 'Lấy danh sách share của file' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async getShares(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const shares = await this.driveService.getShares(user.id, id);
    return BaseResponse.ok(shares);
  }

  @Delete('shares/:shareId')
  @ApiOperation({ summary: 'Xoá share' })
  @ApiParam({ name: 'shareId', description: 'Share ID' })
  async removeShare(
    @Param('shareId') shareId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.driveService.removeShare(user.id, shareId);
    return BaseResponse.ok(result, 'Đã xoá share');
  }

  // ─────────────────────────────────────────────
  // SEARCH / ANALYTICS
  // ─────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm file theo tên' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm' })
  async searchFiles(@Query() dto: SearchFilesDto, @CurrentUser() user: ICurrentUser) {
    const files = await this.driveService.searchFiles(user.id, dto);
    return BaseResponse.ok(files);
  }

  @Get('storage-usage')
  @ApiOperation({ summary: 'Lấy thống kê dung lượng storage của user' })
  async getStorageUsage(@CurrentUser() user: ICurrentUser) {
    const usage = await this.driveService.getStorageUsage(user.id);
    return BaseResponse.ok(usage);
  }
}
