import {
  BadRequestException,
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { UserRole } from '@prisma/client';
import { CostAdjustmentService } from './cost-adjustment.service';
import { CreateCostAdjustmentDto } from './dto/create-cost-adjustment.dto';
import { CostAdjustmentQueryDto } from './dto/cost-adjustment-query.dto';

@ApiTags('Cost Adjustments')
@ApiBearerAuth()
@Controller('cost-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CostAdjustmentController {
  constructor(private readonly costAdjustmentService: CostAdjustmentService) {}

  @Post()
  @Roles(UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_COST, UserRole.CHIEF_ACCOUNTANT, UserRole.CFO)
  @ApiOperation({ summary: 'Create a cost adjustment for a completed order' })
  @ApiResponse({ status: 201, description: 'Cost adjustment created' })
  async create(
    @Body() dto: CreateCostAdjustmentDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.costAdjustmentService.create(dto, user.id);
  }

  @Get()
  @Roles(
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_COST,
    UserRole.ACCOUNTANT_AR,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.CFO,
    UserRole.CEO,
    UserRole.COO,
  )
  @ApiOperation({ summary: 'List cost adjustments with filters' })
  @ApiResponse({ status: 200, description: 'List of cost adjustments' })
  async findAll(@Query() query: CostAdjustmentQueryDto) {
    return this.costAdjustmentService.findAll(query);
  }

  @Get('impact/:orderId')
  @Roles(
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_COST,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.CFO,
    UserRole.CEO,
  )
  @ApiOperation({ summary: 'Preview profit/commission impact for an order (dry-run)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Impact preview' })
  async previewImpact(@Param('orderId') orderId: string) {
    return this.costAdjustmentService.previewImpact(orderId);
  }

  @Get('order/:orderId')
  @Roles(
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_COST,
    UserRole.ACCOUNTANT_AR,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.CFO,
    UserRole.CEO,
    UserRole.COO,
    UserRole.SALE,
    UserRole.SALES_LEADER,
    UserRole.SALES_DIRECTOR,
  )
  @ApiOperation({ summary: 'List cost adjustments for a specific order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Cost adjustments for the order' })
  async findByOrder(@Param('orderId') orderId: string) {
    return this.costAdjustmentService.findByOrder(orderId);
  }

  @Get(':id')
  @Roles(
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_COST,
    UserRole.ACCOUNTANT_AR,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.CFO,
    UserRole.CEO,
    UserRole.COO,
  )
  @ApiOperation({ summary: 'Get a cost adjustment by ID' })
  @ApiParam({ name: 'id', description: 'Cost adjustment ID' })
  @ApiResponse({ status: 200, description: 'Cost adjustment details' })
  async findById(@Param('id') id: string) {
    return this.costAdjustmentService.findById(id);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.CFO)
  @ApiOperation({ summary: 'Approve a cost adjustment (creates GL entry, recalculates commission)' })
  @ApiParam({ name: 'id', description: 'Cost adjustment ID' })
  @ApiResponse({ status: 200, description: 'Cost adjustment approved' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.costAdjustmentService.approve(id, user.id);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.CFO)
  @ApiOperation({ summary: 'Reject a cost adjustment' })
  @ApiParam({ name: 'id', description: 'Cost adjustment ID' })
  @ApiResponse({ status: 200, description: 'Cost adjustment rejected' })
  async reject(
    @Param('id') id: string,
    @Body('rejectionNote') rejectionNote: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    if (!rejectionNote || rejectionNote.trim().length === 0) {
      throw new BadRequestException('Rejection note is required.');
    }
    return this.costAdjustmentService.reject(id, user.id, rejectionNote);
  }
}
