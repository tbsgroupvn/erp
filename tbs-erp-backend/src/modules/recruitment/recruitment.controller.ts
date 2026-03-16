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
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { RecruitmentService } from './recruitment.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CandidateQueryDto } from './dto/candidate-query.dto';
import { UpdateCandidateStatusDto } from './dto/update-status.dto';

/** Roles được phép ghi (tạo / sửa / xóa) */
const WRITE_ROLES = [UserRole.HR_MANAGER, UserRole.CEO, UserRole.COO];

/** Roles được phép đọc */
const READ_ROLES = [
  UserRole.HR_MANAGER,
  UserRole.CEO,
  UserRole.COO,
  UserRole.DIRECTOR_OPERATIONS,
  UserRole.SALES_DIRECTOR,
  UserRole.CFO,
];

@ApiTags('Tuyển dụng')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  // ─── Tạo ứng viên ─────────────────────────────────────────────────────────

  @Post()
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm ứng viên mới' })
  @ApiResponse({ status: 201, description: 'Tạo ứng viên thành công' })
  async create(
    @Body() dto: CreateCandidateDto,
    @CurrentUser('id') userId: string,
  ) {
    const candidate = await this.recruitmentService.create(dto, userId);
    return BaseResponse.ok(candidate, 'Tạo ứng viên thành công');
  }

  // ─── Thống kê Kanban header ────────────────────────────────────────────────

  @Get('stats')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Thống kê số lượng ứng viên theo trạng thái' })
  @ApiResponse({ status: 200, description: 'Thống kê tuyển dụng' })
  async getStats() {
    const stats = await this.recruitmentService.getStats();
    return BaseResponse.ok(stats);
  }

  // ─── Dữ liệu Kanban board ─────────────────────────────────────────────────

  @Get('board')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Lấy dữ liệu board Kanban (gom nhóm theo trạng thái)' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm ứng viên' })
  @ApiResponse({ status: 200, description: 'Dữ liệu Kanban board' })
  async getBoardData(@Query('search') search?: string) {
    const board = await this.recruitmentService.getBoardData(search);
    return BaseResponse.ok(board);
  }

  // ─── Danh sách ────────────────────────────────────────────────────────────

  @Get()
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Danh sách ứng viên có phân trang và filter' })
  @ApiResponse({ status: 200, description: 'Danh sách ứng viên' })
  async findAll(@Query() query: CandidateQueryDto) {
    const result = await this.recruitmentService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  // ─── Chi tiết ─────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Xem chi tiết ứng viên' })
  @ApiParam({ name: 'id', description: 'ID ứng viên' })
  @ApiResponse({ status: 200, description: 'Chi tiết ứng viên' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy ứng viên' })
  async findById(@Param('id') id: string) {
    const candidate = await this.recruitmentService.findById(id);
    return BaseResponse.ok(candidate);
  }

  // ─── Cập nhật thông tin ───────────────────────────────────────────────────

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Cập nhật thông tin ứng viên' })
  @ApiParam({ name: 'id', description: 'ID ứng viên' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  async update(@Param('id') id: string, @Body() dto: UpdateCandidateDto) {
    const candidate = await this.recruitmentService.update(id, dto);
    return BaseResponse.ok(candidate, 'Cập nhật thông tin thành công');
  }

  // ─── Chuyển trạng thái ────────────────────────────────────────────────────

  @Patch(':id/status')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Chuyển trạng thái ứng viên (FSM)' })
  @ApiParam({ name: 'id', description: 'ID ứng viên' })
  @ApiResponse({ status: 200, description: 'Chuyển trạng thái thành công' })
  @ApiResponse({ status: 400, description: 'Chuyển trạng thái không hợp lệ' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCandidateStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    const candidate = await this.recruitmentService.updateStatus(id, dto, userId);
    return BaseResponse.ok(candidate, 'Cập nhật trạng thái thành công');
  }

  // ─── Xóa ──────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa ứng viên' })
  @ApiParam({ name: 'id', description: 'ID ứng viên' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  async delete(@Param('id') id: string) {
    const result = await this.recruitmentService.delete(id);
    return BaseResponse.ok(result, 'Xóa ứng viên thành công');
  }
}
