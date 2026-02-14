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
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { RecordReceiptDto } from './dto/record-receipt.dto';

@ApiTags('Purchase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase request', description: 'Creates a new purchase request with items. Auto-generates code PR-YYYYMM-XXXX.' })
  @ApiResponse({ status: 201, description: 'Purchase request created successfully' })
  async createPurchaseRequest(
    @Body() dto: CreatePurchaseRequestDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const pr = await this.purchaseService.createPurchaseRequest(user.id, dto);
    return BaseResponse.ok(pr, 'Purchase request created successfully');
  }

  @Patch('requests/:id/approve')
  @ApiOperation({ summary: 'Approve purchase request', description: 'Approves a submitted purchase request.' })
  @ApiParam({ name: 'id', description: 'Purchase request ID' })
  @ApiResponse({ status: 200, description: 'PR approved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status for approval' })
  async approvePR(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const pr = await this.purchaseService.approvePR(id, user.id);
    return BaseResponse.ok(pr, 'Purchase request approved');
  }

  @Post('requests/:id/convert')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convert PR to PO', description: 'Converts an approved purchase request into a purchase order.' })
  @ApiParam({ name: 'id', description: 'Purchase request ID' })
  @ApiResponse({ status: 201, description: 'PO created from PR' })
  @ApiResponse({ status: 400, description: 'PR not in APPROVED status or missing vendor' })
  async convertToPO(@Param('id') id: string) {
    const po = await this.purchaseService.convertToPO(id);
    return BaseResponse.ok(po, 'Purchase order created from request');
  }

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase order', description: 'Creates a purchase order directly. Auto-generates code PO-YYYYMM-XXXX.' })
  @ApiResponse({ status: 201, description: 'Purchase order created successfully' })
  async createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const po = await this.purchaseService.createPurchaseOrder(dto, user.id);
    return BaseResponse.ok(po, 'Purchase order created successfully');
  }

  @Post('orders/:id/receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record goods receipt', description: 'Records goods receipt against a purchase order.' })
  @ApiParam({ name: 'id', description: 'Purchase order ID' })
  @ApiResponse({ status: 200, description: 'Receipt recorded' })
  async recordReceipt(
    @Param('id') id: string,
    @Body() dto: RecordReceiptDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.purchaseService.recordReceipt(id, dto, user.id);
    return BaseResponse.ok(result, 'Goods receipt recorded');
  }

  @Get('requests')
  @ApiOperation({ summary: 'List purchase requests', description: 'Returns paginated purchase requests with filters.' })
  @ApiResponse({ status: 200, description: 'Purchase requests retrieved' })
  async findAll(@Query() query: PurchaseQueryDto) {
    const result = await this.purchaseService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get vendor purchase history', description: 'Returns all purchase requests and orders for a vendor.' })
  @ApiParam({ name: 'vendorId', description: 'Vendor ID' })
  @ApiResponse({ status: 200, description: 'Vendor purchases retrieved' })
  async getVendorPurchases(@Param('vendorId') vendorId: string) {
    const result = await this.purchaseService.getVendorPurchases(vendorId);
    return BaseResponse.ok(result);
  }
}
