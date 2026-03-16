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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { AttendanceService } from './attendance.service';
import { CheckInDto, CheckOutDto } from './dto/check-in.dto';
import { ManualCheckInDto, ReviewManualCheckInDto } from './dto/manual-check-in.dto';
import { RequestLeaveDto, RejectLeaveDto } from './dto/leave-request.dto';
import { RequestOvertimeDto } from './dto/overtime-request.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ─────────────────────────────────────────────
  // CHECK-IN / CHECK-OUT
  // ─────────────────────────────────────────────

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấm công vào (timestamp tự động nếu không truyền)' })
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.checkIn(user.id, dto);
    return BaseResponse.ok(result, 'Chấm công vào thành công');
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấm công ra (timestamp tự động nếu không truyền)' })
  async checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.checkOut(user.id, dto);
    return BaseResponse.ok(result, 'Chấm công ra thành công');
  }

  // ─────────────────────────────────────────────
  // MY ATTENDANCE (paginated)
  // ─────────────────────────────────────────────

  @Get('my')
  @ApiOperation({ summary: 'Lịch sử chấm công của tôi (phân trang)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getMyAttendance(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: ICurrentUser,
  ) {
    const p = +(page ?? 1);
    const l = +(limit ?? 20);
    const result = await this.attendanceService.getMyAttendancePaginated(user!.id, p, l);
    return PaginatedResponse.paginate(result.data, result.meta.total, p, l);
  }

  // ─────────────────────────────────────────────
  // ALL ATTENDANCE (admin, paginated)
  // ─────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Danh sách chấm công (admin, phân trang)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'date', required: false, example: '2026-03-16' })
  @ApiQuery({ name: 'employeeId', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('date') date?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    const p = +(page ?? 1);
    const l = +(limit ?? 20);
    const result = await this.attendanceService.findAllPaginated(p, l, { date, employeeId, status });
    return PaginatedResponse.paginate(result.data, result.meta.total, p, l);
  }

  // ─────────────────────────────────────────────
  // COMPANY-WIDE SUMMARY (today)
  // ─────────────────────────────────────────────

  @Get('summary')
  @ApiOperation({ summary: 'Tổng quan chấm công hôm nay (toàn công ty)' })
  async getSummary() {
    const result = await this.attendanceService.getCompanyTodaySummary();
    return BaseResponse.ok(result);
  }

  // ─────────────────────────────────────────────
  // TEAM ATTENDANCE (legacy, manager)
  // ─────────────────────────────────────────────

  @Get('team')
  @ApiOperation({ summary: 'Chấm công team (manager)' })
  @ApiQuery({ name: 'month', required: true })
  @ApiQuery({ name: 'year', required: true })
  async getTeamAttendance(
    @Query('month') month: number,
    @Query('year') year: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.attendanceService.getTeamAttendance(user.id, +month, +year);
    return BaseResponse.ok(result);
  }

  // ─────────────────────────────────────────────
  // MANUAL CHECK-IN
  // ─────────────────────────────────────────────

  @Post('manual-check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chấm công thủ công kèm selfie' })
  async manualCheckIn(@Body() dto: ManualCheckInDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.manualCheckIn(user.id, dto);
    return BaseResponse.ok(result, 'Chấm công thủ công thành công, chờ HR duyệt');
  }

  @Get('pending-reviews')
  @ApiOperation({ summary: 'Danh sách chấm công thủ công chờ duyệt' })
  async getPendingReviews() {
    const result = await this.attendanceService.getPendingManualCheckIns();
    return BaseResponse.ok(result);
  }

  @Patch(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Duyệt chấm công thủ công' })
  @ApiParam({ name: 'id', description: 'Attendance record ID' })
  async reviewManualCheckIn(
    @Param('id') id: string,
    @Body() dto: ReviewManualCheckInDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.attendanceService.reviewManualCheckIn(id, dto.approved, user.id);
    return BaseResponse.ok(result, `Chấm công thủ công đã ${dto.approved ? 'được duyệt' : 'bị từ chối'}`);
  }

  // ─────────────────────────────────────────────
  // LEAVE REQUESTS
  // ─────────────────────────────────────────────

  @Post('leave-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi đơn xin nghỉ phép' })
  async requestLeave(@Body() dto: any, @CurrentUser() user: ICurrentUser) {
    // Accept both { type } and { leaveType } from frontend
    const normalizedDto = {
      type: dto.type ?? dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
    };
    const result = await this.attendanceService.requestLeave(user.id, normalizedDto as RequestLeaveDto);
    return BaseResponse.ok(result, 'Đã gửi yêu cầu nghỉ phép');
  }

  // Alias for legacy route
  @Post('leave')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi đơn xin nghỉ phép (legacy)' })
  async requestLeaveLegacy(@Body() dto: RequestLeaveDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.requestLeave(user.id, dto);
    return BaseResponse.ok(result, 'Đã gửi yêu cầu nghỉ phép');
  }

  @Get('leave-requests')
  @ApiOperation({ summary: 'Danh sách nghỉ phép (tất cả, phân trang)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listAllLeaveRequests(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('leaveType') leaveType?: string,
  ) {
    const p = +(page ?? 1);
    const l = +(limit ?? 20);
    const result = await this.attendanceService.findAllLeavesPaginated(p, l, { status, leaveType });
    return PaginatedResponse.paginate(result.data, result.meta.total, p, l);
  }

  @Get('leave-requests/my')
  @ApiOperation({ summary: 'Đơn nghỉ phép của tôi (phân trang)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listMyLeaveRequests(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @CurrentUser() user?: ICurrentUser,
  ) {
    const p = +(page ?? 1);
    const l = +(limit ?? 20);
    const result = await this.attendanceService.findMyLeavesPaginated(user!.id, p, l, { status });
    return PaginatedResponse.paginate(result.data, result.meta.total, p, l);
  }

  @Get('leave-balance')
  @ApiOperation({ summary: 'Số ngày nghỉ còn lại của tôi' })
  async getLeaveBalance(@CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.getLeaveBalanceFlat(user.id);
    return BaseResponse.ok(result);
  }

  // Legacy balance endpoint
  @Get('leave/balance')
  @ApiOperation({ summary: 'Số ngày nghỉ còn lại (legacy)' })
  @ApiQuery({ name: 'year', required: false })
  async getLeaveBalanceLegacy(
    @Query('year') year: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    if (year) {
      const result = await this.attendanceService.getLeaveBalance(user.id, +year);
      return BaseResponse.ok(result);
    }
    const result = await this.attendanceService.getLeaveBalanceFlat(user.id);
    return BaseResponse.ok(result);
  }

  @Patch('leave-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy đơn nghỉ phép' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  async cancelLeave(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.cancelLeave(id, user.id);
    return BaseResponse.ok(result, 'Đã hủy yêu cầu nghỉ phép');
  }

  @Post('leave/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Duyệt đơn nghỉ phép' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  async approveLeave(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.approveLeave(id, user.id);
    return BaseResponse.ok(result, 'Đã duyệt nghỉ phép');
  }

  @Post('leave/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Từ chối đơn nghỉ phép' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  async rejectLeave(
    @Param('id') id: string,
    @Body() dto: RejectLeaveDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.attendanceService.rejectLeave(id, user.id, dto.reason);
    return BaseResponse.ok(result, 'Đã từ chối nghỉ phép');
  }

  // ─────────────────────────────────────────────
  // OVERTIME
  // ─────────────────────────────────────────────

  @Post('overtime')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi yêu cầu tăng ca' })
  async requestOvertime(@Body() dto: RequestOvertimeDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.requestOvertime(user.id, dto);
    return BaseResponse.ok(result, 'Đã gửi yêu cầu tăng ca');
  }
}
