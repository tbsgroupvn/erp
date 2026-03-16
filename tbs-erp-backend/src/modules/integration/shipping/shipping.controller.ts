import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { Public } from '@common/decorators/public.decorator';
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
  private readonly logger = new Logger(ShippingController.name);

  constructor(
    private readonly shippingCarrierService: ShippingCarrierService,
    private readonly configService: ConfigService,
  ) {}

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
  async bookPickup(@Body() dto: PickupBookingDto, @CurrentUser('id') _userId: string) {
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

  /**
   * PUBLIC endpoint — authenticated via HMAC-SHA256 signature, NOT JWT.
   * Carrier systems (GHTK, GHN, DHL, etc.) send status updates here.
   * Always returns 200 OK to prevent carrier retries on auth failures.
   */
  @Post('webhook/:carrier')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Carrier webhook handler (public, HMAC-authenticated)',
    description:
      'Receives status update webhooks from shipping carriers. ' +
      'This endpoint is called by carrier systems directly and is authenticated ' +
      'via HMAC-SHA256 signature in the X-Webhook-Signature header.',
  })
  @ApiParam({ name: 'carrier', description: 'Carrier code (e.g., GHTK, GHN, DHL)' })
  async handleWebhook(
    @Param('carrier') carrier: string,
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // Verify HMAC-SHA256 signature
    const secret = this.configService.get<string>('CARRIER_WEBHOOK_SECRET', '');
    if (!secret) {
      this.logger.error('CARRIER_WEBHOOK_SECRET not configured — rejecting all carrier webhooks');
      throw new UnauthorizedException('Webhook authentication not configured');
    }

    if (!signature) {
      this.logger.warn(`Missing X-Webhook-Signature header from carrier=${carrier}`);
      throw new UnauthorizedException('Missing webhook signature');
    }

    const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(payload);
    try {
      const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
      const sigBuffer = Buffer.from(signature);
      const computedBuffer = Buffer.from(computed);

      if (
        sigBuffer.length !== computedBuffer.length ||
        !timingSafeEqual(sigBuffer, computedBuffer)
      ) {
        this.logger.warn(`Invalid webhook signature from carrier=${carrier}`);
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`Webhook signature verification error from carrier=${carrier}: ${err}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.shippingCarrierService.handleCarrierWebhook(carrier, payload);
    return BaseResponse.ok(null, 'Webhook received');
  }
}
