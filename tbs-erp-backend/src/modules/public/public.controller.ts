import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BaseResponse } from '@common/dto/base-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { PublicService } from './public.service';
import { CaptureLeadDto } from './dto/capture-lead.dto';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Capture lead from public website',
    description:
      'Public endpoint to capture leads without authentication. Creates new customer or adds contact to existing customer based on phone number.',
  })
  @ApiResponse({
    status: 201,
    description: 'Lead captured successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 201 },
        message: { type: 'string', example: 'Lead captured successfully' },
        data: {
          type: 'object',
          properties: {
            customer: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                code: { type: 'string', example: 'TBS-KH-000001' },
                fullName: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                tier: { type: 'string', example: 'NEW' },
              },
            },
            contact: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                fullName: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                position: { type: 'string' },
              },
            },
            isNewCustomer: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  async captureLead(@Body() dto: CaptureLeadDto) {
    const result = await this.publicService.captureLead(dto);

    return {
      statusCode: HttpStatus.CREATED,
      message: result.isNewCustomer
        ? 'Lead captured - New customer created'
        : 'Lead captured - Contact added to existing customer',
      data: result,
    };
  }

  @Public()
  @Get('tracking/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track order by code',
    description:
      'Public endpoint to track order status by order code or container code. Returns non-sensitive tracking information.',
  })
  @ApiParam({
    name: 'code',
    description: 'Order code (e.g., TBS-ORD-240101-0001) or container code',
  })
  @ApiResponse({
    status: 200,
    description: 'Tracking information retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Order or container not found' })
  async trackByCode(@Param('code') code: string) {
    const result = await this.publicService.trackByCode(code);

    if (!result) {
      throw new NotFoundException(
        `Không tìm thấy đơn hàng hoặc container với mã: ${code}`,
      );
    }

    return BaseResponse.ok(result, 'Tracking information retrieved successfully');
  }
}
