import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { AttendanceType, LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { CheckInDto, CheckOutDto } from './dto/check-in.dto';
import { ManualCheckInDto } from './dto/manual-check-in.dto';
import { RequestLeaveDto } from './dto/leave-request.dto';
import { RequestOvertimeDto } from './dto/overtime-request.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  private static readonly STANDARD_CHECK_IN = 8; // 8:00 AM
  private static readonly LEAVE_BALANCES: Record<LeaveType, number> = {
    [LeaveType.ANNUAL]: 12,
    [LeaveType.SICK]: 30,
    [LeaveType.PERSONAL]: 3,
    [LeaveType.MATERNITY]: 180,
    [LeaveType.OTHER]: 5,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────
  // CHECK-IN / CHECK-OUT
  // ─────────────────────────────────────────────

  async checkIn(userId: string, dto: CheckInDto) {
    const employee = await this.findEmployeeByUserId(userId);
    const checkInTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const dateOnly = this.toDateOnly(checkInTime);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: dateOnly } },
    });

    if (existing?.checkIn) {
      throw new BadRequestException('Hôm nay bạn đã chấm công vào rồi');
    }

    const isLate =
      checkInTime.getHours() > AttendanceService.STANDARD_CHECK_IN ||
      (checkInTime.getHours() === AttendanceService.STANDARD_CHECK_IN && checkInTime.getMinutes() > 0);

    const data: Prisma.AttendanceUpdateInput = {
      checkIn: checkInTime,
      checkInLat: dto.lat,
      checkInLng: dto.lng,
      type: (dto.type as AttendanceType) ?? AttendanceType.OFFICE,
      isLate,
      notes: dto.note,
    };

    if (existing) {
      return this.prisma.attendance.update({ where: { id: existing.id }, data });
    }

    return this.prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: dateOnly,
        ...data,
      } as Prisma.AttendanceUncheckedCreateInput,
    });
  }

  async checkOut(userId: string, dto: CheckOutDto) {
    const employee = await this.findEmployeeByUserId(userId);
    const checkOutTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const dateOnly = this.toDateOnly(checkOutTime);

    const attendance = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: dateOnly } },
    });

    if (!attendance) {
      throw new BadRequestException('Bạn chưa chấm công vào hôm nay');
    }
    if (!attendance.checkIn) {
      throw new BadRequestException('Bạn cần chấm công vào trước khi chấm ra');
    }
    if (attendance.checkOut) {
      throw new BadRequestException('Hôm nay bạn đã chấm công ra rồi');
    }

    const workHours =
      (checkOutTime.getTime() - new Date(attendance.checkIn).getTime()) / (1000 * 60 * 60);

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: checkOutTime,
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        workHours: Math.round(workHours * 100) / 100,
        notes: dto.note ?? attendance.notes,
      },
    });
  }

  // ─────────────────────────────────────────────
  // ATTENDANCE QUERIES — paginated
  // ─────────────────────────────────────────────

  /**
   * GET /attendance/my — paginated list of my attendance records.
   */
  async getMyAttendancePaginated(userId: string, page: number, limit: number) {
    const employee = await this.findEmployeeByUserId(userId);
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.attendance.count({ where: { employeeId: employee.id } }),
      this.prisma.attendance.findMany({
        where: { employeeId: employee.id },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: { employee: { select: { fullName: true } } },
      }),
    ]);

    const data = records.map((r) => this.mapAttendanceRecord(r, r.employee?.fullName ?? employee.fullName));
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /attendance — paginated list of all attendance (admin).
   */
  async findAllPaginated(page: number, limit: number, filters?: { date?: string; employeeId?: string; status?: string }) {
    const skip = (page - 1) * limit;
    const where: Prisma.AttendanceWhereInput = {};

    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.date) where.date = new Date(filters.date);

    const [total, records] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: { employee: { select: { fullName: true } } },
      }),
    ]);

    const data = records.map((r) => this.mapAttendanceRecord(r, r.employee?.fullName ?? ''));
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * GET /attendance/summary — company-wide today summary.
   */
  async getCompanyTodaySummary() {
    const today = this.toDateOnly(new Date());

    const [totalEmployees, todayAttendances, todayLeaves] = await Promise.all([
      this.prisma.employee.count({ where: { status: 'ACTIVE' } }),
      this.prisma.attendance.findMany({ where: { date: today } }),
      this.prisma.leaveRequest.count({
        where: {
          status: LeaveStatus.APPROVED,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),
    ]);

    const presentToday = todayAttendances.filter((a) => a.checkIn).length;
    const lateToday = todayAttendances.filter((a) => a.isLate).length;
    const absentToday = totalEmployees - presentToday - todayLeaves;

    return {
      totalEmployees,
      presentToday,
      absentToday: Math.max(0, absentToday),
      lateToday,
      onLeaveToday: todayLeaves,
      averageWorkHours: presentToday > 0
        ? Math.round(todayAttendances.reduce((sum, a) => sum + Number(a.workHours || 0), 0) / presentToday * 100) / 100
        : 0,
      overtimeHoursThisMonth: 0,
    };
  }

  // ─────────────────────────────────────────────
  // LEAVE REQUESTS — paginated
  // ─────────────────────────────────────────────

  /**
   * POST /attendance/leave-request — create a leave request.
   * Accepts both { type } and { leaveType } field names for compatibility.
   */
  async requestLeave(userId: string, dto: RequestLeaveDto & { leaveType?: LeaveType }) {
    const employee = await this.findEmployeeByUserId(userId);
    const leaveType = dto.type ?? dto.leaveType;
    if (!leaveType) throw new BadRequestException('Loại nghỉ phép là bắt buộc');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const totalDays = this.calculateBusinessDays(startDate, endDate);
    if (totalDays <= 0) {
      throw new BadRequestException('Khoảng thời gian nghỉ phải bao gồm ít nhất một ngày làm việc');
    }

    // Check balance
    const balance = await this.getLeaveBalance(userId, startDate.getFullYear());
    const typeBalance = balance.find((b) => b.type === leaveType);
    if (typeBalance && typeBalance.remaining < totalDays) {
      throw new BadRequestException(
        `Không đủ ngày nghỉ ${leaveType}. Còn lại: ${typeBalance.remaining} ngày`,
      );
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type: leaveType,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
      },
      include: { employee: { select: { id: true, code: true, fullName: true } } },
    });

    this.eventEmitter.emit('leave.requested', {
      leaveId: leave.id,
      employeeId: employee.id,
      type: leaveType,
      totalDays,
    });

    this.logger.log(`Leave request created: ${employee.code} - ${leaveType} for ${totalDays} days`);
    return this.mapLeaveRequest(leave);
  }

  /**
   * GET /attendance/leave-requests — all leave requests (paginated).
   */
  async findAllLeavesPaginated(page: number, limit: number, filters?: { status?: string; leaveType?: string }) {
    const skip = (page - 1) * limit;
    const where: Prisma.LeaveRequestWhereInput = {};

    if (filters?.status) where.status = filters.status as LeaveStatus;
    if (filters?.leaveType) where.type = filters.leaveType as LeaveType;

    const [total, records] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { employee: { select: { id: true, fullName: true } } },
      }),
    ]);

    const data = records.map((r) => this.mapLeaveRequest(r));
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * GET /attendance/leave-requests/my — my leave requests (paginated).
   */
  async findMyLeavesPaginated(userId: string, page: number, limit: number, filters?: { status?: string }) {
    const employee = await this.findEmployeeByUserId(userId);
    const skip = (page - 1) * limit;
    const where: Prisma.LeaveRequestWhereInput = { employeeId: employee.id };

    if (filters?.status) where.status = filters.status as LeaveStatus;

    const [total, records] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { employee: { select: { id: true, fullName: true } } },
      }),
    ]);

    const data = records.map((r) => this.mapLeaveRequest(r));
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * GET /attendance/leave-balance — flat format.
   */
  async getLeaveBalanceFlat(userId: string) {
    const year = new Date().getFullYear();
    const balance = await this.getLeaveBalance(userId, year);

    const find = (type: LeaveType) => balance.find((b) => b.type === type);

    return {
      employeeId: userId,
      annual: find(LeaveType.ANNUAL)?.total ?? 12,
      annualUsed: find(LeaveType.ANNUAL)?.used ?? 0,
      sick: find(LeaveType.SICK)?.total ?? 30,
      sickUsed: find(LeaveType.SICK)?.used ?? 0,
      personal: find(LeaveType.PERSONAL)?.total ?? 3,
      personalUsed: find(LeaveType.PERSONAL)?.used ?? 0,
    };
  }

  /**
   * PATCH /attendance/leave-requests/:id/cancel — cancel a leave request.
   */
  async cancelLeave(id: string, userId: string) {
    const employee = await this.findEmployeeByUserId(userId);
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { id: true, fullName: true } } },
    });

    if (!leave) throw new NotFoundException(`Yêu cầu nghỉ phép ${id} không tồn tại`);
    if (leave.employeeId !== employee.id) {
      throw new BadRequestException('Bạn không có quyền hủy yêu cầu này');
    }
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Không thể hủy yêu cầu ở trạng thái ${leave.status}`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      include: { employee: { select: { id: true, fullName: true } } },
    });

    return this.mapLeaveRequest(updated);
  }

  // ─────────────────────────────────────────────
  // APPROVE / REJECT LEAVE (keep existing)
  // ─────────────────────────────────────────────

  async approveLeave(id: string, approverId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!leave) throw new NotFoundException(`Leave request with ID ${id} not found`);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave request is already ${leave.status}`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    this.eventEmitter.emit('leave.approved', {
      leaveId: id,
      employeeId: leave.employeeId,
      approverId,
    });

    return updated;
  }

  async rejectLeave(id: string, approverId: string, reason: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException(`Leave request with ID ${id} not found`);
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave request is already ${leave.status}`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        approvedBy: null,
        rejectionReason: reason,
      },
    });
  }

  // ─────────────────────────────────────────────
  // LEAVE BALANCE (internal)
  // ─────────────────────────────────────────────

  async getLeaveBalance(userId: string, year: number) {
    const employee = await this.findEmployeeByUserId(userId);

    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: LeaveStatus.APPROVED,
        startDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
      },
    });

    const usedByType: Partial<Record<LeaveType, number>> = {};
    approvedLeaves.forEach((leave) => {
      const type = leave.type as LeaveType;
      usedByType[type] = (usedByType[type] || 0) + Number(leave.totalDays);
    });

    return (Object.entries(AttendanceService.LEAVE_BALANCES) as [LeaveType, number][]).map(
      ([type, total]) => ({
        type,
        total,
        used: usedByType[type] || 0,
        remaining: total - (usedByType[type] || 0),
      }),
    );
  }

  // ─────────────────────────────────────────────
  // OVERTIME
  // ─────────────────────────────────────────────

  async requestOvertime(userId: string, dto: RequestOvertimeDto) {
    const employee = await this.findEmployeeByUserId(userId);

    const overtime = await this.prisma.overtimeRequest.create({
      data: {
        employeeId: employee.id,
        date: new Date(dto.date),
        hours: dto.hours,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
      },
    });

    this.eventEmitter.emit('overtime.requested', {
      overtimeId: overtime.id,
      employeeId: employee.id,
      hours: dto.hours,
    });

    return overtime;
  }

  // ─────────────────────────────────────────────
  // MANUAL CHECK-IN / REVIEW
  // ─────────────────────────────────────────────

  async manualCheckIn(userId: string, dto: ManualCheckInDto) {
    const employee = await this.findEmployeeByUserId(userId);
    const now = new Date();
    const dateOnly = this.toDateOnly(now);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: dateOnly } },
    });

    if (existing?.checkIn) {
      throw new BadRequestException('Already checked in today');
    }

    const isLate =
      now.getHours() > AttendanceService.STANDARD_CHECK_IN ||
      (now.getHours() === AttendanceService.STANDARD_CHECK_IN && now.getMinutes() > 0);

    const data = {
      checkIn: now,
      checkInLat: dto.lat,
      checkInLng: dto.lng,
      type: AttendanceType.OFFICE,
      isLate,
      isManualCheckIn: true,
      selfieUrl: dto.selfieUrl,
      manualReason: dto.manualReason,
      hrReviewStatus: 'PENDING_REVIEW',
    };

    if (existing) {
      return this.prisma.attendance.update({ where: { id: existing.id }, data });
    }

    const attendance = await this.prisma.attendance.create({
      data: { employeeId: employee.id, date: dateOnly, ...data },
    });

    this.eventEmitter.emit('attendance.manual-check-in', {
      attendanceId: attendance.id,
      employeeId: employee.id,
      employeeName: employee.fullName,
    });

    return attendance;
  }

  async reviewManualCheckIn(attendanceId: string, approved: boolean, hrUserId: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { employee: { select: { id: true, code: true, fullName: true } } },
    });

    if (!attendance) throw new NotFoundException(`Attendance record ${attendanceId} not found`);
    if (!attendance.isManualCheckIn) {
      throw new BadRequestException('This attendance record is not a manual check-in');
    }
    if (attendance.hrReviewStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Already reviewed (${attendance.hrReviewStatus})`);
    }

    const updated = await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        hrReviewStatus: approved ? 'APPROVED' : 'REJECTED',
        hrReviewedBy: hrUserId,
        hrReviewedAt: new Date(),
      },
      include: { employee: { select: { id: true, code: true, fullName: true } } },
    });

    this.eventEmitter.emit('attendance.manual-check-in.reviewed', {
      attendanceId,
      employeeId: attendance.employeeId,
      approved,
      reviewedBy: hrUserId,
    });

    return updated;
  }

  async getPendingManualCheckIns() {
    return this.prisma.attendance.findMany({
      where: { isManualCheckIn: true, hrReviewStatus: 'PENDING_REVIEW' },
      include: {
        employee: { select: { id: true, code: true, fullName: true, departmentCode: true, branch: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────
  // LEGACY — kept for backward compat
  // ─────────────────────────────────────────────

  async getMyAttendance(userId: string, month: number, year: number) {
    const employee = await this.findEmployeeByUserId(userId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return this.prisma.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });
  }

  async getTeamAttendance(managerId: string, month: number, year: number) {
    const manager = await this.findEmployeeByUserId(managerId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const subordinates = await this.prisma.employee.findMany({
      where: { managerId: manager.id, status: 'ACTIVE' },
      select: { id: true, code: true, fullName: true },
    });

    const subIds = subordinates.map((s) => s.id);
    const attendances = await this.prisma.attendance.findMany({
      where: { employeeId: { in: subIds }, date: { gte: startDate, lte: endDate } },
      include: { employee: { select: { id: true, code: true, fullName: true } } },
    });

    return subordinates.map((sub) => {
      const records = attendances.filter((a) => a.employeeId === sub.id);
      return {
        employee: sub,
        totalDays: records.length,
        lateDays: records.filter((a) => a.isLate).length,
        totalWorkHours: records.reduce((sum, a) => sum + Number(a.workHours || 0), 0),
      };
    });
  }

  async getMonthlySummary(userId: string, month: number, year: number) {
    const employee = await this.findEmployeeByUserId(userId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [attendances, leaveRequests, overtimeRequests] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId: employee.id, date: { gte: startDate, lte: endDate } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          status: LeaveStatus.APPROVED,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      }),
      this.prisma.overtimeRequest.findMany({
        where: {
          employeeId: employee.id,
          status: LeaveStatus.APPROVED,
          date: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    return {
      employee: { id: employee.id, code: employee.code, fullName: employee.fullName },
      month,
      year,
      workDays: attendances.filter((a) => a.checkIn).length,
      lateDays: attendances.filter((a) => a.isLate).length,
      totalWorkHours: Math.round(attendances.reduce((sum, a) => sum + Number(a.workHours || 0), 0) * 100) / 100,
      otHours: overtimeRequests.reduce((sum, ot) => sum + Number(ot.hours), 0),
      leaveDays: leaveRequests.reduce((sum, l) => sum + Number(l.totalDays), 0),
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  /**
   * Maps a raw Prisma attendance record to the format the frontend expects.
   */
  private mapAttendanceRecord(record: any, employeeName: string) {
    let status = 'PRESENT';
    if (!record.checkIn) status = 'ABSENT';
    else if (record.isLate) status = 'LATE';

    return {
      id: record.id,
      employeeId: record.employeeId,
      employeeName,
      date: record.date?.toISOString?.() ?? record.date,
      checkIn: record.checkIn ? this.formatTime(record.checkIn) : null,
      checkOut: record.checkOut ? this.formatTime(record.checkOut) : null,
      workHours: Number(record.workHours || 0),
      overtimeHours: Number(record.overtimeHours || 0),
      status,
      note: record.notes,
      createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    };
  }

  /**
   * Maps a raw Prisma leave request to the format the frontend expects.
   */
  private mapLeaveRequest(record: any) {
    return {
      id: record.id,
      employeeId: record.employeeId,
      employeeName: record.employee?.fullName ?? '',
      leaveType: record.type,
      startDate: record.startDate?.toISOString?.() ?? record.startDate,
      endDate: record.endDate?.toISOString?.() ?? record.endDate,
      days: Number(record.totalDays),
      reason: record.reason ?? '',
      status: record.status,
      approverId: record.approvedBy,
      approverName: null,
      approvalId: null,
      createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    };
  }

  private formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().substring(11, 16); // "HH:mm"
  }

  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  private async findEmployeeByUserId(userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { OR: [{ userId }, { id: userId }] },
    });
    if (!employee) throw new NotFoundException(`Không tìm thấy nhân viên cho user ${userId}`);
    return employee;
  }

  private toDateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
