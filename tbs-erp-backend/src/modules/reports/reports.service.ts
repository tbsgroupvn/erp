import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { ExportService, ExportColumn } from '@core/export/export.service';

export interface ExportOrdersQuery {
  from?: string;
  to?: string;
  status?: string;
}

export interface ExportARQuery {
  from?: string;
  to?: string;
  status?: string;
}

export interface ExportAttendanceQuery {
  month: number;
  year: number;
  employeeId?: string;
}

export interface ExportPayrollQuery {
  month: number;
  year: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Exports orders to CSV or HTML.
   */
  async exportOrders(query: ExportOrdersQuery, format: 'csv' | 'html'): Promise<string> {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers: ExportColumn[] = [
      { key: 'code', label: 'Ma don hang' },
      { key: 'customerId', label: 'Ma KH' },
      { key: 'saleId', label: 'Nhan vien KD' },
      { key: 'status', label: 'Trang thai' },
      { key: 'serviceType', label: 'Loai dich vu' },
      { key: 'totalAmount', label: 'Tong tien (VND)' },
      { key: 'depositPaid', label: 'Dat coc (VND)' },
      { key: 'branch', label: 'Chi nhanh' },
      { key: 'createdAt', label: 'Ngay tao' },
    ];

    const rows = orders.map((o) => ({
      code: o.code,
      customerId: o.customerId,
      saleId: o.saleId,
      status: o.status,
      serviceType: o.serviceType,
      totalAmount: Number(o.totalAmount ?? 0).toLocaleString('vi-VN'),
      depositPaid: Number(o.depositPaid ?? 0).toLocaleString('vi-VN'),
      branch: o.branch,
      createdAt: o.createdAt.toLocaleDateString('vi-VN'),
    }));

    if (format === 'html') {
      const fromLabel = query.from ? new Date(query.from).toLocaleDateString('vi-VN') : 'Tat ca';
      const toLabel = query.to ? new Date(query.to).toLocaleDateString('vi-VN') : 'Tat ca';
      return this.exportService.toHtmlTable('Bao cao don hang', rows, headers, {
        'Tu ngay': fromLabel,
        'Den ngay': toLabel,
        'Tong so': `${rows.length} don hang`,
      });
    }
    return this.exportService.toCsv(rows, headers);
  }

  /**
   * Exports accounts receivable to CSV or HTML.
   */
  async exportAR(query: ExportARQuery, format: 'csv' | 'html'): Promise<string> {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }

    const arRecords = await this.prisma.accountReceivable.findMany({
      where,
      include: {
        customer: { select: { fullName: true, code: true } },
        order: { select: { code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers: ExportColumn[] = [
      { key: 'code', label: 'Ma phieu' },
      { key: 'orderCode', label: 'Ma don hang' },
      { key: 'customerCode', label: 'Ma KH' },
      { key: 'customerName', label: 'Ten khach hang' },
      { key: 'amount', label: 'So tien (VND)' },
      { key: 'paidAmount', label: 'Da thu (VND)' },
      { key: 'remainingAmount', label: 'Con phai thu (VND)' },
      { key: 'dueDate', label: 'Han thanh toan' },
      { key: 'status', label: 'Trang thai' },
      { key: 'createdAt', label: 'Ngay tao' },
    ];

    const rows = arRecords.map((ar) => {
      const remaining = Number(ar.amount) - Number(ar.paidAmount) - Number(ar.nettedAmount ?? 0);
      return {
        code: ar.code,
        orderCode: ar.order?.code ?? '',
        customerCode: ar.customer?.code ?? '',
        customerName: ar.customer?.fullName ?? '',
        amount: Number(ar.amount).toLocaleString('vi-VN'),
        paidAmount: Number(ar.paidAmount).toLocaleString('vi-VN'),
        remainingAmount: Math.max(0, remaining).toLocaleString('vi-VN'),
        dueDate: ar.dueDate ? new Date(ar.dueDate).toLocaleDateString('vi-VN') : '',
        status: ar.status,
        createdAt: ar.createdAt.toLocaleDateString('vi-VN'),
      };
    });

    if (format === 'html') {
      const totalRemaining = arRecords.reduce(
        (sum, ar) => sum + Math.max(0, Number(ar.amount) - Number(ar.paidAmount) - Number(ar.nettedAmount ?? 0)),
        0,
      );
      return this.exportService.toHtmlTable('Bao cao cong no phai thu', rows, headers, {
        'Tong so': `${rows.length} phieu`,
        'Tong con no': `${totalRemaining.toLocaleString('vi-VN')} VND`,
      });
    }
    return this.exportService.toCsv(rows, headers);
  }

  /**
   * Exports attendance summary for a month to CSV or HTML.
   */
  async exportAttendance(query: ExportAttendanceQuery, format: 'csv' | 'html'): Promise<string> {
    const startDate = new Date(query.year, query.month - 1, 1);
    const endDate = new Date(query.year, query.month, 0);

    const where: Record<string, unknown> = {
      date: { gte: startDate, lte: endDate },
    };
    if (query.employeeId) where.employeeId = query.employeeId;

    const attendances = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: { code: true, fullName: true, departmentCode: true, branch: true },
        },
      },
      orderBy: [{ employee: { code: 'asc' } }, { date: 'asc' }],
      take: 10000,
    });

    const headers: ExportColumn[] = [
      { key: 'employeeCode', label: 'Ma NV' },
      { key: 'employeeName', label: 'Ho ten' },
      { key: 'department', label: 'Phong ban' },
      { key: 'branch', label: 'Chi nhanh' },
      { key: 'date', label: 'Ngay' },
      { key: 'checkIn', label: 'Gio vao' },
      { key: 'checkOut', label: 'Gio ra' },
      { key: 'workHours', label: 'So gio lam' },
      { key: 'overtimeHours', label: 'Tang ca' },
      { key: 'isLate', label: 'Di muon' },
      { key: 'type', label: 'Hinh thuc' },
    ];

    const rows = attendances.map((a) => ({
      employeeCode: a.employee.code,
      employeeName: a.employee.fullName,
      department: a.employee.departmentCode,
      branch: a.employee.branch,
      date: new Date(a.date).toLocaleDateString('vi-VN'),
      checkIn: a.checkIn ? new Date(a.checkIn).toLocaleTimeString('vi-VN') : '',
      checkOut: a.checkOut ? new Date(a.checkOut).toLocaleTimeString('vi-VN') : '',
      workHours: Number(a.workHours ?? 0).toFixed(1),
      overtimeHours: Number(a.overtimeHours ?? 0).toFixed(1),
      isLate: a.isLate ? 'Co' : 'Khong',
      type: a.type,
    }));

    if (format === 'html') {
      const monthLabel = `Thang ${query.month}/${query.year}`;
      return this.exportService.toHtmlTable('Bao cao cham cong', rows, headers, {
        'Thang': monthLabel,
        'Tong ban ghi': `${rows.length}`,
      });
    }
    return this.exportService.toCsv(rows, headers);
  }

  /**
   * Exports payroll records for a month to CSV or HTML.
   */
  async exportPayroll(query: ExportPayrollQuery, format: 'csv' | 'html'): Promise<string> {
    const records = await this.prisma.payrollRecord.findMany({
      where: { month: query.month, year: query.year },
      include: {
        employee: {
          select: { code: true, fullName: true, departmentCode: true, branch: true },
        },
      },
      orderBy: { employee: { code: 'asc' } },
    });

    const headers: ExportColumn[] = [
      { key: 'employeeCode', label: 'Ma NV' },
      { key: 'employeeName', label: 'Ho ten' },
      { key: 'department', label: 'Phong ban' },
      { key: 'branch', label: 'Chi nhanh' },
      { key: 'baseSalary', label: 'Luong co ban' },
      { key: 'overtimePay', label: 'Phu cap tang ca' },
      { key: 'allowances', label: 'Phu cap khac' },
      { key: 'grossSalary', label: 'Luong gross' },
      { key: 'taxDeduction', label: 'Khau tru thue' },
      { key: 'insuranceDeduction', label: 'Khau tru BHXH' },
      { key: 'otherDeductions', label: 'Khau tru khac' },
      { key: 'netSalary', label: 'Luong thuc nhan' },
      { key: 'status', label: 'Trang thai' },
    ];

    const rows = records.map((r) => ({
      employeeCode: r.employee.code,
      employeeName: r.employee.fullName,
      department: r.employee.departmentCode,
      branch: r.employee.branch,
      baseSalary: Number(r.baseSalary).toLocaleString('vi-VN'),
      overtimePay: Number(r.overtimePay).toLocaleString('vi-VN'),
      allowances: Number(r.allowances).toLocaleString('vi-VN'),
      grossSalary: Number(r.grossSalary).toLocaleString('vi-VN'),
      taxDeduction: Number(r.taxDeduction).toLocaleString('vi-VN'),
      insuranceDeduction: Number(r.insuranceDeduction).toLocaleString('vi-VN'),
      otherDeductions: Number(r.otherDeductions).toLocaleString('vi-VN'),
      netSalary: Number(r.netSalary).toLocaleString('vi-VN'),
      status: r.status,
    }));

    if (format === 'html') {
      const totalNet = records.reduce((s, r) => s + Number(r.netSalary), 0);
      return this.exportService.toHtmlTable('Bang luong', rows, headers, {
        'Thang': `${query.month}/${query.year}`,
        'So nhan vien': `${rows.length}`,
        'Tong chi luong': `${totalNet.toLocaleString('vi-VN')} VND`,
      });
    }
    return this.exportService.toCsv(rows, headers);
  }
}
