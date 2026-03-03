import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { CrmService } from './crm.service';
import { LeadService } from './lead.service';
import { InteractionNoteService } from './interaction-note.service';
import { CustomerSupportViewService } from './customer-support-view.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { TopupWalletDto } from './dto/topup-wallet.dto';

@ApiTags('CRM - Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CrmController {
  constructor(
    private readonly crmService: CrmService,
    private readonly leadService: LeadService,
    private readonly interactionNoteService: InteractionNoteService,
    private readonly customerSupportViewService: CustomerSupportViewService,
  ) {}

  // ─── Lead CRUD (static paths, must come before :id routes) ───

  @Post('leads')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Create a new lead' })
  async createLead(@Body() dto: any, @CurrentUser('id') userId: string) {
    const lead = await this.leadService.create(dto, userId);
    return BaseResponse.ok(lead, 'Lead created');
  }

  @Get('leads')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'List leads' })
  async listLeads(@Query() query: any) {
    return this.leadService.findAll(query);
  }

  @Get('leads/:id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get lead by ID' })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  async getLead(@Param('id') id: string) {
    const lead = await this.leadService.findById(id);
    return BaseResponse.ok(lead);
  }

  @Patch('leads/:id')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Update a lead' })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  async updateLead(@Param('id') id: string, @Body() dto: any) {
    const lead = await this.leadService.update(id, dto);
    return BaseResponse.ok(lead);
  }

  @Post('leads/:id/convert')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Convert lead to customer' })
  @ApiParam({ name: 'id', description: 'Lead ID' })
  async convertLead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const customer = await this.leadService.convertToCustomer(id, userId);
    return BaseResponse.ok(customer, 'Lead converted to customer');
  }

  // ─── Customer CRUD ───

  @Post()
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Create a new customer' })
  async create(@Body() dto: CreateCustomerDto, @CurrentUser() user: ICurrentUser) {
    const customer = await this.crmService.createCustomer(dto, user);
    return BaseResponse.ok(customer, 'Customer created successfully');
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'List customers with pagination and filters' })
  @ApiPaginated()
  async findAll(@Query() query: CustomerQueryDto, @CurrentUser() user: ICurrentUser) {
    return this.crmService.listCustomers(query, user);
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const customer = await this.crmService.getCustomer(id, user);
    return BaseResponse.ok(customer);
  }

  @Patch(':id')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    const customer = await this.crmService.updateCustomer(id, dto);
    return BaseResponse.ok(customer, 'Customer updated successfully');
  }

  @Get(':id/wallet')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Get customer wallet balance' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async getWalletBalance(@Param('id') id: string) {
    const balance = await this.crmService.getWalletBalance(id);
    return BaseResponse.ok(balance);
  }

  @Post(':id/wallet/topup')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT, UserRole.SALES_DIRECTOR)
  @ApiOperation({ summary: 'Top up customer wallet' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async topupWallet(@Param('id') id: string, @Body() dto: TopupWalletDto) {
    const result = await this.crmService.topupWallet(id, dto.amount, dto.reference, dto.note, dto.bankTraceId);
    return BaseResponse.ok(
      {
        walletId: result.wallet.id,
        newBalance: result.wallet.balance.toNumber(),
        transactionId: result.transaction.id,
      },
      'Wallet topped up successfully',
    );
  }

  // ─── Interaction Notes ───

  @Post(':id/interaction-notes')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Add interaction note for customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async addInteractionNote(
    @Param('id') customerId: string,
    @Body() dto: { content: string; channel: string },
    @CurrentUser('id') userId: string,
  ) {
    const note = await this.interactionNoteService.create(
      customerId,
      dto.content,
      dto.channel,
      userId,
    );
    return BaseResponse.ok(note);
  }

  @Get(':id/interaction-notes')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get customer interaction notes' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async getInteractionNotes(@Param('id') customerId: string) {
    const notes = await this.interactionNoteService.findByCustomer(customerId);
    return BaseResponse.ok(notes);
  }

  // ─── Customer Support View ───

  @Get(':id/support-view')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Get aggregated customer support view' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async getSupportView(@Param('id') customerId: string) {
    const data = await this.customerSupportViewService.getSupportView(customerId);
    return BaseResponse.ok(data);
  }
}
