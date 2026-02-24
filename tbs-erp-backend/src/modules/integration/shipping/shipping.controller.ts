import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { ShippingCarrierService } from './shipping.service';
import { ShippingRateDto } from './dto/shipping-rate.dto';
import { PickupBookingDto } from './dto/pickup-booking.dto';

@ApiTags('Integration - Shipping Carriers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/shipping')
export class ShippingController {
  constructor(private readonly shippingCarrierService: ShippingCarrierService) {}

  @Get('track/:carrier/:trackingNumber')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER', 'SALE', 'CSKH' as any)
  @ApiOperation({
    summary: 'Track a shipment with a carrier',
    description: 'Gets real-time tracking information from the specified carrier.',
  })
  @ApiParam({ name: 'carrier', description: 'Carrier code (e.g., GHTK, GHN, DHL)' })
  @ApiParam({ name: 'trackingNumber', description: 'Tracking number' })
  async trackShipment(
    @Param('carrier') carrier: string,
    @Param('trackingNumber') trackingNumber: string,
  ) {
    const result = await this.shippingCarrierService.trackShipment(carrier, trackingNumber);
    return BaseResponse.ok(result);
  }

  @Post('rates')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER', 'SALE' as any)
  @ApiOperation({
    summary: 'Get shipping rate quotes',
    description:
      'Queries configured carriers for shipping rates based on origin, destination, and package details.',
  })
  async getRates(@Body() dto: ShippingRateDto) {
    const result = await this.shippingCarrierService.getRates(dto);
    return BaseResponse.ok(result);
  }

  @Post('pickup')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER' as any)
  @ApiOperation({
    summary: 'Book a pickup with a carrier',
    description: 'Schedules a driver from the specified carrier to collect packages.',
  })
  async bookPickup(
    @Body() dto: PickupBookingDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.shippingCarrierService.bookPickup(dto);
    return BaseResponse.ok(result, 'Pickup booked successfully');
  }

  @Get('carriers')
  @Roles('CEO', 'COO', 'LOGISTICS_MANAGER', 'WAREHOUSE_MANAGER', 'SALE', 'CSKH' as any)
  @ApiOperation({
    summary: 'Get supported shipping carriers',
    description: 'Returns the list of supported carriers with their available features.',
  })
  async getSupportedCarriers() {
    const result = await this.shippingCarrierService.getSupportedCarriers();
    return BaseResponse.ok(result);
  }

  @Post('webhook/:carrier')
  @ApiOperation({
    summary: 'Carrier webhook handler',
    description:
      'Receives status update webhooks from shipping carriers. ' +
      'This endpoint is called by the carrier systems directly.',
  })
  @ApiParam({ name: 'carrier', description: 'Carrier code' })
  async handleWebhook(
    @Param('carrier') carrier: string,
    @Body() payload: any,
  ) {
    await this.shippingCarrierService.handleCarrierWebhook(carrier, payload);
    return BaseResponse.ok(null, 'Webhook received');
  }
}
