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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { OperationCostService } from './operation-cost.service';
import { CreateCostDto } from './dto/create-cost.dto';
import { CostQueryDto } from './dto/cost-query.dto';

@ApiTags('Operation Costs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('operation-costs')
export class OperationCostController {
  constructor(
    private readonly operationCostService: OperationCostService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record an operation cost',
    description:
      'Records a cost entry for a container/trip with type, amount, and optional invoice reference.',
  })
  @ApiResponse({ status: 201, description: 'Cost recorded successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async recordCost(@Body() dto: CreateCostDto) {
    const cost = await this.operationCostService.recordCost(dto);
    return BaseResponse.ok(cost, 'Operation cost recorded successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List operation costs',
    description:
      'Returns paginated operation costs with filtering by cost type, container, and date range.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Costs retrieved successfully' })
  async findAll(@Query() query: CostQueryDto) {
    const result = await this.operationCostService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get cost summary',
    description:
      'Returns aggregated cost summary by cost type, currency, and top containers.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'Summary retrieved' })
  async getCostSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const summary = await this.operationCostService.getCostSummary({
      startDate,
      endDate,
    });
    return BaseResponse.ok(summary);
  }

  @Get('containers/:containerId')
  @ApiOperation({
    summary: 'Get container costs',
    description:
      'Returns all costs for a specific container with aggregation by type.',
  })
  @ApiParam({ name: 'containerId', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Container costs retrieved' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async getContainerCosts(@Param('containerId') containerId: string) {
    const result =
      await this.operationCostService.getContainerCosts(containerId);
    return BaseResponse.ok(result);
  }

  @Post('containers/:containerId/allocate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Allocate container costs to orders',
    description:
      'Distributes container costs to individual orders by weight, volume, or evenly.',
  })
  @ApiParam({ name: 'containerId', description: 'Container ID' })
  @ApiQuery({
    name: 'method',
    required: false,
    enum: ['WEIGHT', 'VOLUME', 'EVEN'],
    description: 'Allocation method (default: WEIGHT)',
  })
  @ApiResponse({ status: 200, description: 'Costs allocated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot allocate costs' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async allocateCosts(
    @Param('containerId') containerId: string,
    @Query('method') method?: 'WEIGHT' | 'VOLUME' | 'EVEN',
  ) {
    const allocations = await this.operationCostService.allocateCosts(
      containerId,
      method,
    );
    return BaseResponse.ok(allocations, 'Costs allocated successfully');
  }

  @Get('containers/:containerId/cost-per-kg')
  @ApiOperation({
    summary: 'Get cost per kg for a container',
    description:
      'Calculates total cost divided by total chargeable weight for a container.',
  })
  @ApiParam({ name: 'containerId', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Cost per kg calculated' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async getCostPerKg(@Param('containerId') containerId: string) {
    const result =
      await this.operationCostService.getCostPerKg(containerId);
    return BaseResponse.ok(result);
  }

  @Get('containers/:containerId/variance')
  @ApiOperation({
    summary: 'Get variance report for a container',
    description:
      'Compares estimated vs actual costs for each cost item in a container.',
  })
  @ApiParam({ name: 'containerId', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Variance report retrieved' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async getVarianceReport(@Param('containerId') containerId: string) {
    const report =
      await this.operationCostService.getVarianceReport(containerId);
    return BaseResponse.ok(report);
  }

  @Get('orders/:orderId')
  @ApiOperation({
    summary: 'Get order cost breakdown',
    description:
      'Returns total allocated costs for an order with profitability analysis.',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cost retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderCost(@Param('orderId') orderId: string) {
    const result = await this.operationCostService.getOrderCost(orderId);
    return BaseResponse.ok(result);
  }
}
