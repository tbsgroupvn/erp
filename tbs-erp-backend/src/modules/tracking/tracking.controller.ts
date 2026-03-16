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
import { BaseResponse } from '@common/dto/base-response.dto';
import { TrackingService } from './tracking.service';
import { CreateTrackingEventDto } from './dto/create-tracking.dto';

@ApiTags('Tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a tracking event',
    description: 'Adds a manual tracking event for a package or container.',
  })
  @ApiResponse({ status: 201, description: 'Tracking event added successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Package or container not found' })
  async addTrackingEvent(@Body() dto: CreateTrackingEventDto) {
    const event = await this.trackingService.addTrackingEvent(dto);
    return BaseResponse.ok(event, 'Tracking event added successfully');
  }

  @Get('packages/:packageId')
  @ApiOperation({
    summary: 'Get package tracking history',
    description: 'Returns all tracking events for a specific package, ordered chronologically.',
  })
  @ApiParam({ name: 'packageId', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Tracking history retrieved' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async getPackageTracking(@Param('packageId') packageId: string) {
    const tracking = await this.trackingService.getTrackingHistory(packageId);
    return BaseResponse.ok(tracking);
  }

  @Get('containers/:containerId')
  @ApiOperation({
    summary: 'Get container tracking',
    description: 'Returns tracking events for a container and all its packages.',
  })
  @ApiParam({ name: 'containerId', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Container tracking retrieved' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async getContainerTracking(@Param('containerId') containerId: string) {
    const tracking = await this.trackingService.getContainerTracking(containerId);
    return BaseResponse.ok(tracking);
  }

  @Post('sync/:trackingNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync external tracking',
    description: 'Fetches tracking data from external APIs (kuaidi100/17Track) and stores locally.',
  })
  @ApiParam({ name: 'trackingNumber', description: 'Carrier tracking number' })
  @ApiQuery({
    name: 'carrier',
    required: false,
    description: 'Carrier code for Kuaidi100 (e.g., shunfeng, yuantong)',
  })
  @ApiResponse({ status: 200, description: 'Tracking synced successfully' })
  async syncExternalTracking(
    @Param('trackingNumber') trackingNumber: string,
    @Query('carrier') carrier?: string,
  ) {
    const result = await this.trackingService.syncExternalTracking(trackingNumber, carrier);
    return BaseResponse.ok(result);
  }

  @Get('customers/:customerId')
  @ApiOperation({
    summary: 'Get customer tracking',
    description: 'Returns all active shipments for a customer with their latest tracking status.',
  })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Customer tracking retrieved' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomerTracking(@Param('customerId') customerId: string) {
    const tracking = await this.trackingService.getCustomerTracking(customerId);
    return BaseResponse.ok(tracking);
  }

  @Get('packages/:packageId/eta')
  @ApiOperation({
    summary: 'Estimate delivery date',
    description:
      'Calculates estimated time of arrival based on current tracking position and route.',
  })
  @ApiParam({ name: 'packageId', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Delivery estimate retrieved' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  async estimateDelivery(@Param('packageId') packageId: string) {
    const estimate = await this.trackingService.estimateDelivery(packageId);
    return BaseResponse.ok(estimate);
  }
}
