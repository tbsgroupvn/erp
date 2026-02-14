import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { CheckInDto, CheckOutDto } from './dto/check-in.dto';
import { RequestLeaveDto } from './dto/leave-request.dto';
import { RequestOvertimeDto } from './dto/overtime-request.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  private static readonly STANDARD_CHECK_IN = 8; // 8:00 AM
  private static readonly LEAVE_BALANCES: Record<string, number> = {
    ANNUAL: 12,
    SICK: 30,
    PERSONAL: 3,
    MATERNITY: 180,
    OTHER: 5,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Records check-in for an employee.
   */
  async checkIn(userId: string, dto: CheckInDto) {
    const employee = await this.findEmployeeByUserId(userId);
    const checkInTime = new Date(dto.timestamp);
    const dateOnly = this.toDateOnly(checkInTime);

    // Check if already checked in today
    const existing = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId: employee.id, date: dateOnly },
      },
    });

    if (existing?.checkIn) {
      throw new BadRequestException('Already checked in today');
    }

    const isLate = checkInTime.getHours() > AttendanceService.STANDARD_CHECK_IN ||
      (checkInTime.getHours() === AttendanceService.STANDARD_CHECK_IN && checkInTime.getMinutes() > 0);

    if (existing) {
      // Update existing record
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: checkInTime,
          checkInLat: dto.lat,
          checkInLng: dto.lng,
          type: dto.type,
          isLate,
        },
      });
    }

    return this.prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: dateOnly,
        checkIn: checkInTime,
        checkInLat: dto.lat,
        checkInLng: dto.lng,
        type: dto.type,
        isLate,
      },
    });
  }

  /**
   * Records check-out for an employee.
   */
  async checkOut(userId: string, dto: CheckOutDto) {
    const employee = await this.findEmployeeByUserId(userId);
    const checkOutTime = new Date(dto.timestamp);
    const dateOnly = this.toDateOnly(checkOutTime);

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId: employee.id, date: dateOnly },
      },
    });

    if (!attendance) {
      throw new BadRequestException('No check-in record found for today');
    }

    if (!attendance.checkIn) {
      throw new BadRequestException('Must check in before checking out');
    }

    if (attendance.checkOut) {
      throw new BadRequestException('Already checked out today');
    }

    const workHours =
      (checkOutTime.getTime() - new Date(attendance.checkIn).getTime()) /
      (1000 * 60 * 60);

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: checkOutTime,
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        workHours: Math.round(workHours * 100) / 100,
      },
    });
  }

  /**
   * Gets monthly attendance for an employee.
   */
  async getMyAttendance(userId: string, month: number, year: number) {
    const employee = await this.findEmployeeByUserId(userId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return this.prisma.attendance.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Gets team attendance summary for a manager.
   */
  async getTeamAttendance(managerId: string, month: number, year: number) {
    const manager = await this.findEmployeeByUserId(managerId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get all subordinates
    const subordinates = await this.prisma.employee.findMany({
      where: { managerId: manager.id, status: 'ACTIVE' },
      select: { id: true, code: true, fullName: true },
    });

    const subIds = subordinates.map((s) => s.id);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeId: { in: subIds },
        date: { gte: startDate, lte: endDate },
      },
      include: {
        employee: { select: { id: true, code: true, fullName: true } },
      },
    });

    // Group by employee
    const summary = subordinates.map((sub) => {
      const records = attendances.filter((a) => a.employeeId === sub.id);
      return {
        employee: sub,
        totalDays: records.length,
        lateDays: records.filter((a) => a.isLate).length,
        totalWorkHours: records.reduce((sum, a) => sum + (a.workHours || 0), 0),
      };
    });

    return summary;
  }

  /**
   * Creates a leave request, auto-calculating leave days (excluding weekends).
   */
  async requestLeave(userId: string, dto: RequestLeaveDto) {
    const employee = await this.findEmployeeByUserId(userId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const totalDays = this.calculateBusinessDays(startDate, endDate);

    if (totalDays <= 0) {
      throw new BadRequestException('Leave period must include at least one business day');
    }

    // Check leave balance
    const balance = await this.getLeaveBalance(userId, startDate.getFullYear());
    const typeBalance = balance.find((b) => b.type === dto.type);
    if (typeBalance && typeBalance.remaining < totalDays) {
      throw new BadRequestException(
        `Insufficient ${dto.type} leave balance. Remaining: ${typeBalance.remaining} days`,
      );
    }

    const leave = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type: dto.type,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
      },
      include: {
        employee: { select: { id: true, code: true, fullName: true } },
      },
    });

    this.eventEmitter.emit('leave.requested', {
      leaveId: leave.id,
      employeeId: employee.id,
      type: dto.type,
      totalDays,
    });

    this.logger.log(
      `Leave request created: ${employee.code} - ${dto.type} for ${totalDays} days`,
    );

    return leave;
  }

  /**
   * Approves a leave request.
   */
  async approveLeave(id: string, approverId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!leave) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }
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

  /**
   * Rejects a leave request with a reason.
   */
  async rejectLeave(id: string, approverId: string, reason: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });

    if (!leave) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave request is already ${leave.status}`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        approvedBy: approverId,
        rejectionReason: reason,
      },
    });
  }

  /**
   * Gets remaining leave balance for a user by year.
   */
  async getLeaveBalance(userId: string, year: number) {
    const employee = await this.findEmployeeByUserId(userId);

    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: LeaveStatus.APPROVED,
        startDate: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31),
        },
      },
    });

    const usedByType: Record<string, number> = {};
    approvedLeaves.forEach((leave) => {
      const type = leave.type;
      usedByType[type] = (usedByType[type] || 0) + leave.totalDays;
    });

    return Object.entries(AttendanceService.LEAVE_BALANCES).map(([type, total]) => ({
      type,
      total,
      used: usedByType[type] || 0,
      remaining: total - (usedByType[type] || 0),
    }));
  }

  /**
   * Creates an overtime request.
   */
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

  /**
   * Gets monthly summary for an employee.
   */
  async getMonthlySummary(userId: string, month: number, year: number) {
    const employee = await this.findEmployeeByUserId(userId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [attendances, leaveRequests, overtimeRequests] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          employeeId: employee.id,
          date: { gte: startDate, lte: endDate },
        },
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

    const workDays = attendances.filter((a) => a.checkIn).length;
    const lateDays = attendances.filter((a) => a.isLate).length;
    const totalWorkHours = attendances.reduce((sum, a) => sum + (a.workHours || 0), 0);
    const otHours = overtimeRequests.reduce((sum, ot) => sum + ot.hours, 0);
    const leaveDays = leaveRequests.reduce((sum, l) => sum + l.totalDays, 0);

    return {
      employee: { id: employee.id, code: employee.code, fullName: employee.fullName },
      month,
      year,
      workDays,
      lateDays,
      totalWorkHours: Math.round(totalWorkHours * 100) / 100,
      otHours,
      leaveDays,
    };
  }

  /**
   * Calculates business days between two dates (excluding weekends).
   */
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  /**
   * Finds employee linked to a user ID.
   */
  private async findEmployeeByUserId(userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { OR: [{ userId }, { id: userId }] },
    });

    if (!employee) {
      throw new NotFoundException(`Employee not found for user ${userId}`);
    }

    return employee;
  }

  /**
   * Converts a datetime to date-only (zeroed time).
   */
  private toDateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
