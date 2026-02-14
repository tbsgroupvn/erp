import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { QuotationService } from './quotation.service';
import { QuotationExportService } from './quotation-export.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';

@ApiTags('Quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotations')
export class QuotationController {
  constructor(
    private readonly quotationService: QuotationService,
    private readonly quotationExportService: QuotationExportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new quotation',
    description:
      'Creates a new quotation with items. Calculates totals with discount and tax. If discount > 0, requires approval.',
  })
  @ApiResponse({ status: 201, description: 'Quotation created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async create(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const quotation = await this.quotationService.createQuotation(
      user.id,
      dto,
    );
    return BaseResponse.ok(quotation, 'Quotation created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List quotations',
    description:
      'Returns paginated quotations with filtering by status, customer, date range, and search.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Quotations retrieved successfully' })
  async findAll(@Query() query: QuotationQueryDto) {
    const result = await this.quotationService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get quotation detail',
    description:
      'Returns full quotation details including customer info and items.',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'Quotation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async findById(@Param('id') id: string) {
    const quotation = await this.quotationService.findById(id);
    return BaseResponse.ok(quotation);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a quotation',
    description:
      'Updates quotation fields and items. Only allowed when status is DRAFT or REJECTED.',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'Quotation updated successfully' })
  @ApiResponse({ status: 400, description: 'Quotation cannot be edited in current status' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    const quotation = await this.quotationService.updateQuotation(id, dto);
    return BaseResponse.ok(quotation, 'Quotation updated successfully');
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a quotation',
    description:
      'Approves a quotation that is in PENDING_APPROVAL status.',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'Quotation approved successfully' })
  @ApiResponse({ status: 400, description: 'Quotation cannot be approved' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const quotation = await this.quotationService.approveQuotation(
      id,
      user.id,
    );
    return BaseResponse.ok(quotation, 'Quotation approved successfully');
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a quotation',
    description:
      'Rejects a quotation that is in PENDING_APPROVAL status with a reason.',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  @ApiResponse({ status: 400, description: 'Quotation cannot be rejected' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const quotation = await this.quotationService.rejectQuotation(
      id,
      user.id,
      reason,
    );
    return BaseResponse.ok(quotation, 'Quotation rejected');
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Convert quotation to order',
    description:
      'Creates an order from an approved quotation and marks the quotation as CONVERTED.',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 201, description: 'Order created from quotation' })
  @ApiResponse({ status: 400, description: 'Quotation cannot be converted' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async convertToOrder(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.quotationService.convertToOrder(id, user.id);
    return BaseResponse.ok(result, 'Quotation converted to order successfully');
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Duplicate a quotation',
    description:
      'Clones an existing quotation as a new DRAFT with reset discount.',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 201, description: 'Quotation duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async duplicate(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const quotation = await this.quotationService.duplicateQuotation(
      id,
      user.id,
    );
    return BaseResponse.ok(quotation, 'Quotation duplicated successfully');
  }

  @Get(':id/versions')
  @ApiOperation({
    summary: 'Get quotation version history',
    description:
      'Returns all versions of a quotation chain (parent and children).',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'Version history retrieved' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async getVersionHistory(@Param('id') id: string) {
    const versions = await this.quotationService.getVersionHistory(id);
    return BaseResponse.ok(versions);
  }

  @Get(':id/export/excel')
  @ApiOperation({ summary: 'Export quotation as Excel file' })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'Excel file downloaded' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async exportExcel(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // Verify quotation exists (throws NotFoundException if not found)
    await this.quotationService.findById(id);
    const buffer = await this.quotationExportService.generateExcel(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="quotation-${id}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id/export/pdf')
  @ApiOperation({ summary: 'Export quotation as PDF file' })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'PDF file downloaded' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async exportPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // Verify quotation exists (throws NotFoundException if not found)
    await this.quotationService.findById(id);
    const buffer = await this.quotationExportService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quotation-${id}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}
