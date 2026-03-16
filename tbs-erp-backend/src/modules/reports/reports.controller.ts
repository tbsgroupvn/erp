import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

type ExportFormat = 'csv' | 'html';

function resolveFormat(raw?: string): ExportFormat {
  return raw === 'html' ? 'html' : 'csv';
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/orders/export?format=csv&from=2026-01-01&to=2026-03-31&status=COMPLETED
   */
  @Get('orders/export')
  @ApiOperation({ summary: 'Xuat bao cao don hang (CSV hoac HTML/PDF)' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'html'] })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-03-31' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Export file' })
  async exportOrders(
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    const fmt = resolveFormat(format);
    const content = await this.reportsService.exportOrders({ from, to, status }, fmt);
    this.sendExport(res, content, fmt, 'bao-cao-don-hang');
  }

  /**
   * GET /reports/ar/export?format=csv&status=OVERDUE
   */
  @Get('ar/export')
  @ApiOperation({ summary: 'Xuat bao cao cong no phai thu (CSV hoac HTML/PDF)' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'html'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'status', required: false })
  async exportAR(
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    const fmt = resolveFormat(format);
    const content = await this.reportsService.exportAR({ from, to, status }, fmt);
    this.sendExport(res, content, fmt, 'cong-no-phai-thu');
  }

  /**
   * GET /reports/attendance/export?format=csv&month=3&year=2026&employeeId=...
   */
  @Get('attendance/export')
  @ApiOperation({ summary: 'Xuat bao cao cham cong (CSV hoac HTML/PDF)' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'html'] })
  @ApiQuery({ name: 'month', required: true, example: 3 })
  @ApiQuery({ name: 'year', required: true, example: 2026 })
  @ApiQuery({ name: 'employeeId', required: false })
  async exportAttendance(
    @Res() res: Response,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('format') format?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const fmt = resolveFormat(format);
    const content = await this.reportsService.exportAttendance({ month, year, employeeId }, fmt);
    this.sendExport(res, content, fmt, `cham-cong-${month}-${year}`);
  }

  /**
   * GET /reports/payroll/export?format=csv&month=3&year=2026
   */
  @Get('payroll/export')
  @ApiOperation({ summary: 'Xuat bang luong (CSV hoac HTML/PDF)' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'html'] })
  @ApiQuery({ name: 'month', required: true, example: 3 })
  @ApiQuery({ name: 'year', required: true, example: 2026 })
  async exportPayroll(
    @Res() res: Response,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('format') format?: string,
  ) {
    const fmt = resolveFormat(format);
    const content = await this.reportsService.exportPayroll({ month, year }, fmt);
    this.sendExport(res, content, fmt, `bang-luong-${month}-${year}`);
  }

  // -----------------------------------------------------------------------
  // Private helper: sets response headers and sends content
  // -----------------------------------------------------------------------
  private sendExport(res: Response, content: string, format: ExportFormat, basename: string) {
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(content);
    } else {
      const filename = `${basename}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    }
  }
}
