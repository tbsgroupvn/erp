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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { CustomerPortalService } from './customer-portal.service';
import { SubmitPreAlertDto } from './dto/submit-pre-alert.dto';
import { UpdateCustomerProfileDto } from './dto/update-profile.dto';
import { CustomerOrderQueryDto } from './dto/portal-query.dto';

/**
 * Customer Portal APIs.
 *
 * Ownership verification: if the authenticated user is an impersonated customer
 * (isImpersonation=true, user.id = customerId), they can only access their own
 * data. Internal staff (non-impersonation) can access any customer's data as
 * they already pass through RBAC checks.
 */
@ApiTags('Customer Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portal')
export class CustomerPortalController {
  constructor(private readonly portalService: CustomerPortalService) {}

  /**
   * Verify that the authenticated user is allowed to access data for the
   * given customerId. Impersonated customer tokens have user.id set to the
   * target customerId — they must only access their own resources.
   */
  private verifyOwnership(
    user: { id: string; isImpersonation?: boolean },
    customerId: string,
  ): void {
    if (user.isImpersonation && user.id !== customerId) {
      throw new ForbiddenException(
        'Access denied: you can only access your own data',
      );
    }
  }

  @Get(':customerId/orders')
  @ApiOperation({ summary: 'Get customer orders' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  async getMyOrders(
    @Param('customerId') customerId: string,
    @Query() query: CustomerOrderQueryDto,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const result = await this.portalService.getMyOrders(customerId, query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':customerId/orders/:orderId')
  @ApiOperation({ summary: 'Get order detail' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  async getOrderDetail(
    @Param('customerId') customerId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const order = await this.portalService.getOrderDetail(customerId, orderId);
    return BaseResponse.ok(order);
  }

  @Get(':customerId/wallet')
  @ApiOperation({ summary: 'Get wallet balance and transactions' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getMyWallet(
    @Param('customerId') customerId: string,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const wallet = await this.portalService.getMyWallet(customerId);
    return BaseResponse.ok(wallet);
  }

  @Post(':customerId/pre-alerts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a tracking pre-alert' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 201, description: 'Pre-alert submitted' })
  async submitPreAlert(
    @Param('customerId') customerId: string,
    @Body() dto: SubmitPreAlertDto,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const result = await this.portalService.submitPreAlert(customerId, dto);
    return BaseResponse.ok(result, 'Pre-alert submitted');
  }

  @Get(':customerId/pre-alerts')
  @ApiOperation({ summary: 'Get customer pre-alerts' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getMyPreAlerts(
    @Param('customerId') customerId: string,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const preAlerts = await this.portalService.getMyPreAlerts(customerId);
    return BaseResponse.ok(preAlerts);
  }

  @Get(':customerId/tracking/:packageId')
  @ApiOperation({ summary: 'Get shipment tracking for a package' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiParam({ name: 'packageId', description: 'Package ID' })
  async getShipmentTracking(
    @Param('customerId') customerId: string,
    @Param('packageId') packageId: string,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const tracking = await this.portalService.getShipmentTracking(customerId, packageId);
    return BaseResponse.ok(tracking);
  }

  @Get(':customerId/invoices')
  @ApiOperation({ summary: 'Get customer invoices' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getMyInvoices(
    @Param('customerId') customerId: string,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const invoices = await this.portalService.getMyInvoices(customerId);
    return BaseResponse.ok(invoices);
  }

  @Get(':customerId/notifications')
  @ApiOperation({ summary: 'Get customer notifications' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async getMyNotifications(
    @Param('customerId') customerId: string,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const notifications = await this.portalService.getMyNotifications(customerId);
    return BaseResponse.ok(notifications);
  }

  @Patch(':customerId/profile')
  @ApiOperation({ summary: 'Update customer profile' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  async updateProfile(
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerProfileDto,
    @CurrentUser() user: { id: string; isImpersonation?: boolean },
  ) {
    this.verifyOwnership(user, customerId);
    const customer = await this.portalService.updateProfile(customerId, dto);
    return BaseResponse.ok(customer, 'Profile updated');
  }
}
