import {
  Controller,
  Get,
  Post,
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
import { DataScopeGuard, DataScopeFilter } from '@common/guards/data-scope.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { DataScope } from '@common/decorators/data-scope.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { MasterOrderService } from './master-order.service';
import { CreateMasterOrderDto } from './dto/create-master-order.dto';
import { CreateSubOrderDto } from './dto/create-master-order.dto';
import { MasterOrderQueryDto } from './dto/master-order-query.dto';

@ApiTags('Master Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('master-orders')
export class MasterOrderController {
  constructor(private readonly masterOrderService: MasterOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new master order with sub orders',
    description:
      'Creates a master order (don tong) with one or more sub orders (don con). ' +
      'Each sub order has its own service type, clearance type, and items.',
  })
  @ApiResponse({ status: 201, description: 'Master order created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or missing saleCode' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async create(
    @Body() dto: CreateMasterOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const masterOrder = await this.masterOrderService.createMasterOrder(dto, user);
    return BaseResponse.ok(masterOrder, 'Master order created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List master orders',
    description:
      'Returns paginated master orders with filtering by status, branch, customer, sale, and date range.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Master orders retrieved successfully' })
  async findAll(
    @Query() query: MasterOrderQueryDto,
    @DataScope() dataScope: DataScopeFilter | undefined,
  ) {
    const result = await this.masterOrderService.findAll(query, dataScope);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get master order detail',
    description:
      'Returns full master order details including customer, sale, and all sub orders with their items and status history.',
  })
  @ApiParam({ name: 'id', description: 'Master Order ID' })
  @ApiResponse({ status: 200, description: 'Master order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Master order not found' })
  async findById(
    @Param('id') id: string,
    @DataScope() dataScope: DataScopeFilter | undefined,
  ) {
    const masterOrder = await this.masterOrderService.findById(id, dataScope);
    return BaseResponse.ok(masterOrder);
  }

  @Post(':id/sub-orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a sub order to an existing master order',
    description:
      'Adds a new sub order (don con) to an existing master order. The master order must be in ACTIVE status.',
  })
  @ApiParam({ name: 'id', description: 'Master Order ID' })
  @ApiResponse({ status: 201, description: 'Sub order added successfully' })
  @ApiResponse({ status: 400, description: 'Master order is not active' })
  @ApiResponse({ status: 404, description: 'Master order not found' })
  async addSubOrder(
    @Param('id') id: string,
    @Body() dto: CreateSubOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const masterOrder = await this.masterOrderService.addSubOrder(id, dto, user);
    return BaseResponse.ok(masterOrder, 'Sub order added successfully');
  }
}
