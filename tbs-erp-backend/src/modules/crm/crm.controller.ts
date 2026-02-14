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
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { CrmService } from './crm.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { TopupWalletDto } from './dto/topup-wallet.dto';

@ApiTags('CRM - Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  async create(@Body() dto: CreateCustomerDto) {
    const customer = await this.crmService.createCustomer(dto);
    return BaseResponse.ok(customer, 'Customer created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List customers with pagination and filters' })
  @ApiPaginated()
  async findAll(@Query() query: CustomerQueryDto) {
    return this.crmService.listCustomers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async findOne(@Param('id') id: string) {
    const customer = await this.crmService.getCustomer(id);
    return BaseResponse.ok(customer);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.crmService.updateCustomer(id, dto);
    return BaseResponse.ok(customer, 'Customer updated successfully');
  }

  @Get(':id/wallet')
  @ApiOperation({ summary: 'Get customer wallet balance' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async getWalletBalance(@Param('id') id: string) {
    const balance = await this.crmService.getWalletBalance(id);
    return BaseResponse.ok(balance);
  }

  @Post(':id/wallet/topup')
  @ApiOperation({ summary: 'Top up customer wallet' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async topupWallet(
    @Param('id') id: string,
    @Body() dto: TopupWalletDto,
  ) {
    const result = await this.crmService.topupWallet(
      id,
      dto.amount,
      dto.reference,
      dto.note,
    );
    return BaseResponse.ok(
      {
        walletId: result.wallet.id,
        newBalance: result.wallet.balance.toNumber(),
        transactionId: result.transaction.id,
      },
      'Wallet topped up successfully',
    );
  }
}
