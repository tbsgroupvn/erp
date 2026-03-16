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
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
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
import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OnboardingService, ChecklistType } from './onboarding.service';

class CreateChecklistDto {
  @ApiProperty({ description: 'ID nhân viên' })
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: ['ONBOARDING', 'OFFBOARDING'] })
  @IsEnum(['ONBOARDING', 'OFFBOARDING'])
  type: ChecklistType;
}

@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  @Roles(UserRole.HR_MANAGER, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo checklist onboarding/offboarding cho nhân viên' })
  @ApiResponse({ status: 201, description: 'Tạo checklist thành công' })
  async create(
    @Body() dto: CreateChecklistDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const checklist = await this.onboardingService.create(
      dto.employeeId,
      dto.type,
      user.id,
    );
    return BaseResponse.ok(checklist, 'Tạo checklist thành công');
  }

  @Get()
  @Roles(UserRole.HR_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Lấy danh sách tất cả checklist' })
  @ApiQuery({ name: 'type', required: false, enum: ['ONBOARDING', 'OFFBOARDING'] })
  @ApiQuery({ name: 'completed', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('type') type?: string,
    @Query('completed') completed?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const completedBool =
      completed === 'true' ? true : completed === 'false' ? false : undefined;

    const result = await this.onboardingService.findAll({
      type,
      completed: completedBool,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('employee/:employeeId')
  @Roles(UserRole.HR_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Lấy danh sách checklist theo nhân viên' })
  @ApiParam({ name: 'employeeId', description: 'ID nhân viên' })
  async findByEmployee(@Param('employeeId') employeeId: string) {
    const checklists = await this.onboardingService.findByEmployee(employeeId);
    return BaseResponse.ok(checklists);
  }

  @Get(':id')
  @Roles(UserRole.HR_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Lấy chi tiết checklist' })
  @ApiParam({ name: 'id', description: 'ID checklist' })
  async findOne(@Param('id') id: string) {
    const checklist = await this.onboardingService.findById(id);
    return BaseResponse.ok(checklist);
  }

  @Patch(':id/toggle/:itemIndex')
  @Roles(UserRole.HR_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Đánh dấu hoàn thành / chưa hoàn thành một mục' })
  @ApiParam({ name: 'id', description: 'ID checklist' })
  @ApiParam({ name: 'itemIndex', description: 'Chỉ số mục (0-based)' })
  async toggleItem(
    @Param('id') id: string,
    @Param('itemIndex', ParseIntPipe) itemIndex: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    const checklist = await this.onboardingService.toggleItem(id, itemIndex, user.id);
    return BaseResponse.ok(checklist, 'Cập nhật trạng thái mục thành công');
  }

  @Patch(':id/complete')
  @Roles(UserRole.HR_MANAGER, UserRole.CEO, UserRole.COO)
  @ApiOperation({ summary: 'Đánh dấu toàn bộ checklist là hoàn thành' })
  @ApiParam({ name: 'id', description: 'ID checklist' })
  async markComplete(@Param('id') id: string) {
    const checklist = await this.onboardingService.markComplete(id);
    return BaseResponse.ok(checklist, 'Đánh dấu checklist hoàn thành thành công');
  }
}
