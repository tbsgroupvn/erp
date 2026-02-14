import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
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
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { GeneralLedgerService } from './general-ledger.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';

@ApiTags('General Ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('general-ledger')
export class GeneralLedgerController {
  constructor(private readonly glService: GeneralLedgerService) {}

  @Post('journal-entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a journal entry', description: 'Creates a double-entry journal entry. Total debits must equal total credits.' })
  @ApiResponse({ status: 201, description: 'Journal entry created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or unbalanced entry' })
  async createJournalEntry(
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const entry = await this.glService.createJournalEntry(dto, user.id);
    return BaseResponse.ok(entry, 'Journal entry created successfully');
  }

  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries', description: 'Returns paginated journal entries with optional filters.' })
  @ApiResponse({ status: 200, description: 'Journal entries retrieved successfully' })
  async findAll(@Query() query: GeneralLedgerQueryDto) {
    const result = await this.glService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get trial balance', description: 'Computes trial balance summing debits and credits per account as of a date.' })
  @ApiQuery({ name: 'asOfDate', required: true, example: '2025-12-31' })
  @ApiResponse({ status: 200, description: 'Trial balance retrieved' })
  async getTrialBalance(@Query('asOfDate') asOfDate: string) {
    const result = await this.glService.getTrialBalance(asOfDate);
    return BaseResponse.ok(result);
  }

  @Get('accounts/:accountCode/balance')
  @ApiOperation({ summary: 'Get account balance', description: 'Returns running balance for a specific account within an optional date range.' })
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
  @ApiOperation({ summary: 'Close accounting period', description: 'Closes an accounting period preventing further journal entries.' })
  @ApiResponse({ status: 200, description: 'Period closed successfully' })
  @ApiResponse({ status: 400, description: 'Period already closed' })
  async closePeriod(
    @Body('year') year: number,
    @Body('month') month: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.glService.closePeriod(year, month, user.id);
    return BaseResponse.ok(result, `Period ${year}-${String(month).padStart(2, '0')} closed successfully`);
  }

  @Get('chart-of-accounts')
  @ApiOperation({ summary: 'Get chart of accounts', description: 'Lists all accounts with hierarchy.' })
  @ApiResponse({ status: 200, description: 'Chart of accounts retrieved' })
  async getChartOfAccounts() {
    const accounts = await this.glService.getChartOfAccounts();
    return BaseResponse.ok(accounts);
  }
}
