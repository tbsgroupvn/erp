import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
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
import { CustomerAnalyticsService } from './domain/customer-analytics.service';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateInteractionNoteDto } from './dto/create-interaction-note.dto';
import { CreateCustomerQuickDto } from './dto/create-customer-quick.dto';

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
    private readonly customerAnalyticsService: CustomerAnalyticsService,
  ) { }

  // ─── Lead CRUD (static paths, must come before :id routes) ───

  @Post('leads')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Create a new lead' })
  async createLead(@Body() dto: CreateLeadDto, @CurrentUser('id') userId: string) {
    const lead = await this.leadService.create(dto, userId);
    return BaseResponse.ok(lead, 'Lead created');
  }

  @Get('leads')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'List leads' })
  async listLeads(@Query() _query: Record<string, string>) {
    return this.leadService.findAll(_query);
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
  async updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
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

  // ─── Analytics & AI Predictions (static paths — phai dat TRUOC :id routes) ───

  /**
   * GET /customers/analytics/churn-risk
   * Danh sach khach hang co nguy co roi bo cao.
   * Duong dan tinh nay phai dat TRUOC :id routes de tranh conflict routing.
   */
  @Get('analytics/churn-risk')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Danh sach khach hang co nguy co roi bo cao (HIGH/CRITICAL)',
    description:
      'Tra ve danh sach khach hang co muc churn risk la HIGH hoac CRITICAL, phan trang theo daysSinceLastOrder giam dan. ' +
      'Su dung cho Sale/Manager de uu tien cham soc khach hang sap roi bo.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Trang (mac dinh: 1)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'So ban ghi / trang (mac dinh: 20, toi da: 100)',
  })
  @ApiQuery({
    name: 'risk',
    required: false,
    enum: ['HIGH', 'CRITICAL'],
    description: 'Loc theo muc rui ro cu the. Mac dinh: tra ve ca HIGH va CRITICAL.',
  })
  async listChurnRisk(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('risk') risk?: string,
  ) {
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Number(limit) || 20, 100);

    // Xac dinh dieu kien loc theo risk
    const riskFilter =
      risk && ['HIGH', 'CRITICAL'].includes(risk.toUpperCase())
        ? [risk.toUpperCase()]
        : ['HIGH', 'CRITICAL'];

    const { data, total } = await this.customerAnalyticsService.findHighChurnRisk(
      riskFilter,
      pageNum,
      limitNum,
    );

    return BaseResponse.ok({
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  // ─── Customer CRUD ───

  @Post('quick')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.CSKH, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Create a new customer quickly' })
  async createQuick(@Body() dto: CreateCustomerQuickDto, @CurrentUser() user: ICurrentUser) {
    const customer = await this.crmService.createQuickCustomer(dto, user);
    return BaseResponse.ok(customer, 'Customer created successfully via Quick Add');
  }

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
    if (dto.amount !== dto.confirmAmount) {
      throw new BadRequestException(
        `So tien xac nhan khong khop: amount=${dto.amount}, confirmAmount=${dto.confirmAmount}. Vui long kiem tra lai.`,
      );
    }
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
    @Body() dto: CreateInteractionNoteDto,
    @CurrentUser('id') userId: string,
  ) {
    const note = await this.interactionNoteService.create(
      customerId,
      dto.content,
      dto.channel ?? 'OTHER',
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

  /**
   * GET /customers/:id/analytics
   * Tra ve du lieu analytics va du bao hanh vi cho mot khach hang cu the.
   * Neu chua co ban ghi analytics, tinh toan ngay lap tuc va luu vao DB.
   */
  @Get(':id/analytics')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.CSKH,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Lay thong tin analytics va du bao hanh vi cua mot khach hang',
    description:
      'Tra ve du lieu phan tich hanh vi dat hang: tan suat trung binh, ' +
      'muc rui ro roi bo (churnRisk), du bao ngay dat hang tiep theo (predictedNextOrder), ' +
      'va Customer Lifetime Value (CLV - du bao 3 nam). ' +
      'Neu chua co du lieu analytics, he thong tu dong tinh toan va luu ket qua.',
  })
  @ApiParam({ name: 'id', description: 'ID cua khach hang' })
  async getCustomerAnalytics(@Param('id') customerId: string) {
    // Thu lay tu DB truoc — tranh tinh lai khong can thiet
    const existing = await this.customerAnalyticsService.findByCustomer(customerId);
    if (existing) {
      return BaseResponse.ok(existing);
    }

    // Chua co ban ghi: tinh toan ngay va upsert
    await this.customerAnalyticsService.calculateForCustomer(customerId);

    // Lay lai ban ghi vua upsert de tra ve du include customer
    const freshRecord = await this.customerAnalyticsService.findByCustomer(customerId);
    return BaseResponse.ok(freshRecord);
  }
}
