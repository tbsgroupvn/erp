import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { EmployeeStatus, LeaveStatus, PayrollStatus, Prisma } from '@prisma/client';
import { PayrollQueryDto } from './dto/payroll-query.dto';

/**
 * Vietnam personal income tax (PIT) brackets (monthly, after deductions).
 * Based on Article 22, Law on Personal Income Tax.
 *
 * These rates are defined by Vietnamese tax law and should be updated
 * if the government changes the tax brackets. Consider moving to a
 * database-driven configuration if rates change frequently.
 *
 * Deduction: 11,000,000 VND personal + 4,400,000 per dependent.
 */
const VIETNAM_PIT_BRACKETS: ReadonlyArray<{ readonly max: number; readonly rate: number }> = [
  { max: 5_000_000, rate: 0.05 },
  { max: 10_000_000, rate: 0.10 },
  { max: 18_000_000, rate: 0.15 },
  { max: 32_000_000, rate: 0.20 },
  { max: 52_000_000, rate: 0.25 },
  { max: 80_000_000, rate: 0.30 },
  { max: Infinity, rate: 0.35 },
] as const;

/** Personal deduction per month (VND). Update per Government Decree. */
const PERSONAL_DEDUCTION = 11_000_000;

/** Dependent deduction per dependent per month (VND). */
const DEPENDENT_DEDUCTION = 4_400_000;

/** Social insurance employee contribution rate. */
const SOCIAL_INSURANCE_RATE = 0.08;

/** Health insurance employee contribution rate. */
const HEALTH_INSURANCE_RATE = 0.015;

/** Unemployment insurance employee contribution rate. */
const UNEMPLOYMENT_INSURANCE_RATE = 0.01;

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Batch calculates payroll for all active employees for a given month/year.
   */
  async calculatePayroll(month: number, year: number) {
    // Get all active employees
    const employees = await this.prisma.employee.findMany({
      where: { status: EmployeeStatus.ACTIVE },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found');
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    // Batch-fetch all overtime requests and attendances for the month to avoid N+1
    const allOvertime = await this.prisma.overtimeRequest.findMany({
      where: {
        status: LeaveStatus.APPROVED,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const allAttendance = await this.prisma.attendance.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
        checkIn: { not: null },
      },
    });

    const results = [];

    for (const emp of employees) {
      const baseSalary = Number(emp.salary || 0);

      // Filter overtime for this employee from batch
      const overtimeRequests = allOvertime.filter(
        (ot) => ot.employeeId === emp.id,
      );

      const otHours = overtimeRequests.reduce((sum, ot) => sum + ot.hours, 0);

      // OT rate: 1.5x weekday, 2x weekend, 3x holiday
      // Simplified: assume average 1.5x for now
      const hourlyRate = baseSalary / (22 * 8); // 22 working days, 8 hours
      let otPay = 0;
      for (const ot of overtimeRequests) {
        const dayOfWeek = new Date(ot.date).getDay();
        let multiplier = 1.5; // weekday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          multiplier = 2.0; // weekend
        }
        otPay += ot.hours * hourlyRate * multiplier;
      }

      // Filter attendance for this employee from batch
      const attendances = allAttendance.filter(
        (a) => a.employeeId === emp.id,
      );
      const standardWorkDays = 22;
      const workDays = attendances.length;
      const effectiveWorkDays = Math.min(workDays, standardWorkDays);
      const proratedSalary = Math.round(baseSalary * effectiveWorkDays / standardWorkDays);

      const grossSalary = proratedSalary + otPay;

      // Insurance deductions
      const socialInsurance = baseSalary * SOCIAL_INSURANCE_RATE;
      const healthInsurance = baseSalary * HEALTH_INSURANCE_RATE;
      const unemploymentInsurance = baseSalary * UNEMPLOYMENT_INSURANCE_RATE;
      const totalInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

      // Taxable income
      const dependents = emp.numberOfDependents || 0;
      const taxableIncome = grossSalary - totalInsurance - PERSONAL_DEDUCTION - (DEPENDENT_DEDUCTION * dependents);

      // Personal income tax (progressive)
      const personalIncomeTax = taxableIncome > 0
        ? this.calculatePIT(taxableIncome)
        : 0;

      // Commission clawback deductions: sum ON_HOLD clawback amounts for this employee's userId
      let commissionClawback = 0;
      if (emp.userId) {
        const clawbackRecords = await this.prisma.commissionRecord.findMany({
          where: {
            saleId: emp.userId,
            status: 'ON_HOLD',
            clawbackAmount: { not: null },
          },
          select: { clawbackAmount: true },
        });

        commissionClawback = clawbackRecords.reduce(
          (sum, r) => sum + (r.clawbackAmount ? Number(r.clawbackAmount) : 0),
          0,
        );
      }

      const otherDeductions = commissionClawback;
      const totalDeductions = totalInsurance + personalIncomeTax + otherDeductions;
      const netSalary = grossSalary - totalDeductions;

      // Upsert payroll record
      const payroll = await this.prisma.payrollRecord.upsert({
        where: {
          employeeId_month_year: {
            employeeId: emp.id,
            month,
            year,
          },
        },
        create: {
          employeeId: emp.id,
          month,
          year,
          baseSalary,
          overtimePay: Math.round(otPay),
          grossSalary: Math.round(grossSalary),
          taxDeduction: Math.round(personalIncomeTax),
          insuranceDeduction: Math.round(totalInsurance),
          otherDeductions: Math.round(otherDeductions),
          netSalary: Math.round(netSalary),
          status: 'DRAFT',
        },
        update: {
          baseSalary,
          overtimePay: Math.round(otPay),
          grossSalary: Math.round(grossSalary),
          taxDeduction: Math.round(personalIncomeTax),
          insuranceDeduction: Math.round(totalInsurance),
          otherDeductions: Math.round(otherDeductions),
          netSalary: Math.round(netSalary),
        },
        include: {
          employee: { select: { id: true, code: true, fullName: true } },
        },
      });

      results.push(payroll);
    }

    this.logger.log(
      `Payroll calculated for ${results.length} employees: ${month}/${year}`,
    );

    return {
      month,
      year,
      totalEmployees: results.length,
      records: results,
    };
  }

  /**
   * Gets an individual payslip for an employee.
   */
  async getPayslip(employeeId: string, month: number, year: number) {
    const payroll = await this.prisma.payrollRecord.findUnique({
      where: {
        employeeId_month_year: { employeeId, month, year },
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            fullName: true,
            departmentCode: true,
            positionTitle: true,
            branch: true,
            bankAccount: true,
            bankName: true,
          },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException(
        `Payslip not found for employee ${employeeId} for ${month}/${year}`,
      );
    }

    return payroll;
  }

  /**
   * Approves all payroll records for a month/year batch.
   */
  async approvePayroll(month: number, year: number, approverId: string) {
    const result = await this.prisma.payrollRecord.updateMany({
      where: { month, year, status: 'DRAFT' },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new BadRequestException(
        `No draft payroll records found for ${month}/${year}`,
      );
    }

    this.eventEmitter.emit('payroll.approved', {
      month,
      year,
      count: result.count,
      approverId,
    });

    this.logger.log(
      `Payroll approved for ${month}/${year}: ${result.count} records by ${approverId}`,
    );

    return { month, year, approvedCount: result.count };
  }

  /**
   * Gets payroll summary for a month/year.
   */
  async getPayrollSummary(month: number, year: number) {
    const records = await this.prisma.payrollRecord.findMany({
      where: { month, year },
      include: {
        employee: {
          select: { departmentCode: true, branch: true },
        },
      },
    });

    if (records.length === 0) {
      throw new NotFoundException(`No payroll records found for ${month}/${year}`);
    }

    const totalGross = records.reduce((sum, r) => sum + Number(r.grossSalary), 0);
    const totalTax = records.reduce((sum, r) => sum + Number(r.taxDeduction), 0);
    const totalInsurance = records.reduce((sum, r) => sum + Number(r.insuranceDeduction), 0);
    const totalNet = records.reduce((sum, r) => sum + Number(r.netSalary), 0);
    const totalDeductions = totalTax + totalInsurance;

    // Group by department
    const byDepartment: Record<string, { gross: number; net: number; count: number }> = {};
    records.forEach((r) => {
      const dept = r.employee.departmentCode;
      if (!byDepartment[dept]) {
        byDepartment[dept] = { gross: 0, net: 0, count: 0 };
      }
      byDepartment[dept].gross += Number(r.grossSalary);
      byDepartment[dept].net += Number(r.netSalary);
      byDepartment[dept].count += 1;
    });

    return {
      month,
      year,
      totalEmployees: records.length,
      totalGross: Math.round(totalGross),
      totalDeductions: Math.round(totalDeductions),
      totalTax: Math.round(totalTax),
      totalInsurance: Math.round(totalInsurance),
      totalNet: Math.round(totalNet),
      byDepartment: Object.entries(byDepartment).map(([dept, data]) => ({
        department: dept,
        employeeCount: data.count,
        totalGross: Math.round(data.gross),
        totalNet: Math.round(data.net),
      })),
    };
  }

  /**
   * Lists payroll records with pagination.
   */
  async findAll(query: PayrollQueryDto) {
    const where: Prisma.PayrollRecordWhereInput = {};

    if (query.month) where.month = query.month;
    if (query.year) where.year = query.year;
    if (query.status) where.status = query.status as PayrollStatus;
    if (query.employeeId) where.employeeId = query.employeeId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payrollRecord.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.PayrollRecordOrderByWithRelationInput,
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              fullName: true,
              departmentCode: true,
              branch: true,
            },
          },
        },
      }),
      this.prisma.payrollRecord.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Calculates Vietnam progressive personal income tax.
   */
  private calculatePIT(taxableIncome: number): number {
    let tax = 0;
    let remaining = taxableIncome;
    let prevMax = 0;

    for (const bracket of VIETNAM_PIT_BRACKETS) {
      const bracketSize = bracket.max - prevMax;
      const taxable = Math.min(remaining, bracketSize);
      tax += taxable * bracket.rate;
      remaining -= taxable;
      prevMax = bracket.max;
      if (remaining <= 0) break;
    }

    return Math.round(tax);
  }
}
