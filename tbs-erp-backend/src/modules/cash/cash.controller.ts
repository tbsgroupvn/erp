import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard } from '@common/guards/data-scope.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { CashService } from './cash.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';

@ApiTags('Finance - Cash & Vouchers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('vouchers')
  @ApiOperation({
    summary: 'Create a payment or receipt voucher (with anti-fraud validation)',
  })
  async createVoucher(
    @Body() dto: CreateVoucherDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.cashService.createVoucher(dto, userId);
    return BaseResponse.ok(result, 'Voucher created successfully');
  }

  @Get('vouchers')
  @ApiOperation({ summary: 'List vouchers with pagination and filters' })
  @ApiPaginated()
  async findAll(@Query() query: VoucherQueryDto) {
    return this.cashService.findAll(query);
  }

  @Patch('vouchers/:id/approve')
  @ApiOperation({ summary: 'Approve a voucher' })
  @ApiParam({ name: 'id', description: 'Voucher ID' })
  async approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    const voucher = await this.cashService.approveVoucher(id, userId);
    return BaseResponse.ok(voucher, 'Voucher approved successfully');
  }

  @Patch('vouchers/:id/reject')
  @ApiOperation({ summary: 'Reject a voucher' })
  @ApiParam({ name: 'id', description: 'Voucher ID' })
  async reject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { reason?: string },
  ) {
    const voucher = await this.cashService.rejectVoucher(
      id,
      userId,
      body.reason,
    );
    return BaseResponse.ok(voucher, 'Voucher rejected');
  }

  @Get('flow')
  @ApiOperation({ summary: 'Get cash flow summary' })
  async getCashFlow(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const flow = await this.cashService.getCashFlow(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return BaseResponse.ok(flow);
  }
}
