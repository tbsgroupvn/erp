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
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { PayrollService } from './payroll.service';
import { PayrollQueryDto, CalculatePayrollDto, ApprovePayrollDto } from './dto/payroll-query.dto';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate payroll for a month' })
  @ApiResponse({ status: 200, description: 'Payroll calculated successfully' })
  async calculatePayroll(@Body() dto: CalculatePayrollDto) {
    const result = await this.payrollService.calculatePayroll(dto.month, dto.year);
    return BaseResponse.ok(result, 'Payroll calculated successfully');
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve payroll for a month' })
  @ApiResponse({ status: 200, description: 'Payroll approved successfully' })
  async approvePayroll(
    @Body() dto: ApprovePayrollDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.payrollService.approvePayroll(dto.month, dto.year, user.id);
    return BaseResponse.ok(result, 'Payroll approved successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List payroll records' })
  @ApiResponse({ status: 200, description: 'Payroll records retrieved successfully' })
  async findAll(@Query() query: PayrollQueryDto) {
    const result = await this.payrollService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get payroll summary for a month' })
  @ApiQuery({ name: 'month', required: true, example: 6 })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  async getPayrollSummary(
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    const result = await this.payrollService.getPayrollSummary(+month, +year);
    return BaseResponse.ok(result);
  }

  @Get(':employeeId/payslip')
  @ApiOperation({ summary: 'Get individual payslip' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID' })
  @ApiQuery({ name: 'month', required: true, example: 6 })
  @ApiQuery({ name: 'year', required: true, example: 2025 })
  async getPayslip(
    @Param('employeeId') employeeId: string,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    const result = await this.payrollService.getPayslip(employeeId, +month, +year);
    return BaseResponse.ok(result);
  }
}
