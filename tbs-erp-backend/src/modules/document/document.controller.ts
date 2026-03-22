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
import { DataScopeGuard, DataScopeFilter } from '@common/guards/data-scope.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { DataScope } from '@common/decorators/data-scope.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { AddVersionDto } from './dto/add-version.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) { }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 uploads per minute
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Upload a document' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async upload(@Body() dto: UploadDocumentDto, @CurrentUser() user: ICurrentUser) {
    const document = await this.documentService.upload(user.id, dto);
    return BaseResponse.ok(document, 'Document uploaded successfully');
  }

  @Get()
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'List documents with filters' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async findAll(
    @Query() query: DocumentQueryDto,
    @DataScope() dataScope: DataScopeFilter | undefined,
  ) {
    const result = await this.documentService.findAll(query, dataScope);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('order/:orderId/hub')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
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
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Get documents by entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type (ORDER, CUSTOMER, etc.)' })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  async getByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    const documents = await this.documentService.getByEntity(entityType, entityId);
    return BaseResponse.ok(documents);
  }

  @Get(':id')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Get document detail' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async findById(@Param('id') id: string) {
    const document = await this.documentService.findById(id);
    return BaseResponse.ok(document);
  }

  @Get(':id/download')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Get download URL for a document' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async getDownloadUrl(@Param('id') id: string) {
    const result = await this.documentService.getDownloadUrl(id);
    return BaseResponse.ok(result);
  }

  @Delete(':id')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER,
    // All other roles may also delete — the service enforces ownership check
    // so non-management roles can only delete documents they themselves uploaded.
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_CN_AGENT, UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
  @ApiOperation({ summary: 'Soft delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 403, description: 'Only the document owner or management may delete' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  async delete(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.documentService.delete(id, user.id, user.role);
    return BaseResponse.ok(result, 'Document deleted');
  }

  @Post(':id/version')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 uploads per minute
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
    UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.ACCOUNTANT_COST,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.DRIVER,
  )
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
