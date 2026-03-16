import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { CarrierReconciliationService } from './carrier-reconciliation.service';
import { UploadCarrierReconDto } from './dto/upload-carrier-recon.dto';
import { ResolveExceptionDto } from './dto/resolve-exception.dto';
import { CarrierReconQueryDto } from './dto/carrier-recon-query.dto';

@ApiTags('Carrier Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('carrier-reconciliation')
export class CarrierReconciliationController {
  constructor(
    private readonly carrierReconService: CarrierReconciliationService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload file doi soat hang van chuyen',
    description:
      'Upload file Excel tu hang van chuyen (GHTK, GHN, Viettel Post, J&T), ' +
      'he thong tu dong parse va match voi ma van don trong ERP.',
  })
  @ApiResponse({ status: 201, description: 'Upload va match thanh cong' })
  @ApiResponse({ status: 400, description: 'File khong hop le hoac khong co du lieu' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadCarrierReconDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.carrierReconService.uploadAndParse(file, dto, user.id);
    return BaseResponse.ok(result, `Da upload va match ${result.totalRows} dong`);
  }

  @Get()
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO, UserRole.COO)
  @ApiOperation({ summary: 'Danh sach phieu doi soat' })
  @ApiResponse({ status: 200, description: 'Danh sach phieu doi soat' })
  async findAll(@Query() query: CarrierReconQueryDto) {
    const result = await this.carrierReconService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO, UserRole.COO)
  @ApiOperation({ summary: 'Chi tiet phieu doi soat' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Chi tiet phieu doi soat' })
  @ApiResponse({ status: 404, description: 'Khong tim thay' })
  async findById(@Param('id') id: string) {
    const result = await this.carrierReconService.findById(id);
    return BaseResponse.ok(result);
  }

  @Get(':id/exceptions')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({ summary: 'Danh sach exceptions cua phieu doi soat' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Danh sach exceptions' })
  async getExceptions(@Param('id') id: string) {
    const result = await this.carrierReconService.getExceptions(id);
    return BaseResponse.ok(result);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.CFO)
  @ApiOperation({
    summary: 'Xac nhan phieu doi soat',
    description:
      'Xac nhan phieu doi soat. He thong se tu dong: ' +
      'credit wallet KH (COD), auto-clear AR, ghi but toan cuoc van chuyen.',
  })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Xac nhan thanh cong' })
  @ApiResponse({ status: 400, description: 'Trang thai khong hop le' })
  async confirm(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.carrierReconService.confirm(id, user.id);
    return BaseResponse.ok(result, `Da xu ly ${result.processedCount} dong`);
  }

  @Patch(':id/items/:itemId/resolve')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({
    summary: 'Giai quyet exception',
    description: 'Giai quyet 1 dong exception: RESOLVE (danh dau), PROCESS (xu ly tai chinh), SKIP (bo qua).',
  })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Giai quyet thanh cong' })
  @ApiResponse({ status: 404, description: 'Khong tim thay' })
  async resolveException(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ResolveExceptionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.carrierReconService.resolveException(id, itemId, dto, user.id);
    return BaseResponse.ok(result);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.CFO)
  @ApiOperation({ summary: 'Huy phieu doi soat' })
  @ApiParam({ name: 'id', description: 'Reconciliation ID' })
  @ApiResponse({ status: 200, description: 'Huy thanh cong' })
  @ApiResponse({ status: 400, description: 'Chi huy duoc phieu PENDING' })
  async cancel(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.carrierReconService.cancel(id, user.id);
    return BaseResponse.ok(result);
  }
}
