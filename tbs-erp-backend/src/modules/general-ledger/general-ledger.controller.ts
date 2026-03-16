import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
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
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { GeneralLedgerService } from './general-ledger.service';
import { ExchangeRateGLService } from './exchange-rate-gl.service';
import { PeriodClosingService } from './period-closing.service';
import { VasReportService } from './vas-report.service';
import { VasExcelExportService } from './vas-excel-export.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import { VasReportQueryDto } from './dto/vas-report.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { RevalueFxDto } from './dto/revalue-fx.dto';

@ApiTags('General Ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('general-ledger')
export class GeneralLedgerController {
  constructor(
    private readonly glService: GeneralLedgerService,
    private readonly exchangeRateGLService: ExchangeRateGLService,
    private readonly periodClosingService: PeriodClosingService,
    private readonly vasReportService: VasReportService,
    private readonly vasExcelExportService: VasExcelExportService,
  ) {}

  @Post('journal-entries')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_COST,
    UserRole.CEO,
    UserRole.CFO,
  )
  @ApiOperation({
    summary: 'Create a journal entry',
    description: 'Creates a double-entry journal entry. Total debits must equal total credits.',
  })
  @ApiResponse({ status: 201, description: 'Journal entry created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or unbalanced entry' })
  async createJournalEntry(@Body() dto: CreateJournalEntryDto, @CurrentUser() user: ICurrentUser) {
    const entry = await this.glService.createJournalEntry(dto, user.id);
    return BaseResponse.ok(entry, 'Journal entry created successfully');
  }

  @Get('journal-entries')
  @Roles(
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT_COST,
    UserRole.CEO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'List journal entries',
    description: 'Returns paginated journal entries with optional filters.',
  })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved successfully' })
  async findAll(@Query() query: GeneralLedgerQueryDto) {
    const result = await this.glService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('trial-balance')
  @Roles(
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT_COST,
    UserRole.CEO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Get trial balance',
    description: 'Computes trial balance summing debits and credits per account as of a date.',
  })
  @ApiQuery({ name: 'asOfDate', required: true, example: '2025-12-31' })
  @ApiResponse({ status: 200, description: 'Trial balance retrieved' })
  async getTrialBalance(@Query('asOfDate') asOfDate: string) {
    const result = await this.glService.getTrialBalance(asOfDate);
    return BaseResponse.ok(result);
  }

  @Get('accounts/:accountCode/balance')
  @Roles(
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT_COST,
    UserRole.CEO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Get account balance',
    description: 'Returns running balance for a specific account within an optional date range.',
  })
  @ApiParam({ name: 'accountCode', description: 'Account code' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Account balance retrieved' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountBalance(
    @Param('accountCode') accountCode: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.glService.getAccountBalance(accountCode, startDate, endDate);
    return BaseResponse.ok(result);
  }

  @Post('close-period')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.CEO, UserRole.CFO)
  @ApiOperation({
    summary: 'Close accounting period',
    description: 'Closes an accounting period preventing further journal entries.',
  })
  @ApiResponse({ status: 200, description: 'Period closed successfully' })
  @ApiResponse({ status: 400, description: 'Period already closed' })
  async closePeriod(
    @Body() dto: ClosePeriodDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.glService.closePeriod(dto.year, dto.month, user.id);
    return BaseResponse.ok(
      result,
      `Period ${dto.year}-${String(dto.month).padStart(2, '0')} closed successfully`,
    );
  }

  @Get('chart-of-accounts')
  @Roles(
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT_COST,
    UserRole.CEO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Get chart of accounts',
    description: 'Lists all accounts with hierarchy.',
  })
  @ApiResponse({ status: 200, description: 'Chart of accounts retrieved' })
  async getChartOfAccounts() {
    const accounts = await this.glService.getChartOfAccounts();
    return BaseResponse.ok(accounts);
  }

  @Post('revalue-fx')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Revalue FX positions',
    description: 'Revalues foreign exchange positions and creates adjustment journal entries.',
  })
  @ApiResponse({ status: 200, description: 'FX positions revalued successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async revalueFx(
    @Body() dto: RevalueFxDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.exchangeRateGLService.revalueForeignCurrency(
      dto.year,
      dto.month,
      dto.currentRate,
      user.id,
    );
    return BaseResponse.ok(result);
  }

  @Get('fx-gain-loss')
  @Roles(UserRole.CEO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get FX gain/loss report',
    description: 'Returns realized and unrealized foreign exchange gains and losses.',
  })
  @ApiResponse({ status: 200, description: 'FX gain/loss report retrieved' })
  async getFxGainLoss(@Query('year') year?: number, @Query('month') month?: number) {
    const data = await this.exchangeRateGLService.getFxGainLossReport(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
    return BaseResponse.ok(data);
  }

  @Get('period-closing-checklist')
  @Roles(UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Get period closing checklist',
    description: 'Returns a checklist of tasks to complete before closing an accounting period.',
  })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Fiscal year' })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Fiscal month' })
  @ApiResponse({ status: 200, description: 'Period closing checklist retrieved' })
  async getPeriodClosingChecklist(@Query('year') year?: number, @Query('month') month?: number) {
    const now = new Date();
    const data = await this.periodClosingService.getChecklist(
      year ? Number(year) : now.getFullYear(),
      month ? Number(month) : now.getMonth() + 1,
    );
    return BaseResponse.ok(data);
  }

  @Post('period-closing')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Close accounting period via period closing service',
    description:
      'Performs comprehensive period closing including all validation checks and journal entries.',
  })
  @ApiResponse({ status: 200, description: 'Period closed successfully' })
  @ApiResponse({ status: 400, description: 'Period closing validation failed' })
  async closePeriodViaService(
    @Body() dto: ClosePeriodDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.periodClosingService.closePeriod(dto.year, dto.month, user.id);
    return BaseResponse.ok(result);
  }

  @Get('vas-report')
  @Roles(
    UserRole.CEO,
    UserRole.CFO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Xuat bao cao tai chinh VAS (JSON)',
    description:
      'Tao bao cao tai chinh theo chuan muc ke toan Viet Nam (VAS). ' +
      'Ho tro: B01_DN (Bang can doi ke toan), B02_DN (Ket qua kinh doanh), B03_DN (Luu chuyen tien te). ' +
      'Them compareDateFrom + compareDateTo de hien thi so lieu ky truoc va % thay doi.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bao cao VAS duoc tao thanh cong. Cau truc ket qua phu thuoc vao loai bao cao.',
  })
  @ApiResponse({ status: 400, description: 'Loai bao cao khong hop le hoac khoang ngay sai' })
  async getVasReport(@Query() query: VasReportQueryDto) {
    const result = await this.vasReportService.generateReport(query);
    return BaseResponse.ok(result, `Bao cao ${query.type} tu ${query.dateFrom} den ${query.dateTo}`);
  }

  @Get('vas-report/export')
  @Roles(
    UserRole.CEO,
    UserRole.CFO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.DIRECTOR_OPERATIONS,
  )
  @ApiOperation({
    summary: 'Xuat bao cao tai chinh VAS ra file Excel',
    description:
      'Tao file Excel bao cao VAS (B01/B02/B03) theo chuan ke toan Viet Nam. ' +
      'Format so VND, header cong ty, style bold/border/mau sac. ' +
      'Tra ve file .xlsx de tai ve truc tiep.',
  })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({ status: 200, description: 'File Excel duoc tao thanh cong' })
  @ApiResponse({ status: 400, description: 'Tham so khong hop le' })
  async exportVasReportExcel(@Query() query: VasReportQueryDto, @Res() res: Response) {
    const report = await this.vasReportService.generateReport(query);
    const buffer = await this.vasExcelExportService.exportToExcel(report);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `BaoCao_${query.type}_${query.dateFrom}_${query.dateTo}_${dateStr}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
