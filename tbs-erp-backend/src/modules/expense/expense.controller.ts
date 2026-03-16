import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/rbac/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto, CreateExpenseItemDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';

/** Roles allowed to approve / reject expense claims */
const APPROVER_ROLES = [
  UserRole.HR_MANAGER,
  UserRole.CEO,
  UserRole.COO,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.CFO,
  UserRole.DIRECTOR_OPERATIONS,
];

/** Roles allowed to mark expenses as paid */
const PAYMENT_ROLES = [
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.CFO,
];

/** Roles allowed to view all expense claims */
const VIEWER_ROLES: UserRole[] = [
  UserRole.HR_MANAGER,
  UserRole.CEO,
  UserRole.COO,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.CFO,
  UserRole.DIRECTOR_OPERATIONS,
  UserRole.ACCOUNTANT,
];

@ApiTags('Expense Claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  @Post()
  @ApiOperation({ summary: 'Tạo đề nghị thanh toán chi phí' })
  @ApiResponse({ status: 201, description: 'Đề nghị được tạo thành công' })
  async create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const claim = await this.expenseService.create(user.id, dto);
    return BaseResponse.ok(claim, 'Tạo đề nghị chi phí thành công');
  }

  // ---------------------------------------------------------------------------
  // List (admin / finance view)
  // ---------------------------------------------------------------------------

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...VIEWER_ROLES)
  @ApiOperation({ summary: 'Danh sách tất cả đề nghị (HR/Tài chính)' })
  async findAll(@Query() query: ExpenseQueryDto) {
    const result = await this.expenseService.findAll(query);
    return BaseResponse.ok(result);
  }

  // ---------------------------------------------------------------------------
  // My expenses
  // ---------------------------------------------------------------------------

  @Get('my')
  @ApiOperation({ summary: 'Đề nghị chi phí của tôi' })
  async findMyExpenses(
    @Query() query: ExpenseQueryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.expenseService.findMyExpenses(user.id, query);
    return BaseResponse.ok(result);
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê đề nghị chi phí' })
  async getStats(@CurrentUser() user: ICurrentUser) {
    // Finance/HR roles see all stats; others see only their own
    const isManager = VIEWER_ROLES.includes(user.role);
    const employeeId = isManager ? undefined : user.id;
    const stats = await this.expenseService.getStats(employeeId);
    return BaseResponse.ok(stats);
  }

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề nghị chi phí' })
  @ApiParam({ name: 'id', description: 'Expense Claim ID' })
  async findById(@Param('id') id: string) {
    const claim = await this.expenseService.findById(id);
    return BaseResponse.ok(claim);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật đề nghị (chỉ khi Nháp)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const claim = await this.expenseService.update(id, dto, user.id);
    return BaseResponse.ok(claim, 'Cập nhật đề nghị chi phí thành công');
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi đề nghị để phê duyệt (Nháp → Đã gửi)' })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const claim = await this.expenseService.submit(id, user.id);
    return BaseResponse.ok(claim, 'Gửi đề nghị chi phí thành công');
  }

  // ---------------------------------------------------------------------------
  // Approve
  // ---------------------------------------------------------------------------

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(...APPROVER_ROLES)
  @ApiOperation({ summary: 'Phê duyệt đề nghị chi phí (Đã gửi → Đã duyệt)' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const claim = await this.expenseService.approve(id, user.id);
    return BaseResponse.ok(claim, 'Phê duyệt đề nghị chi phí thành công');
  }

  // ---------------------------------------------------------------------------
  // Reject
  // ---------------------------------------------------------------------------

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(...APPROVER_ROLES)
  @ApiOperation({ summary: 'Từ chối đề nghị chi phí (Đã gửi → Từ chối)' })
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const claim = await this.expenseService.reject(id, user.id, reason);
    return BaseResponse.ok(claim, 'Đã từ chối đề nghị chi phí');
  }

  // ---------------------------------------------------------------------------
  // Mark Paid
  // ---------------------------------------------------------------------------

  @Post(':id/paid')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(...PAYMENT_ROLES)
  @ApiOperation({ summary: 'Đánh dấu đã thanh toán (Đã duyệt → Đã chi)' })
  async markPaid(@Param('id') id: string) {
    const claim = await this.expenseService.markPaid(id);
    return BaseResponse.ok(claim, 'Đã đánh dấu thanh toán cho đề nghị chi phí');
  }

  // ---------------------------------------------------------------------------
  // Add item
  // ---------------------------------------------------------------------------

  @Post(':id/items')
  @ApiOperation({ summary: 'Thêm khoản chi vào đề nghị (chỉ khi Nháp)' })
  async addItem(
    @Param('id') id: string,
    @Body() dto: CreateExpenseItemDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const item = await this.expenseService.addItem(id, dto, user.id);
    return BaseResponse.ok(item, 'Thêm khoản chi thành công');
  }

  // ---------------------------------------------------------------------------
  // Remove item
  // ---------------------------------------------------------------------------

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Xóa khoản chi (chỉ khi Nháp)' })
  async removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.expenseService.removeItem(itemId, user.id);
    return BaseResponse.ok(result, 'Xóa khoản chi thành công');
  }
}
