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
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { CustomsDeclarationService } from './customs-declaration.service';
import { CustomsDocumentService } from './customs-document.service';
import { CustomsServiceRateService } from './customs-service-rate.service';
import {
  CreateDeclarationDto,
  UpdateDeclarationHeaderDto,
  UpdateDeclarationLineDto,
  GroupItemsDto,
  UpdateChannelDto,
  UpdateStatusDto,
  DeclarationQueryDto,
  CreateComplianceRuleDto,
  UpdateComplianceRuleDto,
} from './dto';

@ApiTags('customs-declarations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customs-declarations')
export class CustomsDeclarationController {
  constructor(
    private readonly customsService: CustomsDeclarationService,
    private readonly customsDocumentService: CustomsDocumentService,
    private readonly customsServiceRateService: CustomsServiceRateService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // STATIC ROUTES (must come before parameterized :id routes)
  // ═══════════════════════════════════════════════════════════════════

  // ─── HS Code Library ───

  @Get('hs-codes/search')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Search HS code library',
    description:
      'Searches the HS code library by code, Vietnamese/English description, or keywords.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results (default: 20)',
  })
  @ApiResponse({ status: 200, description: 'HS codes retrieved' })
  async searchHSCodes(@Query('q') query: string, @Query('limit') limit?: number) {
    const results = await this.customsService.searchHSCodes(query, limit);
    return BaseResponse.ok(results);
  }

  @Get('hs-codes/suggest')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Suggest HS code for product',
    description:
      'Suggests HS codes based on product description using keyword matching ' +
      'and historical usage patterns. Learns from user selections over time.',
  })
  @ApiQuery({ name: 'description', required: true, description: 'Product description' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max suggestions (default: 5)',
  })
  @ApiResponse({ status: 200, description: 'HS code suggestions retrieved' })
  async suggestHSCode(@Query('description') description: string, @Query('limit') limit?: number) {
    const suggestions = await this.customsService.suggestHSCode(description, limit);
    return BaseResponse.ok(suggestions);
  }

  // ─── Compliance Rules (static paths) ───

  @Get('compliance-rules')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'List active compliance rules',
    description: 'Returns all active compliance rules used for HS code matching.',
  })
  @ApiResponse({ status: 200, description: 'Rules retrieved' })
  async getComplianceRules() {
    const rules = await this.customsService.getComplianceRules();
    return BaseResponse.ok(rules);
  }

  @Post('compliance-rules')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create compliance rule',
    description:
      'Creates a new compliance rule for HS code matching. ' +
      'Supports wildcard patterns (e.g., "8471.*" matches all codes starting with 8471).',
  })
  @ApiResponse({ status: 201, description: 'Rule created successfully' })
  async createComplianceRule(
    @Body() dto: CreateComplianceRuleDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const rule = await this.customsService.createComplianceRule(dto, user.id);
    return BaseResponse.ok(rule, 'Compliance rule created');
  }

  @Patch('compliance-rules/:id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary: 'Update compliance rule',
    description: 'Updates an existing compliance rule.',
  })
  @ApiParam({ name: 'id', description: 'Compliance rule ID' })
  @ApiResponse({ status: 200, description: 'Rule updated successfully' })
  async updateComplianceRule(@Param('id') id: string, @Body() dto: UpdateComplianceRuleDto) {
    const rule = await this.customsService.updateComplianceRule(id, dto);
    return BaseResponse.ok(rule, 'Compliance rule updated');
  }

  // ─── Compliance Alerts (static paths) ───

  @Post('compliance-alerts/:alertId/acknowledge')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge compliance alert',
    description: 'Marks a compliance alert as acknowledged by the current user.',
  })
  @ApiParam({ name: 'alertId', description: 'Compliance alert ID' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  async acknowledgeAlert(@Param('alertId') alertId: string, @CurrentUser() user: ICurrentUser) {
    const alert = await this.customsService.acknowledgeAlert(alertId, user.id);
    return BaseResponse.ok(alert, 'Alert acknowledged');
  }

  // ─── Line Operations (static prefix "lines/") ───

  @Patch('lines/:lineId')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Update declaration line',
    description:
      'Updates declared data on a single line. If HS code changes, tax rates are ' +
      'recalculated automatically. Only allowed for DRAFT or READY declarations.',
  })
  @ApiParam({ name: 'lineId', description: 'Declaration line ID' })
  @ApiResponse({ status: 200, description: 'Line updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot edit in current status' })
  @ApiResponse({ status: 404, description: 'Line not found' })
  async updateLine(
    @Param('lineId') lineId: string,
    @Body() dto: UpdateDeclarationLineDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const line = await this.customsService.updateLine(lineId, dto, user.id);
    return BaseResponse.ok(line, 'Declaration line updated');
  }

  @Delete('lines/:lineId')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Remove declaration line',
    description: 'Removes a line from a declaration. Only allowed for DRAFT or READY declarations.',
  })
  @ApiParam({ name: 'lineId', description: 'Declaration line ID' })
  @ApiResponse({ status: 200, description: 'Line removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot edit in current status' })
  @ApiResponse({ status: 404, description: 'Line not found' })
  async removeLine(@Param('lineId') lineId: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.customsService.removeLine(lineId, user.id);
    return BaseResponse.ok(result, 'Line removed successfully');
  }

  @Post('lines/:lineId/ungroup')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ungroup a merged line',
    description:
      'Splits a merged line back into individual lines based on source items. ' +
      'Only works on lines with 2+ source items. Only allowed for DRAFT or READY declarations.',
  })
  @ApiParam({ name: 'lineId', description: 'Declaration line ID' })
  @ApiResponse({ status: 200, description: 'Line ungrouped successfully' })
  @ApiResponse({
    status: 400,
    description: 'Line has only 1 source item or cannot ungroup in current status',
  })
  @ApiResponse({ status: 404, description: 'Line not found' })
  async ungroupLine(@Param('lineId') lineId: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.customsService.ungroupLine(lineId, user.id);
    return BaseResponse.ok(result, 'Line ungrouped into individual items');
  }

  // ─── Service Rates (static paths) ───

  @Get('service-rates')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'List customs service rates',
    description: 'Returns available customs service rates and fee schedules.',
  })
  @ApiResponse({ status: 200, description: 'Service rates retrieved' })
  async getServiceRates(
    @Query('portName') portName?: string,
    @Query('cargoType') cargoType?: string,
  ) {
    const data = await this.customsServiceRateService.findAll(portName, cargoType);
    return BaseResponse.ok(data);
  }

  @Post('service-rates')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create customs service rate',
    description: 'Creates a new customs service rate entry.',
  })
  @ApiResponse({ status: 201, description: 'Service rate created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createServiceRate(@Body() dto: any) {
    const rate = await this.customsServiceRateService.create(dto);
    return BaseResponse.ok(rate);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DECLARATION CRUD (parameterized routes)
  // ═══════════════════════════════════════════════════════════════════

  @Post()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create customs declaration from container',
    description:
      "Creates a new DRAFT customs declaration pre-populated from a container's orders and items. " +
      'Each order item becomes a declaration line with internal and declared data.',
  })
  @ApiResponse({ status: 201, description: 'Declaration created successfully' })
  @ApiResponse({ status: 400, description: 'Container has no orders' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 409, description: 'Declaration already exists for this container' })
  async createFromContainer(@Body() dto: CreateDeclarationDto, @CurrentUser() user: ICurrentUser) {
    const declaration = await this.customsService.createFromContainer(dto.containerId, user.id);
    return BaseResponse.ok(declaration, 'Customs declaration created successfully');
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'List customs declarations',
    description:
      'Returns paginated customs declarations with filtering by status, channel, ' +
      'container, search, and date range.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Declarations retrieved successfully' })
  async findAll(@Query() query: DeclarationQueryDto) {
    const result = await this.customsService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Get customs declaration detail',
    description:
      'Returns full declaration details including lines, source items, ' +
      'compliance alerts, tax allocations, and status history.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Declaration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async findById(@Param('id') id: string) {
    const declaration = await this.customsService.findById(id);
    return BaseResponse.ok(declaration);
  }

  @Patch(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Update declaration header',
    description:
      'Updates declaration metadata (customs office, importer info, shipping info, etc.). ' +
      'Only allowed for DRAFT or READY declarations.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Declaration updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot edit in current status' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async updateHeader(
    @Param('id') id: string,
    @Body() dto: UpdateDeclarationHeaderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const declaration = await this.customsService.updateHeader(id, dto, user.id);
    return BaseResponse.ok(declaration, 'Declaration header updated');
  }

  // ─── Sub-resource Routes on :id ───

  @Post(':id/lines')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add manual line to declaration',
    description:
      'Adds a new line not linked to any order item. ' +
      'Only allowed for DRAFT or READY declarations.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 201, description: 'Line added successfully' })
  @ApiResponse({ status: 400, description: 'Cannot edit in current status' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async addManualLine(
    @Param('id') id: string,
    @Body() dto: UpdateDeclarationLineDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const line = await this.customsService.addManualLine(id, dto, user.id);
    return BaseResponse.ok(line, 'Manual line added');
  }

  // ─── Status & Channel ───

  @Patch(':id/status')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Update declaration status',
    description:
      'Transitions the declaration to a new status. Validates FSM transition rules. ' +
      'Valid transitions: DRAFT->READY->SUBMITTED->CHANNEL_ASSIGNED->INSPECTING/CLEARED.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Status changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const declaration = await this.customsService.updateStatus(id, dto.status, user.id, dto.note);
    return BaseResponse.ok(declaration, `Status changed to ${dto.status}`);
  }

  @Patch(':id/channel')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Assign customs inspection channel',
    description:
      'Sets the inspection channel (GREEN/YELLOW/RED). ' +
      'GREEN = auto-cleared, YELLOW = document check, RED = physical inspection.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Channel assigned successfully' })
  @ApiResponse({ status: 400, description: 'Cannot assign channel in current status' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async updateChannel(
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const declaration = await this.customsService.updateChannel(id, dto.channel, user.id);
    return BaseResponse.ok(declaration, `Channel assigned: ${dto.channel}`);
  }

  // ─── Tax Calculation & Allocation ───

  @Post(':id/recalculate')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recalculate all taxes',
    description:
      'Recalculates import duty, VAT, special tax, and totals for all lines ' +
      'and the declaration header.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Taxes recalculated successfully' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async recalculateTaxes(@Param('id') id: string) {
    const declaration = await this.customsService.recalculateTaxes(id);
    return BaseResponse.ok(declaration, 'Taxes recalculated');
  }

  @Get(':id/export-ecus5')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Export ECUS5-compatible file',
    description:
      'Downloads the declaration as an ECUS5-compatible Excel file for import ' +
      'into the Vietnamese Electronic Customs system.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'File download' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async exportEcus5(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.customsService.exportEcus5(id);

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  @Post(':id/allocate-tax')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CHIEF_ACCOUNTANT, UserRole.XNK_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Allocate customs taxes to orders',
    description:
      'Proportionally allocates customs taxes (import duty, VAT, special tax) to individual orders. ' +
      'Supports allocation by VALUE (contributed value) or WEIGHT (package weight). ' +
      'Creates OrderExtraCharge records for financial tracking. Only available for CLEARED declarations.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiQuery({
    name: 'method',
    required: false,
    enum: ['VALUE', 'WEIGHT'],
    description: 'Allocation method (default: VALUE)',
  })
  @ApiResponse({ status: 200, description: 'Taxes allocated successfully' })
  @ApiResponse({ status: 400, description: 'Declaration not CLEARED or no taxes calculated' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async allocateTaxToOrders(
    @Param('id') id: string,
    @Query('method') method: string = 'VALUE',
    @CurrentUser() user: ICurrentUser,
  ) {
    const allocations = await this.customsService.allocateTaxToOrders(id, method, user.id);
    return BaseResponse.ok(allocations, `Taxes allocated using ${method} method`);
  }

  // ─── Line Grouping ───

  @Post(':id/group-by-hs')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-group lines by HS code',
    description:
      'Automatically groups all lines sharing the same HS code into merged lines. ' +
      'Sums quantities, values, and weights. Only allowed for DRAFT or READY declarations.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Lines grouped successfully' })
  @ApiResponse({ status: 400, description: 'Cannot group in current status' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async groupByHsCode(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.customsService.groupByHsCode(id, user.id);
    return BaseResponse.ok(result, 'Lines grouped by HS code');
  }

  @Post(':id/group-custom')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Custom group selected lines',
    description:
      'Groups selected lines into a single line with custom description and HS code. ' +
      'At least 2 lines must be selected. Only allowed for DRAFT or READY declarations.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Lines grouped successfully' })
  @ApiResponse({
    status: 400,
    description: 'Less than 2 lines selected or cannot group in current status',
  })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async groupCustom(
    @Param('id') id: string,
    @Body() dto: GroupItemsDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.customsService.groupCustom(id, dto, user.id);
    return BaseResponse.ok(result, 'Lines grouped with custom parameters');
  }

  @Get(':id/suggest-groupings')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Suggest optimal line groupings',
    description:
      'Analyzes declaration lines and suggests optimal groupings based on HS code prefixes. ' +
      'Returns suggested groups with estimated combined quantities and values.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Grouping suggestions retrieved' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async suggestGroupings(@Param('id') id: string) {
    const suggestions = await this.customsService.suggestGroupings(id);
    return BaseResponse.ok(suggestions);
  }

  // ─── Compliance Check ───

  @Post(':id/check-compliance')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run compliance check',
    description:
      'Checks all lines against compliance rules (restricted/prohibited goods, permit requirements, ' +
      'value anomalies). Creates ComplianceAlert records and updates compliance status.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Compliance check completed' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async checkCompliance(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.customsService.checkCompliance(id, user.id);
    return BaseResponse.ok(result, 'Compliance check completed');
  }

  // ─── Document Checklist ───

  @Get(':id/documents')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Get document checklist for declaration',
    description: 'Returns the list of required and uploaded documents for a customs declaration.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 200, description: 'Document checklist retrieved' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async getDocuments(@Param('id') declarationId: string) {
    const docs = await this.customsDocumentService.getChecklist(declarationId);
    return BaseResponse.ok(docs);
  }

  @Post(':id/documents/upload')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload customs document',
    description: 'Uploads a document for a customs declaration.',
  })
  @ApiParam({ name: 'id', description: 'Declaration ID' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Declaration not found' })
  async uploadDocument(
    @Param('id') declarationId: string,
    @Body() dto: { checklistItemId: string; documentUrl: string },
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.customsDocumentService.uploadDocument(
      dto.checklistItemId,
      dto.documentUrl,
      user.id,
    );
    return BaseResponse.ok(result);
  }
}
