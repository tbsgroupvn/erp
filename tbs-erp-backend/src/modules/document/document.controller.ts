import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { AddVersionDto } from './dto/add-version.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) { }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 uploads per minute
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a document' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async upload(@Body() dto: UploadDocumentDto, @CurrentUser() user: ICurrentUser) {
    const document = await this.documentService.upload(user.id, dto);
    return BaseResponse.ok(document, 'Document uploaded successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List documents with filters' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async findAll(@Query() query: DocumentQueryDto) {
    const result = await this.documentService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('order/:orderId/hub')
  @ApiOperation({
    summary: 'Get order document hub',
    description:
      'Returns all documents related to an order (order, packages, container, customer), grouped by category.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order documents retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderDocuments(@Param('orderId') orderId: string) {
    const result = await this.documentService.getOrderDocuments(orderId);
    return BaseResponse.ok(result);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get documents by entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type (ORDER, CUSTOMER, etc.)' })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  async getByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    const documents = await this.documentService.getByEntity(entityType, entityId);
    return BaseResponse.ok(documents);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document detail' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async findById(@Param('id') id: string) {
    const document = await this.documentService.findById(id);
    return BaseResponse.ok(document);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get download URL for a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async getDownloadUrl(@Param('id') id: string) {
    const result = await this.documentService.getDownloadUrl(id);
    return BaseResponse.ok(result);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS, UserRole.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Soft delete a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async delete(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.documentService.delete(id, user.id);
    return BaseResponse.ok(result, 'Document deleted');
  }

  @Post(':id/version')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 uploads per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a new version of a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async addVersion(
    @Param('id') id: string,
    @Body() body: AddVersionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.documentService.addVersion(id, {
      ...body,
      uploadedBy: user.id,
    });
    return BaseResponse.ok(result, 'New version uploaded');
  }
}
