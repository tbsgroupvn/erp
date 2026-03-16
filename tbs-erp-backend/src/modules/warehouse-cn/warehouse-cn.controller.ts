import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { WarehouseCNService } from './warehouse-cn.service';
import { WarehouseCNConsolidationService } from './warehouse-cn-consolidation.service';
import { SlottingService } from './domain/slotting.service';
import { ReceivePackageDto } from './dto/receive-package.dto';
import { MeasurePackageDto } from './dto/measure-package.dto';
import { BatchReceiveDto } from './dto/batch-receive.dto';
import { UnlockWeightDto } from './dto/unlock-weight.dto';
import { AssignBinDto } from './dto/assign-bin.dto';
import { ConsolidatePackagesDto } from './dto/consolidate-packages.dto';
import { BatchScanDto } from './dto/batch-scan.dto';
import { UpdatePackageStatusDto } from './dto/update-package-status.dto';
import { SetIndependentStatusDto } from './dto/set-independent-status.dto';

@ApiTags('Warehouse CN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouse-cn')
export class WarehouseCNController {
  constructor(
    private readonly warehouseCNService: WarehouseCNService,
    private readonly consolidationService: WarehouseCNConsolidationService,
    private readonly slottingService: SlottingService,
  ) {}

  @Post('receive')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Receive a package at Warehouse CN',
    description:
      'Scans a tracking number to receive a package. Automatically matches against pre-alerts. ' +
      'If no pre-alert match is found, a LostAndFound record is created.',
  })
  @ApiResponse({ status: 201, description: 'Package received successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Duplicate tracking number' })
  async receivePackage(@Body() dto: ReceivePackageDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.warehouseCNService.receivePackage(dto, user.id);
    return BaseResponse.ok(result, 'Package received at Warehouse CN');
  }

  @Post('batch-receive')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Batch receive packages',
    description: 'Receives multiple packages at once at Warehouse CN.',
  })
  @ApiResponse({ status: 201, description: 'Packages batch received successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async batchReceive(@Body() dto: BatchReceiveDto) {
    const result = await this.warehouseCNService.batchReceive(dto);
    return BaseResponse.ok(result);
  }

  @Post('consolidation')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Consolidate packages',
    description: 'Consolidates multiple packages into a single shipment.',
  })
  @ApiResponse({ status: 201, description: 'Packages consolidated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async consolidate(
    @Body() dto: ConsolidatePackagesDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.consolidationService.consolidatePackages(
      dto.customerId,
      dto.packageIds,
      user.id,
    );
    return BaseResponse.ok(result);
  }

  @Get('consolidation')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
  )
  @ApiOperation({
    summary: 'List consolidations',
    description: 'Returns paginated list of package consolidations.',
  })
  @ApiResponse({ status: 200, description: 'Consolidations retrieved successfully' })
  async listConsolidations(@Query('customerId') customerId?: string) {
    const data = await this.consolidationService.getConsolidations(customerId);
    return BaseResponse.ok(data);
  }

  @Post('packages/:id/measure')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Measure a package',
    description:
      'Records dimensions and weight for a package. Calculates volumetric weight ' +
      'based on the shipping route and determines chargeable weight.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Package measured successfully' })
  @ApiResponse({ status: 400, description: 'Package not in RECEIVED status' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async measurePackage(
    @Param('id') id: string,
    @Body() dto: MeasurePackageDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseCNService.measurePackage(id, dto, user.id);
    return BaseResponse.ok(result, 'Package measured successfully');
  }

  @Patch('packages/:id/status')
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.XNK_STAFF)
  @ApiOperation({
    summary: 'Update package warehouse CN status',
    description: 'Transitions package status: RECEIVED -> CHECKED -> PACKED -> SHIPPED.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async updatePackageStatus(@Param('id') id: string, @Body() dto: UpdatePackageStatusDto) {
    const pkg = await this.warehouseCNService.updatePackageStatus(id, dto.status);
    return BaseResponse.ok(pkg, `Package status updated to ${status}`);
  }

  @Get('packages')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.CSKH,
  )
  @ApiOperation({
    summary: 'List packages at Warehouse CN',
    description:
      'Returns paginated packages that have been received at Warehouse CN with optional filters.',
  })
  @ApiPaginated()
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by warehouse CN status (RECEIVED, CHECKED, PACKED, SHIPPED)',
    example: 'RECEIVED',
  })
  @ApiQuery({
    name: 'orderId',
    required: false,
    description: 'Filter by order ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by package code or tracking number',
  })
  @ApiResponse({ status: 200, description: 'Packages retrieved successfully' })
  async listPackages(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const result = await this.warehouseCNService.listPackages({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      orderId,
      search,
      sortBy,
      sortOrder,
    });

    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('scan/:trackingNumber')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.CSKH,
  )
  @ApiOperation({
    summary: 'Scan barcode to look up package',
    description:
      'Looks up a package by tracking number CN. Uses Redis cache with 300s TTL for fast repeated scans.',
  })
  @ApiParam({ name: 'trackingNumber', description: 'CN tracking number / barcode' })
  @ApiResponse({ status: 200, description: 'Package found' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async scanBarcode(@Param('trackingNumber') trackingNumber: string) {
    const pkg = await this.warehouseCNService.scanBarcode(trackingNumber);
    if (!pkg) {
      return BaseResponse.ok(null, 'No package found for this tracking number');
    }
    return BaseResponse.ok(pkg, 'Package found');
  }

  @Patch('packages/:id/independent-status')
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary: 'Set package independent status',
    description:
      'Sets the independent status of a package: NORMAL, CONFISCATED_BY_CUSTOMS, HIGH_RISK_HOLD. ' +
      'CONFISCATED also sets the order to ISSUE status.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Status set' })
  @ApiResponse({ status: 400, description: 'Invalid status' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async setPackageIndependentStatus(
    @Param('id') id: string,
    @Body() dto: SetIndependentStatusDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const pkg = await this.warehouseCNService.setPackageIndependentStatus(
      id,
      dto.status,
      dto.reason ?? '',
      user.id,
    );
    return BaseResponse.ok(pkg, `Independent status set to ${dto.status}`);
  }

  @Patch('packages/:id/high-risk')
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary: 'Mark package as high risk',
    description: 'Marks a package as high risk goods.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Package marked as high risk' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async markHighRisk(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const pkg = await this.warehouseCNService.markHighRisk(id, user.id);
    return BaseResponse.ok(pkg, 'Package marked as high risk');
  }

  @Patch('packages/:id/accept-disclaimer')
  @Roles(UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.SALE, UserRole.SALES_LEADER)
  @ApiOperation({
    summary: 'Accept high risk disclaimer',
    description: 'Accepts the high risk disclaimer for a package, allowing it to be dispatched.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Disclaimer accepted' })
  @ApiResponse({ status: 400, description: 'Package is not high risk' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async acceptDisclaimer(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const pkg = await this.warehouseCNService.acceptDisclaimer(id, user.id);
    return BaseResponse.ok(pkg, 'High risk disclaimer accepted');
  }

  @Post('packages/:id/unlock-weight')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({
    summary: 'Unlock weight for re-measurement',
    description:
      'Clears the weight confirmation lock on a package, allowing it to be re-measured. ' +
      'Only WAREHOUSE_MANAGER, CEO, COO can perform this action. Requires a reason.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Weight unlocked' })
  @ApiResponse({ status: 400, description: 'Weight not confirmed' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async unlockWeight(
    @Param('id') id: string,
    @Body() dto: UnlockWeightDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseCNService.unlockWeight(id, dto, user.id, user.role);
    return BaseResponse.ok(result, 'Weight unlocked for re-measurement');
  }

  @Get('packages/:id/weight-audit')
  @Roles(
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CEO,
    UserRole.COO,
    UserRole.XNK_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
  )
  @ApiOperation({
    summary: 'Get weight audit log',
    description: 'Returns the history of all weight changes for a package.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async getWeightAuditLog(@Param('id') id: string) {
    const logs = await this.warehouseCNService.getWeightAuditLog(id);
    return BaseResponse.ok(logs);
  }

  @Get('packages/:id')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.CSKH,
    UserRole.SALE,
    UserRole.SALES_LEADER,
    UserRole.SALES_DIRECTOR,
  )
  @ApiOperation({
    summary: 'Get package detail',
    description: 'Returns full package details with order and container relations.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Package retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async getPackage(@Param('id') id: string) {
    const pkg = await this.warehouseCNService.listPackages({
      search: id,
      limit: 1,
    });
    // Try direct lookup through repository for detailed view
    return BaseResponse.ok(pkg.data[0] ?? null);
  }

  // ─────────────────────────────────────────────────────────────────
  // SLOTTING — Quan ly vi tri luu tru kien hang (ABC Slotting)
  // ─────────────────────────────────────────────────────────────────

  @Get('slotting/suggest/:packageId')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Goi y o hang cho kien hang',
    description:
      'Tinh ABC class cua kien dua tren tan suat hoat dong order/khach hang trong 30 ngay. ' +
      'Tim o hang phu hop: khu A gan cua (kien xuat nhieu), khu C xa cua (kien it xuat). ' +
      'Uu tien o trong truoc, sau do o con cho co du suc chua.',
  })
  @ApiParam({ name: 'packageId', description: 'ID cua kien hang can goi y vi tri' })
  @ApiResponse({ status: 200, description: 'Goi y o hang thanh cong' })
  @ApiResponse({ status: 400, description: 'Kien da duoc gan o hang hoac kho day' })
  @ApiResponse({ status: 404, description: 'Khong tim thay kien hang' })
  async suggestBin(@Param('packageId') packageId: string) {
    const result = await this.slottingService.suggestBin(packageId);
    return BaseResponse.ok(result, 'Goi y vi tri luu tru thanh cong');
  }

  @Post('slotting/assign')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Gan kien hang vao o hang',
    description:
      'Gan mot kien hang vao o hang cu the. ' +
      'Kiem tra suc chua trong luong va the tich truoc khi gan. ' +
      'Cap nhat isOccupied=true, packageId, currentWeight, currentVolume cho o hang.',
  })
  @ApiResponse({ status: 200, description: 'Gan kien vao o hang thanh cong' })
  @ApiResponse({ status: 400, description: 'O hang day hoac khong du suc chua' })
  @ApiResponse({ status: 404, description: 'Khong tim thay kien hang hoac o hang' })
  async assignBin(@Body() dto: AssignBinDto) {
    const result = await this.slottingService.assignBin(dto.packageId, dto.binId);
    return BaseResponse.ok(result, `Kien hang da duoc gan vao o ${result.code}`);
  }

  @Post('slotting/release/:binId')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Giai phong o hang',
    description:
      'Xoa kien hang khoi o, reset isOccupied=false, currentWeight=0, currentVolume=0. ' +
      'Goi khi kien hang duoc xuat kho hoac chuyen sang container.',
  })
  @ApiParam({ name: 'binId', description: 'ID cua o hang can giai phong' })
  @ApiResponse({ status: 200, description: 'Giai phong o hang thanh cong' })
  @ApiResponse({ status: 400, description: 'O hang da trong' })
  @ApiResponse({ status: 404, description: 'Khong tim thay o hang' })
  async releaseBin(@Param('binId') binId: string) {
    const result = await this.slottingService.releaseBin(binId);
    return BaseResponse.ok(result, `O hang ${result.code} da duoc giai phong`);
  }

  @Get('slotting/occupancy')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Xem ty le su dung o hang',
    description:
      'Thong ke tong quan: tong so o hang, so o dang co kien, so o trong, ty le su dung. ' +
      'Chia theo tung khu vuc (zone A, B, C).',
  })
  @ApiQuery({
    name: 'warehouse',
    required: false,
    description: 'Loc theo kho: CN (mac dinh) hoac VN',
    example: 'CN',
  })
  @ApiResponse({ status: 200, description: 'Thong ke o hang thanh cong' })
  async getBinOccupancy(@Query('warehouse') warehouse = 'CN') {
    const result = await this.slottingService.getBinOccupancy(warehouse.toUpperCase());
    return BaseResponse.ok(result);
  }

  @Post('slotting/recalculate-abc')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.WAREHOUSE_MANAGER, UserRole.COO, UserRole.CEO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({
    summary: 'Tinh lai phan loai ABC cho tat ca o hang',
    description:
      'Sap xep tat ca o hang theo frequency (so lan xuat/nhap 30 ngay). ' +
      'Top 20% -> A, tiep 30% -> B, con lai -> C. ' +
      'Nen chay hang ngay bang cron job luc 00:00. ' +
      'Nguoi dung co the goi thu cong khi can thiet.',
  })
  @ApiResponse({ status: 200, description: 'Tinh lai ABC hoan thanh' })
  async recalculateABC() {
    const result = await this.slottingService.recalculateABC();
    return BaseResponse.ok(result, `Cap nhat phan loai ABC cho ${result.updated} o hang`);
  }

  @Get('slotting/bins')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Danh sach tat ca o hang',
    description:
      'Tra ve danh sach o hang co the loc theo zone, trang thai (trong/co kien), ' +
      'phan loai ABC, kho. Ho tro phan trang.',
  })
  @ApiQuery({ name: 'zone', required: false, description: 'Loc theo khu vuc: A, B, hoac C', example: 'A' })
  @ApiQuery({ name: 'isOccupied', required: false, description: 'Loc theo trang thai: true (co kien) / false (trong)', example: 'false' })
  @ApiQuery({ name: 'abcClass', required: false, description: 'Loc theo phan loai ABC: A, B, hoac C', example: 'B' })
  @ApiQuery({ name: 'warehouse', required: false, description: 'Loc theo kho: CN hoac VN', example: 'CN' })
  @ApiQuery({ name: 'page', required: false, description: 'Trang (mac dinh: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'So ban ghi moi trang (mac dinh: 50)' })
  @ApiResponse({ status: 200, description: 'Danh sach o hang' })
  async listBins(
    @Query('zone') zone?: string,
    @Query('isOccupied') isOccupied?: string,
    @Query('abcClass') abcClass?: string,
    @Query('warehouse') warehouse = 'CN',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.slottingService.listBins({
      zone,
      abcClass,
      warehouse,
      isOccupied: isOccupied !== undefined ? isOccupied === 'true' : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('slotting/map')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Ban do truc quan kho hang',
    description:
      'Tra ve du lieu phan cap zone -> aisle -> shelf -> bin de hien thi ban do kho. ' +
      'Moi bin bao gom trang thai (co kien/trong), ma kien, trong luong, phan loai ABC.',
  })
  @ApiQuery({ name: 'warehouse', required: false, description: 'Ma kho: CN (mac dinh) hoac VN', example: 'CN' })
  @ApiResponse({ status: 200, description: 'Du lieu ban do kho' })
  async getWarehouseMap(@Query('warehouse') warehouse = 'CN') {
    const result = await this.slottingService.getWarehouseMap(warehouse);
    return BaseResponse.ok(result, 'Ban do kho lay thanh cong');
  }

  @Get('slotting/heatmap')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Heat map tan suat hoat dong theo zone',
    description:
      'Tinh tan suat assign/release theo tung zone/aisle trong N ngay. ' +
      'Bao gom: frequency (so lan), avgDwellTime (thoi gian luu kho trung binh, gio), ' +
      'turnoverRate (lan/bin/ngay).',
  })
  @ApiQuery({ name: 'warehouse', required: false, description: 'Ma kho: CN hoac VN', example: 'CN' })
  @ApiQuery({ name: 'days', required: false, description: 'So ngay phan tich (mac dinh: 30)', example: '30' })
  @ApiResponse({ status: 200, description: 'Du lieu heat map thanh cong' })
  async getHeatMap(
    @Query('warehouse') warehouse = 'CN',
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    const result = await this.slottingService.getHeatMap(warehouse, days);
    return BaseResponse.ok(result, 'Heat map lay thanh cong');
  }

  @Get('slotting/suggestions')
  @Roles(
    UserRole.WAREHOUSE_MANAGER,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({
    summary: 'Goi y toi uu hoa vi tri luu tru',
    description:
      'Phan tich hien trang kho va goi y cai thien: ' +
      'kien sai khu vuc (ABC class khong khop zone), mat can bang zone, ' +
      'khu A su dung thap/cao. Priority: HIGH/MEDIUM/LOW.',
  })
  @ApiQuery({ name: 'warehouse', required: false, description: 'Ma kho: CN hoac VN', example: 'CN' })
  @ApiResponse({ status: 200, description: 'Danh sach goi y toi uu hoa' })
  async getOptimizationSuggestions(@Query('warehouse') warehouse = 'CN') {
    const result = await this.slottingService.getOptimizationSuggestions(warehouse);
    return BaseResponse.ok(result, `${result.suggestions.length} goi y toi uu hoa`);
  }

  // ─────────────────────────────────────────────────────────────────
  // SCAN — Scan hang loat, lich su scan, thong ke scan
  // ─────────────────────────────────────────────────────────────────

  @Post('scan/batch')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Scan hang loat nhieu ma van don',
    description:
      'Nhan mang trackingNumbers (toi da 50), tra ve ket qua cho tung ma: ' +
      'found (tim thay) / not_found (khong tim thay) kem thong tin kien hang. ' +
      'Xu ly song song de toi da toc do.',
  })
  @ApiResponse({ status: 200, description: 'Ket qua scan hang loat' })
  @ApiResponse({ status: 400, description: 'Vuot qua gioi han 50 ma van don' })
  async batchScan(
    @Body() dto: BatchScanDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.warehouseCNService.batchScan(dto.trackingNumbers, user.id);
    return BaseResponse.ok(result, `Scan ${dto.trackingNumbers.length} ma van don hoan thanh`);
  }

  @Get('scan/history')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
  )
  @ApiOperation({
    summary: 'Lich su scan cua nhan vien',
    description:
      'Tra ve lich su cac lan scan barcode. Co the loc theo userId va ngay. ' +
      'Du lieu lay tu AuditLog voi action=SCAN_BARCODE.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Loc theo ID nhan vien' })
  @ApiQuery({ name: 'date', required: false, description: 'Loc theo ngay (ISO: 2026-03-11)', example: '2026-03-11' })
  @ApiQuery({ name: 'limit', required: false, description: 'So ban ghi tra ve (mac dinh: 20)', example: '20' })
  @ApiResponse({ status: 200, description: 'Lich su scan' })
  async getScanHistory(
    @Query('userId') userId?: string,
    @Query('date') date?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    const result = await this.warehouseCNService.getScanHistory({ userId, date, limit });
    return BaseResponse.ok(result, 'Lich su scan lay thanh cong');
  }

  @Get('scan/stats')
  @Roles(
    UserRole.WAREHOUSE_MANAGER,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({
    summary: 'Thong ke hoat dong scan',
    description:
      'Tra ve thong ke scan: tong so lan scan hom nay, trung binh moi ngay trong 30 ngay, ' +
      'top scanners (nhan vien scan nhieu nhat).',
  })
  @ApiResponse({ status: 200, description: 'Thong ke scan' })
  async getScanStats() {
    const result = await this.warehouseCNService.getScanStats();
    return BaseResponse.ok(result, 'Thong ke scan lay thanh cong');
  }

  // ─────────────────────────────────────────────────────────────────
  // PACKAGE TIMELINE — Hanh trinh di chuyen cua kien hang
  // ─────────────────────────────────────────────────────────────────

  @Get('packages/:id/timeline')
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
    UserRole.COO,
    UserRole.CEO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.CSKH,
    UserRole.SALE,
    UserRole.SALES_LEADER,
    UserRole.SALES_DIRECTOR,
  )
  @ApiOperation({
    summary: 'Lich su hanh trinh kien hang',
    description:
      'Tra ve toan bo hanh trinh cua kien hang tu khi nhan tai kho TQ den khi giao hang: ' +
      'Nhan kho TQ -> Do luong -> Xep container -> Den kho VN -> Giao hang. ' +
      'Bao gom ngay, nguoi thuc hien, anh chung minh cho tung moc.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Hanh trinh kien hang' })
  @ApiResponse({ status: 404, description: 'Khong tim thay kien hang' })
  async getPackageTimeline(@Param('id') id: string) {
    const result = await this.warehouseCNService.getPackageTimeline(id);
    return BaseResponse.ok(result, 'Hanh trinh kien hang lay thanh cong');
  }
}
