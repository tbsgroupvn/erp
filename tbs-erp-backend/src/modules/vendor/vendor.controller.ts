import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard } from '@common/guards/data-scope.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { VendorService } from './vendor.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { RateVendorDto } from './dto/rate-vendor.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';

@ApiTags('Vendor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @Roles(UserRole.XNK_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create vendor',
    description: 'Creates a new vendor with auto-generated code VND-XXXX.',
  })
  @ApiResponse({ status: 201, description: 'Vendor created successfully' })
  async createVendor(@Body() dto: CreateVendorDto) {
    const vendor = await this.vendorService.createVendor(dto);
    return BaseResponse.ok(vendor, 'Vendor created successfully');
  }

  @Patch(':id')
  @Roles(UserRole.XNK_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Update vendor', description: 'Updates vendor information.' })
  @ApiParam({ name: 'id', description: 'Vendor ID' })
  @ApiResponse({ status: 200, description: 'Vendor updated' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async updateVendor(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    const vendor = await this.vendorService.updateVendor(id, dto);
    return BaseResponse.ok(vendor, 'Vendor updated');
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.LOGISTICS_MANAGER, UserRole.DIRECTOR_OPERATIONS, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({ summary: 'List vendors', description: 'Returns paginated vendors with filters.' })
  @ApiResponse({ status: 200, description: 'Vendors retrieved' })
  async findAll(@Query() query: VendorQueryDto) {
    const result = await this.vendorService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('approved')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.LOGISTICS_MANAGER, UserRole.DIRECTOR_OPERATIONS, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({ summary: 'Get approved vendors', description: 'Lists all approved vendors.' })
  @ApiResponse({ status: 200, description: 'Approved vendors retrieved' })
  async getApprovedVendors() {
    const vendors = await this.vendorService.getApprovedVendors();
    return BaseResponse.ok(vendors);
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.LOGISTICS_MANAGER, UserRole.DIRECTOR_OPERATIONS, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get vendor detail',
    description: 'Returns vendor detail with ratings.',
  })
  @ApiParam({ name: 'id', description: 'Vendor ID' })
  @ApiResponse({ status: 200, description: 'Vendor retrieved' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async findById(@Param('id') id: string) {
    const vendor = await this.vendorService.findById(id);
    return BaseResponse.ok(vendor);
  }

  @Post(':id/rate')
  @Roles(UserRole.XNK_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Rate vendor', description: 'Adds a rating for a vendor (1-5 score).' })
  @ApiParam({ name: 'id', description: 'Vendor ID' })
  @ApiResponse({ status: 201, description: 'Rating added' })
  async rateVendor(
    @Param('id') id: string,
    @Body() dto: RateVendorDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const rating = await this.vendorService.rateVendor(id, dto, user.id);
    return BaseResponse.ok(rating, 'Vendor rated');
  }

  @Get(':id/rating')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.LOGISTICS_MANAGER, UserRole.DIRECTOR_OPERATIONS, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get vendor rating',
    description: 'Returns average rating with breakdown by category.',
  })
  @ApiParam({ name: 'id', description: 'Vendor ID' })
  @ApiResponse({ status: 200, description: 'Rating retrieved' })
  async getVendorRating(@Param('id') id: string) {
    const rating = await this.vendorService.getVendorRating(id);
    return BaseResponse.ok(rating);
  }

  @Patch(':id/toggle-approval')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS, UserRole.XNK_MANAGER)
  @ApiOperation({
    summary: 'Toggle approval status',
    description: 'Approves or unapproves a vendor.',
  })
  @ApiParam({ name: 'id', description: 'Vendor ID' })
  @ApiResponse({ status: 200, description: 'Approval status toggled' })
  async toggleApprovalStatus(@Param('id') id: string) {
    const vendor = await this.vendorService.toggleApprovalStatus(id);
    return BaseResponse.ok(vendor, `Vendor ${vendor.isApproved ? 'approved' : 'unapproved'}`);
  }
}
