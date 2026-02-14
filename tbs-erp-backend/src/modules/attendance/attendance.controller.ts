import {
  Controller,
  Get,
  Post,
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
import { BaseResponse } from '@common/dto/base-response.dto';
import { AttendanceService } from './attendance.service';
import { CheckInDto, CheckOutDto } from './dto/check-in.dto';
import { RequestLeaveDto, RejectLeaveDto } from './dto/leave-request.dto';
import { RequestOvertimeDto } from './dto/overtime-request.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record check-in' })
  @ApiResponse({ status: 200, description: 'Check-in recorded' })
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.checkIn(user.id, dto);
    return BaseResponse.ok(result, 'Check-in recorded');
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record check-out' })
  @ApiResponse({ status: 200, description: 'Check-out recorded' })
  async checkOut(@Body() dto: CheckOutDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.checkOut(user.id, dto);
    return BaseResponse.ok(result, 'Check-out recorded');
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my monthly attendance' })
  @ApiQuery({ name: 'month', required: true, example: 6 })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  async getMyAttendance(
    @Query('month') month: number,
    @Query('year') year: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.attendanceService.getMyAttendance(user.id, +month, +year);
    return BaseResponse.ok(result);
  }

  @Get('team')
  @ApiOperation({ summary: 'Get team attendance summary' })
  @ApiQuery({ name: 'month', required: true, example: 6 })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  async getTeamAttendance(
    @Query('month') month: number,
    @Query('year') year: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.attendanceService.getTeamAttendance(user.id, +month, +year);
    return BaseResponse.ok(result);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get monthly attendance summary' })
  @ApiQuery({ name: 'month', required: true, example: 6 })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  async getMonthlySummary(
    @Query('month') month: number,
    @Query('year') year: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.attendanceService.getMonthlySummary(user.id, +month, +year);
    return BaseResponse.ok(result);
  }

  @Post('leave')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiResponse({ status: 201, description: 'Leave request created' })
  async requestLeave(@Body() dto: RequestLeaveDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.requestLeave(user.id, dto);
    return BaseResponse.ok(result, 'Leave request submitted');
  }

  @Post('leave/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  async approveLeave(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.approveLeave(id, user.id);
    return BaseResponse.ok(result, 'Leave request approved');
  }

  @Post('leave/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  async rejectLeave(
    @Param('id') id: string,
    @Body() dto: RejectLeaveDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.attendanceService.rejectLeave(id, user.id, dto.reason);
    return BaseResponse.ok(result, 'Leave request rejected');
  }

  @Get('leave/balance')
  @ApiOperation({ summary: 'Get remaining leave balance' })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  async getLeaveBalance(@Query('year') year: number, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.getLeaveBalance(user.id, +year);
    return BaseResponse.ok(result);
  }

  @Post('overtime')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit an overtime request' })
  @ApiResponse({ status: 201, description: 'Overtime request created' })
  async requestOvertime(@Body() dto: RequestOvertimeDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.attendanceService.requestOvertime(user.id, dto);
    return BaseResponse.ok(result, 'Overtime request submitted');
  }
}
