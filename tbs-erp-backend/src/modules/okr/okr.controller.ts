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
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { UserRole, OKRPeriod, OKRLevel } from '@prisma/client';
import { OKRService } from './okr.service';
import {
  CreateObjectiveDto,
  UpdateObjectiveDto,
  CreateKeyResultDto,
  UpdateKeyResultDto,
  CheckInDto,
  OKRQueryDto,
} from './dto';

@ApiTags('OKR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('okr')
export class OKRController {
  constructor(private readonly okrService: OKRService) {}

  // ---------------------------------------------------------------------------
  // Objectives
  // ---------------------------------------------------------------------------

  @Get('objectives')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Lay danh sach Objectives', description: 'Filter theo period, year, level, ownerId, status' })
  @ApiResponse({ status: 200, description: 'Danh sach Objectives' })
  async getObjectives(@Query() query: OKRQueryDto, @CurrentUser() user: ICurrentUser) {
    const data = await this.okrService.getObjectives(user.id, query);
    return BaseResponse.ok(data);
  }

  @Post('objectives')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tao muc tieu (Objective) moi' })
  @ApiResponse({ status: 201, description: 'Objective da duoc tao' })
  async createObjective(@Body() dto: CreateObjectiveDto, @CurrentUser() user: ICurrentUser) {
    const data = await this.okrService.createObjective(user.id, dto);
    return BaseResponse.ok(data, 'Tao muc tieu thanh cong');
  }

  @Get('objectives/tree')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.HR_MANAGER,
  )
  @ApiOperation({ summary: 'Lay cay OKR theo cap bac (Company -> Dept -> Individual)' })
  @ApiQuery({ name: 'period', enum: OKRPeriod, required: false })
  @ApiQuery({ name: 'year', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Cay OKR' })
  async getOKRTree(
    @Query('period') period?: OKRPeriod,
    @Query('year') year?: string,
  ) {
    const data = await this.okrService.getCompanyOKRTree(period, year ? parseInt(year, 10) : undefined);
    return BaseResponse.ok(data);
  }

  @Get('objectives/dashboard')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Tong quan OKR Dashboard' })
  @ApiResponse({ status: 200, description: 'Du lieu dashboard' })
  async getOKRDashboard(@CurrentUser() user: ICurrentUser) {
    const data = await this.okrService.getOKRDashboard(user.id);
    return BaseResponse.ok(data);
  }

  @Get('objectives/my')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Lay OKRs cua chinh minh' })
  @ApiQuery({ name: 'period', enum: OKRPeriod, required: false })
  @ApiQuery({ name: 'year', type: Number, required: false })
  async getMyOKRs(
    @CurrentUser() user: ICurrentUser,
    @Query('period') period?: OKRPeriod,
    @Query('year') year?: string,
  ) {
    const data = await this.okrService.getMyOKRs(
      user.id,
      period,
      year ? parseInt(year, 10) : undefined,
    );
    return BaseResponse.ok(data);
  }

  @Get('objectives/parent-candidates')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Lay danh sach Objectives co the chon lam parent' })
  @ApiQuery({ name: 'level', enum: OKRLevel })
  @ApiQuery({ name: 'period', enum: OKRPeriod, required: false })
  @ApiQuery({ name: 'year', type: Number, required: false })
  async getParentCandidates(
    @Query('level') level: OKRLevel,
    @Query('period') period?: OKRPeriod,
    @Query('year') year?: string,
  ) {
    const data = await this.okrService.getParentCandidates(
      level,
      period,
      year ? parseInt(year, 10) : undefined,
    );
    return BaseResponse.ok(data);
  }

  @Get('objectives/:id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Chi tiet Objective' })
  @ApiParam({ name: 'id', description: 'Objective ID' })
  @ApiResponse({ status: 200, description: 'Chi tiet Objective' })
  @ApiResponse({ status: 404, description: 'Khong tim thay' })
  async getObjectiveById(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const data = await this.okrService.getObjectiveById(user.id, id);
    return BaseResponse.ok(data);
  }

  @Patch('objectives/:id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Cap nhat Objective' })
  @ApiParam({ name: 'id', description: 'Objective ID' })
  @ApiResponse({ status: 200, description: 'Objective da cap nhat' })
  async updateObjective(
    @Param('id') id: string,
    @Body() dto: UpdateObjectiveDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.okrService.updateObjective(user.id, id, dto);
    return BaseResponse.ok(data, 'Cap nhat muc tieu thanh cong');
  }

  @Delete('objectives/:id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.HR_MANAGER,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xoa mem Objective' })
  @ApiParam({ name: 'id', description: 'Objective ID' })
  async deleteObjective(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const data = await this.okrService.deleteObjective(user.id, id);
    return BaseResponse.ok(data, 'Da xoa muc tieu');
  }

  // ---------------------------------------------------------------------------
  // Key Results
  // ---------------------------------------------------------------------------

  @Post('objectives/:id/key-results')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Them Key Result vao Objective' })
  @ApiParam({ name: 'id', description: 'Objective ID' })
  async createKeyResult(
    @Param('id') objectiveId: string,
    @Body() dto: CreateKeyResultDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.okrService.createKeyResult(user.id, objectiveId, dto);
    return BaseResponse.ok(data, 'Them ket qua then chot thanh cong');
  }

  @Patch('key-results/:id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Cap nhat thong tin Key Result' })
  @ApiParam({ name: 'id', description: 'KeyResult ID' })
  async updateKeyResult(
    @Param('id') keyResultId: string,
    @Body() dto: UpdateKeyResultDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.okrService.updateKeyResult(user.id, keyResultId, dto);
    return BaseResponse.ok(data, 'Cap nhat Key Result thanh cong');
  }

  @Patch('key-results/:id/check-in')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @ApiOperation({ summary: 'Check-in cap nhat gia tri Key Result' })
  @ApiParam({ name: 'id', description: 'KeyResult ID' })
  async checkIn(
    @Param('id') keyResultId: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.okrService.updateKeyResultValue(user.id, keyResultId, dto);
    return BaseResponse.ok(data, 'Cap nhat ket qua thanh cong');
  }

  @Post('key-results/:id/link-task/:taskId')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Lien ket Task voi Key Result' })
  @ApiParam({ name: 'id', description: 'KeyResult ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  async linkTask(
    @Param('id') keyResultId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.okrService.linkTask(user.id, keyResultId, taskId);
    return BaseResponse.ok(data, 'Da lien ket task');
  }

  @Delete('key-results/:id/link-task/:taskId')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.MARKETING_STAFF,
    UserRole.CSKH,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Huy lien ket Task khoi Key Result' })
  @ApiParam({ name: 'id', description: 'KeyResult ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  async unlinkTask(
    @Param('id') keyResultId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.okrService.unlinkTask(user.id, keyResultId, taskId);
    return BaseResponse.ok(data, 'Da huy lien ket task');
  }
}
