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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { ContainerService } from './container.service';
import { CustomsSplitService } from './domain/customs-split.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { ContainerQueryDto } from './dto/container-query.dto';
import { CustomsSplitDto, ResolveHeldPackagesDto } from './dto/customs-split.dto';
import { RecordDeliveryOrderDto } from './dto/delivery-order.dto';
import { UpdateFreeTimeDto } from './dto/free-time.dto';

@ApiTags('Containers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('containers')
export class ContainerController {
  constructor(
    private readonly containerService: ContainerService,
    private readonly customsSplitService: CustomsSplitService,
  ) {}

  @Post()
  @Roles(UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.LOGISTICS_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new container',
    description: 'Creates a new container in PLANNING status for consolidating packages.',
  })
  @ApiResponse({ status: 201, description: 'Container created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateContainerDto, @CurrentUser() user: ICurrentUser) {
    const container = await this.containerService.createContainer(dto, user.id);
    return BaseResponse.ok(container, 'Container created successfully');
  }

  @Get()
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
  )
  @ApiOperation({
    summary: 'List containers',
    description: 'Returns paginated containers with filtering by status, route, and date range.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Containers retrieved successfully' })
  async findAll(@Query() query: ContainerQueryDto) {
    const result = await this.containerService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('consolidation-plan')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
  )
  @ApiOperation({
    summary: 'Get consolidation plan suggestion',
    description: 'Analyzes unassigned packages and suggests optimal container grouping by route.',
  })
  @ApiResponse({ status: 200, description: 'Consolidation plan retrieved' })
  async getConsolidationPlan() {
    const plan = await this.containerService.getConsolidationPlan();
    return BaseResponse.ok(plan);
  }

  @Get(':id')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
  )
  @ApiOperation({
    summary: 'Get container detail',
    description: 'Returns full container details including packages and related orders.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Container retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async findById(@Param('id') id: string) {
    const container = await this.containerService.findById(id);
    return BaseResponse.ok(container);
  }

  @Patch(':id')
  @Roles(UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.LOGISTICS_MANAGER)
  @ApiOperation({
    summary: 'Update container metadata',
    description: 'Updates container information. Not available for COMPLETED containers.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Container updated successfully' })
  @ApiResponse({ status: 400, description: 'Container cannot be modified' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateContainerDto) {
    const container = await this.containerService.updateContainer(id, dto);
    return BaseResponse.ok(container, 'Container updated successfully');
  }

  @Post(':id/add-packages')
  @Roles(
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add packages to container',
    description:
      'Assigns packages to a container. Only PACKED packages can be added to PLANNING/LOADING containers.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Packages added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid packages or container status' })
  @ApiResponse({ status: 404, description: 'Container or packages not found' })
  async addPackages(@Param('id') id: string, @Body('packageIds') packageIds: string[]) {
    const container = await this.containerService.addPackages(id, packageIds);
    return BaseResponse.ok(container, 'Packages added to container');
  }

  @Patch(':id/status')
  @Roles(UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.LOGISTICS_MANAGER)
  @ApiOperation({
    summary: 'Update container status',
    description: 'Transitions container to the next status. Validates FSM transitions.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const container = await this.containerService.updateStatus(id, status, user.id);
    return BaseResponse.ok(container, `Container status updated to ${status}`);
  }

  @Get(':id/fill-rate')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
  )
  @ApiOperation({
    summary: 'Get container fill rate',
    description: 'Calculates the current fill rate of a container based on assigned packages.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Fill rate calculated' })
  async getFillRate(@Param('id') id: string) {
    const fillRate = await this.containerService.calculateFillRate(id);
    return BaseResponse.ok(fillRate);
  }

  // -------------------------------------------------------------------------
  // Customs Split (Tách lô hải quan) endpoints
  // -------------------------------------------------------------------------

  @Post(':id/customs-split')
  @Roles(UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.WAREHOUSE_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Split container at customs',
    description: 'Marks selected packages as held by customs, transitions container to CUSTOMS_HOLD.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Container split successfully' })
  @ApiResponse({ status: 400, description: 'Invalid container status or packages' })
  async splitAtCustoms(
    @Param('id') id: string,
    @Body() dto: CustomsSplitDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.customsSplitService.splitAtCustoms(id, dto, user.id);
    return BaseResponse.ok(result, 'Container split at customs successfully');
  }

  @Post(':id/customs-split/resolve')
  @Roles(UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.WAREHOUSE_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve held packages',
    description: 'Releases or confiscates held packages. When all resolved, container moves to COMPLETED.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Held packages resolved' })
  @ApiResponse({ status: 400, description: 'Invalid container status or packages' })
  async resolveHeldPackages(
    @Param('id') id: string,
    @Body() dto: ResolveHeldPackagesDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.customsSplitService.resolveHeldPackages(id, dto, user.id);
    return BaseResponse.ok(result, 'Held packages resolved');
  }

  @Get(':id/customs-split/status')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.LOGISTICS_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({
    summary: 'Get customs split status',
    description: 'Returns cleared, held, and confiscated packages for a container.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Split status retrieved' })
  async getCustomsSplitStatus(@Param('id') id: string) {
    const result = await this.customsSplitService.getContainerSplitStatus(id);
    return BaseResponse.ok(result);
  }

  // -------------------------------------------------------------------------
  // Unload (Dỡ hàng) endpoints
  // -------------------------------------------------------------------------

  @Get(':id/unload-manifest')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.LOGISTICS_MANAGER, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({
    summary: 'Get container unload manifest',
    description: 'Returns the container info and its expected packages for the unload process.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Manifest retrieved' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async getUnloadManifest(@Param('id') id: string) {
    const manifest = await this.containerService.getUnloadManifest(id);
    return BaseResponse.ok(manifest);
  }

  @Post(':id/scan')
  @Roles(UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.LOGISTICS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan a package barcode during unloading',
    description:
      'Records a barcode scan and marks the matching package as received at VN warehouse.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Scan recorded' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async scanPackage(
    @Param('id') id: string,
    @Body('barcode') barcode: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.containerService.scanPackageUnload(id, barcode, user.id);
    return BaseResponse.ok(result);
  }

  // -------------------------------------------------------------------------
  // D/O — Lệnh giao hàng
  // -------------------------------------------------------------------------

  @Post(':id/delivery-order')
  @Roles(
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_MANAGER,
    UserRole.CEO, UserRole.COO,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ghi nhận lệnh giao hàng (D/O)',
    description: 'Lưu thông tin Delivery Order sau khi nhận từ đại lý tàu. Chỉ áp dụng khi container đã ARRIVED/CUSTOMS.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'D/O recorded successfully' })
  @ApiResponse({ status: 400, description: 'Container not in valid status for D/O' })
  async recordDeliveryOrder(
    @Param('id') id: string,
    @Body() dto: RecordDeliveryOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.containerService.recordDeliveryOrder(id, dto, user.id);
    return BaseResponse.ok(result, `D/O ${dto.doNumber} đã được ghi nhận`);
  }

  // -------------------------------------------------------------------------
  // Free time / Demurrage — Lưu cont / Lưu bãi
  // -------------------------------------------------------------------------

  @Patch(':id/free-time')
  @Roles(
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER, UserRole.WAREHOUSE_MANAGER,
    UserRole.CEO, UserRole.COO,
  )
  @ApiOperation({
    summary: 'Cập nhật hạn miễn phí lưu container (free time)',
    description: 'Ghi nhận ngày hết free time tại cảng để theo dõi phí demurrage/detention.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Free time updated' })
  async updateFreeTime(
    @Param('id') id: string,
    @Body() dto: UpdateFreeTimeDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.containerService.updateFreeTime(id, dto, user.id);
    return BaseResponse.ok(result, 'Đã cập nhật hạn miễn phí lưu cont');
  }

  // -------------------------------------------------------------------------
  // Analytics endpoints
  // -------------------------------------------------------------------------

  @Get(':id/timeline')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER,
    UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER, UserRole.SALE,
  )
  @ApiOperation({
    summary: 'Lịch sử hành trình container',
    description: 'Trả về toàn bộ timeline: các mốc trạng thái, tracking events, D/O và free time info.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Timeline retrieved' })
  async getTimeline(@Param('id') id: string) {
    const result = await this.containerService.getTimeline(id);
    return BaseResponse.ok(result);
  }

  @Get(':id/cost-breakdown')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER, UserRole.XNK_MANAGER, UserRole.XNK_STAFF,
    UserRole.LOGISTICS_MANAGER, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_COST,
  )
  @ApiOperation({
    summary: 'Phân tích chi phí container',
    description: 'Tổng hợp và phân nhóm chi phí vận hành (cước, THC, thuế, D/O, lưu bãi...) cho container.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Cost breakdown retrieved' })
  async getCostBreakdown(@Param('id') id: string) {
    const result = await this.containerService.getCostBreakdown(id);
    return BaseResponse.ok(result);
  }

  @Get(':id/weight-reconciliation')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_VN_MANAGER, UserRole.WAREHOUSE_VN_STAFF,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.LOGISTICS_MANAGER,
  )
  @ApiOperation({
    summary: 'Đối chiếu trọng lượng CN vs VN',
    description: 'So sánh trọng lượng khai báo tại kho TQ với trọng lượng thực tế cân tại kho VN. Phát hiện chênh lệch để điều chỉnh phí dịch vụ.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Weight reconciliation retrieved' })
  async getWeightReconciliation(@Param('id') id: string) {
    const result = await this.containerService.getWeightReconciliation(id);
    return BaseResponse.ok(result);
  }

  @Post(':id/complete-unload')
  @Roles(UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_CN_AGENT, UserRole.XNK_MANAGER, UserRole.LOGISTICS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete the container unload process',
    description: 'Finalizes the unload, marking received packages and logging discrepancies.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Unload completed' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async completeUnload(
    @Param('id') id: string,
    @Body()
    body: {
      receivedPackageIds: string[];
      surplusBarcodes: string[];
      notes?: string;
    },
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.containerService.completeUnload(
      id,
      body.receivedPackageIds,
      body.surplusBarcodes,
      body.notes,
      user.id,
    );
    return BaseResponse.ok(result);
  }
}
