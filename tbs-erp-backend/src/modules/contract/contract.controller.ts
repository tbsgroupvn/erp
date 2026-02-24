import {
  Controller,
  Get,
  Post,
  Put,
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
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ContractStatus } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard } from '@common/guards/data-scope.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractQueryDto } from './dto/contract-query.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get()
  @ApiOperation({ summary: 'List contracts with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Contracts retrieved successfully' })
  async findAll(@Query() query: ContractQueryDto) {
    const result = await this.contractService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract detail' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async findOne(@Param('id') id: string) {
    const contract = await this.contractService.findOne(id);
    return BaseResponse.ok(contract);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new contract' })
  @ApiResponse({ status: 201, description: 'Contract created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Customer or parent contract not found' })
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const contract = await this.contractService.create(user.id, dto);
    return BaseResponse.ok(contract, 'Contract created successfully');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contract (only DRAFT)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract updated successfully' })
  @ApiResponse({ status: 400, description: 'Contract cannot be edited' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    const contract = await this.contractService.update(id, dto);
    return BaseResponse.ok(contract, 'Contract updated successfully');
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition contract status' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ContractStatus,
    @CurrentUser() user: ICurrentUser,
  ) {
    const contract = await this.contractService.updateStatus(id, status, user.id);
    return BaseResponse.ok(contract, 'Contract status updated successfully');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a contract (only DRAFT)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiResponse({ status: 200, description: 'Contract deleted successfully' })
  @ApiResponse({ status: 400, description: 'Contract cannot be deleted' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async delete(@Param('id') id: string) {
    await this.contractService.delete(id);
    return BaseResponse.ok(null, 'Contract deleted successfully');
  }
}
