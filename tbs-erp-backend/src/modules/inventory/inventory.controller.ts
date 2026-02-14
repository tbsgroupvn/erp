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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { InventoryService } from './inventory.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { RecordMovementDto } from './dto/record-movement.dto';
import { MovementHistoryQueryDto } from './dto/inventory-query.dto';
import { StocktakeDto } from './dto/stocktake.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create stock item', description: 'Registers a new inventory item (packaging materials, supplies).' })
  @ApiResponse({ status: 201, description: 'Stock item created' })
  @ApiResponse({ status: 400, description: 'Duplicate code' })
  async createStockItem(@Body() dto: CreateStockItemDto) {
    const item = await this.inventoryService.createStockItem(dto);
    return BaseResponse.ok(item, 'Stock item created successfully');
  }

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record stock movement', description: 'Records a stock in/out movement (RECEIPT, ISSUE, ADJUSTMENT, TRANSFER).' })
  @ApiResponse({ status: 201, description: 'Movement recorded' })
  @ApiResponse({ status: 400, description: 'Insufficient stock or invalid data' })
  async recordMovement(
    @Body() dto: RecordMovementDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.inventoryService.recordMovement(dto, user.id);
    return BaseResponse.ok(result, 'Stock movement recorded');
  }

  @Get('stock')
  @ApiOperation({ summary: 'Get current stock', description: 'Returns all items with current quantities.' })
  @ApiResponse({ status: 200, description: 'Current stock retrieved' })
  async getCurrentStock() {
    const stock = await this.inventoryService.getCurrentStock();
    return BaseResponse.ok(stock);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get stock item detail', description: 'Returns single item with movement history.' })
  @ApiParam({ name: 'id', description: 'Stock item ID' })
  @ApiResponse({ status: 200, description: 'Stock item retrieved' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getStockItem(@Param('id') id: string) {
    const item = await this.inventoryService.getStockItem(id);
    return BaseResponse.ok(item);
  }

  @Get('alerts/low-stock')
  @ApiOperation({ summary: 'Get low stock alerts', description: 'Returns items below minimum level.' })
  @ApiResponse({ status: 200, description: 'Low stock alerts retrieved' })
  async getLowStockAlerts() {
    const alerts = await this.inventoryService.getLowStockAlerts();
    return BaseResponse.ok(alerts);
  }

  @Get('items/:id/movements')
  @ApiOperation({ summary: 'Get movement history', description: 'Returns movement log for a specific item.' })
  @ApiParam({ name: 'id', description: 'Stock item ID' })
  @ApiResponse({ status: 200, description: 'Movement history retrieved' })
  async getMovementHistory(
    @Param('id') id: string,
    @Query() query: MovementHistoryQueryDto,
  ) {
    const history = await this.inventoryService.getMovementHistory(id, query);
    return BaseResponse.ok(history);
  }

  @Post('stocktake')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform stocktake', description: 'Physical count reconciliation. Creates adjustments for discrepancies.' })
  @ApiResponse({ status: 200, description: 'Stocktake completed' })
  async doStocktake(
    @Body() dto: StocktakeDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.inventoryService.doStocktake(dto, user.id);
    return BaseResponse.ok(result, 'Stocktake completed');
  }
}
