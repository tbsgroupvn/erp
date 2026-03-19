import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { UpdateMediaDto, MediaFiltersDto, UploadMediaDto } from './dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '@common/interfaces/authenticated-request.interface';
import { RolesGuard } from '@core/rbac/guards/roles.guard';
import { Roles } from '@core/rbac/decorators/roles.decorator';
import { FileValidationPipe } from '@common/pipes/file-validation.pipe';
import { FILE_UPLOAD_LIMITS } from '@common/constants/file-upload.constants';

@ApiTags('CMS - Media')
@ApiBearerAuth()
@Controller('cms/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 uploads per minute
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  async upload(
    @UploadedFile(new FileValidationPipe({
      maxSizeBytes: FILE_UPLOAD_LIMITS.CMS_MEDIA.maxSizeBytes,
      allowedMimeTypes: [...FILE_UPLOAD_LIMITS.CMS_MEDIA.allowedMimeTypes],
    }))
    file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.mediaService.upload(file, req.user.id, dto.folder);
  }

  @Post('upload-multiple')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 batch uploads per minute
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files (max 10)' })
  @ApiConsumes('multipart/form-data')
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadMediaDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Validate each file against CMS_MEDIA limits
    const pipe = new FileValidationPipe({
      maxSizeBytes: FILE_UPLOAD_LIMITS.CMS_MEDIA.maxSizeBytes,
      allowedMimeTypes: [...FILE_UPLOAD_LIMITS.CMS_MEDIA.allowedMimeTypes],
    });
    for (const file of files) {
      pipe.transform(file, { type: 'custom' } as any);
    }

    return this.mediaService.uploadMultiple(files, req.user.id, dto.folder);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findAll(@Query() filters: MediaFiltersDto) {
    return this.mediaService.findAll(filters);
  }

  @Get('folders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  getFolders() {
    return this.mediaService.getFolders();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  getStats() {
    return this.mediaService.getStats();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  update(@Param('id') id: string, @Body() updateMediaDto: UpdateMediaDto) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }

  @Post('bulk-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO')
  bulkDelete(@Body() body: { ids: string[] }) {
    return this.mediaService.bulkDelete(body.ids);
  }

  @Post(':id/move')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'COO', 'MARKETING_STAFF')
  move(@Param('id') id: string, @Body() body: { folder: string | null }) {
    return this.mediaService.move(id, body.folder);
  }
}
