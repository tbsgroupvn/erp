import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { RateCardService } from './rate-card.service';
import { CreateRateCardDto, RateCardQueryDto, LookupRateCardDto } from './dto/rate-card.dto';
import { CreateVolumeTierDto, UpdateVolumeTierDto, CalculatePriceQueryDto } from './dto/volume-tier.dto';
import { CreateSeasonalRuleDto, UpdateSeasonalRuleDto } from './dto/seasonal-rule.dto';
import {
  CreateCustomerPriceOverrideDto,
  UpdateCustomerPriceOverrideDto,
  SimulatePriceDto,
} from './dto/customer-price-override.dto';

// Cac role co quyen quan ly rate card
const ADMIN_ROLES = [
  UserRole.CEO,
  UserRole.COO,
  UserRole.CFO,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.LOGISTICS_MANAGER,
] as const;

// Cac role co quyen xem rate card
const READ_ROLES = [
  ...ADMIN_ROLES,
  UserRole.SALES_DIRECTOR,
  UserRole.SALES_LEADER,
  UserRole.SALE,
] as const;

// Cac role co quyen lookup / tinh gia
const LOOKUP_ROLES = [
  UserRole.CEO,
  UserRole.COO,
  UserRole.SALES_DIRECTOR,
  UserRole.SALES_LEADER,
  UserRole.SALE,
  UserRole.CSKH,
  UserRole.LOGISTICS_MANAGER,
] as const;

@ApiTags('Rate Cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rate-cards')
export class RateCardController {
  constructor(private readonly rateCardService: RateCardService) {}

  // ----------------------------------------------------------------
  // RATE CARD CRUD
  // ----------------------------------------------------------------

  @Post()
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tao bang gia cuoc moi' })
  async create(@Body() dto: CreateRateCardDto, @CurrentUser() user: ICurrentUser) {
    const rc = await this.rateCardService.create(user.id, dto);
    return BaseResponse.ok(rc, 'Tao bang gia cuoc thanh cong');
  }

  @Get()
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Danh sach bang gia cuoc (co phan trang, filter theo tuyen/mode)' })
  async findAll(@Query() query: RateCardQueryDto) {
    const result = await this.rateCardService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('lookup')
  @Roles(...LOOKUP_ROLES)
  @ApiOperation({
    summary: 'Tra cuu gia cuoc theo tuyen + CBM/KG. Bao gom ap dung volume tier tu dong.',
  })
  async lookup(@Query() dto: LookupRateCardDto) {
    const result = await this.rateCardService.lookup(dto);
    return BaseResponse.ok(result);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({ summary: 'Chi tiet bang gia cuoc (bao gom surcharge, discount, volume tier)' })
  async findOne(@Param('id') id: string) {
    const rc = await this.rateCardService.findOne(id);
    return BaseResponse.ok(rc);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.LOGISTICS_MANAGER)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({ summary: 'Vo hieu hoa bang gia cuoc' })
  async deactivate(@Param('id') id: string) {
    const rc = await this.rateCardService.deactivate(id);
    return BaseResponse.ok(rc, 'Da vo hieu hoa');
  }

  // ----------------------------------------------------------------
  // DYNAMIC PRICING — tinh gia theo can nang
  // ----------------------------------------------------------------

  @Get(':id/calculate-price')
  @Roles(...LOOKUP_ROLES)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiQuery({
    name: 'weight',
    required: true,
    type: Number,
    description: 'Can nang (kg) can tinh gia. Thuong la chargeable weight.',
    example: 350,
  })
  @ApiOperation({
    summary: 'Tinh gia cuoc cho can nang cu the',
    description:
      'Tra ve don gia cuoc (VND/kg) sau khi ap dung volume tier. ' +
      'Ket qua bao gom: basePrice (gia goc), tierApplied (tier duoc ap dung), ' +
      'finalPricePerKg (don gia sau giam), shippingAmount (tong cuoc = finalPricePerKg * weight).',
  })
  async calculatePrice(
    @Param('id') id: string,
    @Query() query: CalculatePriceQueryDto,
  ) {
    const date = query.date ? new Date(query.date) : undefined;
    const result = await this.rateCardService.calculatePrice(id, query.weight, query.customerId, date);
    return BaseResponse.ok(result);
  }

  // ----------------------------------------------------------------
  // VOLUME TIER CRUD
  // ----------------------------------------------------------------

  @Get(':id/volume-tiers')
  @Roles(...READ_ROLES)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({
    summary: 'Lay danh sach volume tier cua bang gia cuoc',
    description: 'Tra ve cac muc gia theo san luong, sap xep theo minWeight tang dan.',
  })
  async getVolumeTiers(@Param('id') id: string) {
    const tiers = await this.rateCardService.getVolumeTiers(id);
    return BaseResponse.ok(tiers);
  }

  @Post(':id/volume-tiers')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({
    summary: 'Them volume tier moi vao bang gia cuoc',
    description:
      'Them muc gia theo san luong. He thong tu dong kiem tra khong bi overlap ' +
      'voi cac tier hien co cua cung rate card. ' +
      'Neu fixedPrice duoc cung cap thi se dung lam don gia thay vi tinh theo discountPct.',
  })
  async addVolumeTier(
    @Param('id') id: string,
    @Body() dto: CreateVolumeTierDto,
  ) {
    const tier = await this.rateCardService.addVolumeTier(id, dto);
    return BaseResponse.ok(tier, 'Them volume tier thanh cong');
  }

  @Patch('volume-tiers/:tierId')
  @Roles(...ADMIN_ROLES)
  @ApiParam({ name: 'tierId', description: 'Volume tier ID' })
  @ApiOperation({
    summary: 'Cap nhat volume tier',
    description:
      'Cap nhat mot phan volume tier (partial update). ' +
      'Truyen maxWeight: null de xoa gioi han tren. ' +
      'He thong kiem tra lai overlap sau khi cap nhat.',
  })
  async updateVolumeTier(
    @Param('tierId') tierId: string,
    @Body() dto: UpdateVolumeTierDto,
  ) {
    const tier = await this.rateCardService.updateVolumeTier(tierId, dto);
    return BaseResponse.ok(tier, 'Cap nhat volume tier thanh cong');
  }

  @Delete('volume-tiers/:tierId')
  @Roles(...ADMIN_ROLES)
  @ApiParam({ name: 'tierId', description: 'Volume tier ID' })
  @ApiOperation({ summary: 'Xoa volume tier' })
  async removeVolumeTier(@Param('tierId') tierId: string) {
    const result = await this.rateCardService.removeVolumeTier(tierId);
    return BaseResponse.ok(result, 'Da xoa volume tier');
  }

  // ----------------------------------------------------------------
  // SEASONAL RULES CRUD
  // ----------------------------------------------------------------

  @Get(':id/seasonal-rules')
  @Roles(...READ_ROLES)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({
    summary: 'Lay danh sach seasonal rule cua bang gia cuoc',
    description: 'Tra ve cac quy tac dieu chinh gia theo mua vu (Tet, cao diem...), sap xep theo ngay bat dau.',
  })
  async getSeasonalRules(@Param('id') id: string) {
    const rules = await this.rateCardService.getSeasonalRules(id);
    return BaseResponse.ok(rules);
  }

  @Post(':id/seasonal-rules')
  @Roles(...ADMIN_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({
    summary: 'Tao seasonal rule moi',
    description:
      'Them quy tac dieu chinh gia theo mua vu. adjustPct duong (+) = tang gia, am (-) = giam gia. ' +
      'VD: adjustPct=15 -> tang 15% trong dip Tet.',
  })
  async createSeasonalRule(
    @Param('id') id: string,
    @Body() dto: CreateSeasonalRuleDto,
  ) {
    const rule = await this.rateCardService.createSeasonalRule(id, dto);
    return BaseResponse.ok(rule, 'Tao seasonal rule thanh cong');
  }

  @Patch('seasonal-rules/:ruleId')
  @Roles(...ADMIN_ROLES)
  @ApiParam({ name: 'ruleId', description: 'Seasonal rule ID' })
  @ApiOperation({ summary: 'Cap nhat seasonal rule' })
  async updateSeasonalRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateSeasonalRuleDto,
  ) {
    const rule = await this.rateCardService.updateSeasonalRule(ruleId, dto);
    return BaseResponse.ok(rule, 'Cap nhat seasonal rule thanh cong');
  }

  @Delete('seasonal-rules/:ruleId')
  @Roles(...ADMIN_ROLES)
  @ApiParam({ name: 'ruleId', description: 'Seasonal rule ID' })
  @ApiOperation({ summary: 'Xoa seasonal rule' })
  async removeSeasonalRule(@Param('ruleId') ruleId: string) {
    const result = await this.rateCardService.removeSeasonalRule(ruleId);
    return BaseResponse.ok(result, 'Da xoa seasonal rule');
  }

  // ----------------------------------------------------------------
  // CUSTOMER PRICE OVERRIDE CRUD
  // ----------------------------------------------------------------

  @Get(':id/customer-overrides')
  @Roles(...ADMIN_ROLES)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiQuery({ name: 'customerId', required: false, description: 'Filter theo KH cu the' })
  @ApiOperation({
    summary: 'Lay danh sach customer price override',
    description: 'Tra ve cac gia rieng da thiet lap cho tung khach hang tren bang gia cuoc nay.',
  })
  async getCustomerOverrides(
    @Param('id') id: string,
    @Query('customerId') customerId?: string,
  ) {
    const overrides = await this.rateCardService.getCustomerOverrides(id, customerId);
    return BaseResponse.ok(overrides);
  }

  @Post(':id/customer-overrides')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.SALES_DIRECTOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({
    summary: 'Thiet lap gia rieng cho khach hang',
    description:
      'Tao customer price override. Moi KH chi co 1 override tren 1 rate card. ' +
      'Override duoc uu tien cao nhat: kiem tra truoc volume tier.',
  })
  async createCustomerOverride(
    @Param('id') id: string,
    @Body() dto: CreateCustomerPriceOverrideDto,
  ) {
    const override = await this.rateCardService.createCustomerOverride(id, dto);
    return BaseResponse.ok(override, 'Thiet lap gia rieng thanh cong');
  }

  @Patch('customer-overrides/:overrideId')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.SALES_DIRECTOR)
  @ApiParam({ name: 'overrideId', description: 'Customer price override ID' })
  @ApiOperation({ summary: 'Cap nhat customer price override' })
  async updateCustomerOverride(
    @Param('overrideId') overrideId: string,
    @Body() dto: UpdateCustomerPriceOverrideDto,
  ) {
    const override = await this.rateCardService.updateCustomerOverride(overrideId, dto);
    return BaseResponse.ok(override, 'Cap nhat override thanh cong');
  }

  @Delete('customer-overrides/:overrideId')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.SALES_DIRECTOR)
  @ApiParam({ name: 'overrideId', description: 'Customer price override ID' })
  @ApiOperation({ summary: 'Xoa customer price override' })
  async removeCustomerOverride(@Param('overrideId') overrideId: string) {
    const result = await this.rateCardService.removeCustomerOverride(overrideId);
    return BaseResponse.ok(result, 'Da xoa customer override');
  }

  // ----------------------------------------------------------------
  // PRICE SIMULATION
  // ----------------------------------------------------------------

  @Post(':id/simulate')
  @Roles(...LOOKUP_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Rate card ID' })
  @ApiOperation({
    summary: 'Simulate tinh gia chi tiet tung buoc',
    description:
      'Tinh gia va hien thi chi tiet tung buoc ap dung: ' +
      'Base → Volume Tier → Seasonal Rule → Customer Override → Final. ' +
      'Rat huu ich de kiem tra tai sao mot don hang lai co gia nhu vay.',
  })
  async simulatePrice(
    @Param('id') id: string,
    @Body() dto: SimulatePriceDto,
  ) {
    const result = await this.rateCardService.simulatePrice(id, dto);
    return BaseResponse.ok(result);
  }
}
