import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ContractStatus } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DataScopeGuard } from '@common/guards/data-scope.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { ContractService } from './contract.service';
import { ContractExportService } from './contract-export.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractQueryDto } from './dto/contract-query.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
@Controller('contracts')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly contractExportService: ContractExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách hợp đồng (phân trang, lọc)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách hợp đồng thành công' })
  async findAll(@Query() query: ContractQueryDto) {
    const result = await this.contractService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  // NOTE: Specific sub-routes must be declared BEFORE the generic :id route
  // to prevent NestJS from matching ":id/export/pdf" as id = "export".
  @Get(':id/export/pdf')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Xuất hợp đồng dạng PDF' })
  @ApiParam({ name: 'id', description: 'ID hợp đồng' })
  @ApiResponse({ status: 200, description: 'File PDF hợp đồng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hợp đồng' })
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.contractExportService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="hop-dong-${id}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hợp đồng' })
  @ApiParam({ name: 'id', description: 'ID hợp đồng' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết hợp đồng thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hợp đồng' })
  async findOne(@Param('id') id: string) {
    const contract = await this.contractService.findOne(id);
    return BaseResponse.ok(contract);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo hợp đồng mới' })
  @ApiResponse({ status: 201, description: 'Tạo hợp đồng thành công' })
  @ApiResponse({ status: 400, description: 'Lỗi dữ liệu đầu vào' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy khách hàng hoặc hợp đồng chính' })
  async create(@Body() dto: CreateContractDto, @CurrentUser() user: ICurrentUser) {
    const contract = await this.contractService.create(user.id, dto);
    return BaseResponse.ok(contract, 'Tạo hợp đồng thành công');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật hợp đồng (chỉ khi Nháp)' })
  @ApiParam({ name: 'id', description: 'ID hợp đồng' })
  @ApiResponse({ status: 200, description: 'Cập nhật hợp đồng thành công' })
  @ApiResponse({ status: 400, description: 'Hợp đồng không thể chỉnh sửa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hợp đồng' })
  async update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    const contract = await this.contractService.update(id, dto);
    return BaseResponse.ok(contract, 'Cập nhật hợp đồng thành công');
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chuyển trạng thái hợp đồng' })
  @ApiParam({ name: 'id', description: 'ID hợp đồng' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({ status: 400, description: 'Trạng thái chuyển đổi không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hợp đồng' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ContractStatus,
    @CurrentUser() user: ICurrentUser,
  ) {
    const contract = await this.contractService.updateStatus(id, status, user.id);
    return BaseResponse.ok(contract, 'Cập nhật trạng thái hợp đồng thành công');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa hợp đồng (chỉ khi Nháp)' })
  @ApiParam({ name: 'id', description: 'ID hợp đồng' })
  @ApiResponse({ status: 200, description: 'Đã xóa hợp đồng' })
  @ApiResponse({ status: 400, description: 'Hợp đồng không thể xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hợp đồng' })
  async delete(@Param('id') id: string) {
    await this.contractService.delete(id);
    return BaseResponse.ok(null, 'Đã xóa hợp đồng');
  }
}
