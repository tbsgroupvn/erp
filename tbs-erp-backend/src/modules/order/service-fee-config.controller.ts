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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard } from '@common/guards/data-scope.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { ServiceFeeConfigService } from './service-fee-config.service';
import {
  CreateServiceFeeConfigDto,
  UpdateServiceFeeConfigDto,
  ServiceFeeConfigQueryDto,
} from './dto/service-fee-config.dto';

@ApiTags('Service Fee Configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('service-fee-configs')
export class ServiceFeeConfigController {
  constructor(private readonly serviceFeeConfigService: ServiceFeeConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List service fee configs with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Service fee configs retrieved successfully' })
  async findAll(@Query() query: ServiceFeeConfigQueryDto) {
    const result = await this.serviceFeeConfigService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service fee config detail' })
  @ApiParam({ name: 'id', description: 'Service Fee Config ID' })
  @ApiResponse({ status: 200, description: 'Service fee config retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service fee config not found' })
  async findOne(@Param('id') id: string) {
    const config = await this.serviceFeeConfigService.findOne(id);
    return BaseResponse.ok(config);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new service fee config' })
  @ApiResponse({ status: 201, description: 'Service fee config created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Body() dto: CreateServiceFeeConfigDto, @CurrentUser() user: ICurrentUser) {
    const config = await this.serviceFeeConfigService.create(dto, user.id);
    return BaseResponse.ok(config, 'Service fee config created successfully');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service fee config' })
  @ApiParam({ name: 'id', description: 'Service Fee Config ID' })
  @ApiResponse({ status: 200, description: 'Service fee config updated successfully' })
  @ApiResponse({ status: 404, description: 'Service fee config not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateServiceFeeConfigDto) {
    const config = await this.serviceFeeConfigService.update(id, dto);
    return BaseResponse.ok(config, 'Service fee config updated successfully');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a service fee config (set isActive=false)' })
  @ApiParam({ name: 'id', description: 'Service Fee Config ID' })
  @ApiResponse({ status: 200, description: 'Service fee config deleted successfully' })
  @ApiResponse({ status: 404, description: 'Service fee config not found' })
  async remove(@Param('id') id: string) {
    await this.serviceFeeConfigService.remove(id);
    return BaseResponse.ok(null, 'Service fee config deleted successfully');
  }
}
