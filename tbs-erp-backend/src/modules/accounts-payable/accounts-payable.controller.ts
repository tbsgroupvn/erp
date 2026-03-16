import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { AccountsPayableService } from './accounts-payable.service';
import { CreateApDto } from './dto/create-ap.dto';
import { ApQueryDto } from './dto/ap-query.dto';

@ApiTags('Finance - Accounts Payable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ap')
export class AccountsPayableController {
  constructor(private readonly apService: AccountsPayableService) {}

  @Post()
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_COST, UserRole.CFO)
  @ApiOperation({ summary: 'Create a new accounts payable record' })
  async create(@Body() dto: CreateApDto, @CurrentUser('id') userId: string) {
    const ap = await this.apService.createPayable(dto, userId);
    return BaseResponse.ok(ap, 'Accounts payable created successfully');
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_COST)
  @ApiOperation({ summary: 'List accounts payable with pagination' })
  @ApiPaginated()
  async findAll(@Query() query: ApQueryDto) {
    return this.apService.findAll(query);
  }

  @Get('summary')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_COST)
  @ApiOperation({ summary: 'Get AP summary (total open, overdue)' })
  async getSummary() {
    const summary = await this.apService.getSummary();
    return BaseResponse.ok(summary);
  }

  @Get('by-vendor/:vendorId')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_COST)
  @ApiOperation({ summary: 'Get all payables for a vendor' })
  @ApiParam({ name: 'vendorId', description: 'Vendor ID' })
  async getByVendor(@Param('vendorId') vendorId: string) {
    const data = await this.apService.getVendorPayables(vendorId);
    return BaseResponse.ok(data);
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_COST)
  @ApiOperation({ summary: 'Get a single AP record by ID' })
  @ApiParam({ name: 'id', description: 'AP record ID' })
  async findOne(@Param('id') id: string) {
    const ap = await this.apService.findById(id);
    return BaseResponse.ok(ap);
  }

  @Patch(':id/payment')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_COST, UserRole.CFO)
  @ApiOperation({ summary: 'Record a payment against an AP record' })
  @ApiParam({ name: 'id', description: 'AP record ID' })
  async recordPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; reference?: string; note?: string },
  ) {
    const ap = await this.apService.recordPayment(id, body.amount, body.reference, body.note);
    return BaseResponse.ok(ap, 'Payment recorded successfully');
  }
}
