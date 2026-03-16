import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateExpenseDto, CreateExpenseItemDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Code generation
  // ---------------------------------------------------------------------------

  private async generateCode(): Promise<string> {
    const count = await this.prisma.expenseClaim.count();
    const seq = String(count + 1).padStart(4, '0');
    return `EXP-${seq}`;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(employeeId: string, dto: CreateExpenseDto) {
    const code = await this.generateCode();
    const items = dto.items ?? [];

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    const claim = await this.prisma.expenseClaim.create({
      data: {
        code,
        employeeId,
        title: dto.title,
        description: dto.description,
        currency: dto.currency ?? 'VND',
        totalAmount,
        status: 'DRAFT',
        items: {
          create: items.map((item) => ({
            category: item.category,
            description: item.description,
            amount: item.amount,
            date: new Date(item.date),
            receiptUrl: item.receiptUrl,
          })),
        },
      },
      include: { items: true },
    });

    this.logger.log(`Expense claim created: ${code} by employee ${employeeId}`);
    return claim;
  }

  // ---------------------------------------------------------------------------
  // List (admin / finance)
  // ---------------------------------------------------------------------------

  async findAll(query: ExpenseQueryDto) {
    const { page, limit, status, employeeId, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseClaimWhereInput = {
      ...(status && { status }),
      ...(employeeId && { employeeId }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo + 'T23:59:59.999Z') }),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.expenseClaim.count({ where }),
      this.prisma.expenseClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // My expenses
  // ---------------------------------------------------------------------------

  async findMyExpenses(employeeId: string, query: ExpenseQueryDto) {
    query.employeeId = employeeId;
    return this.findAll(query);
  }

  // ---------------------------------------------------------------------------
  // Find by ID
  // ---------------------------------------------------------------------------

  async findById(id: string) {
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!claim) {
      throw new NotFoundException(`Đề nghị chi phí ${id} không tồn tại`);
    }

    return claim;
  }

  // ---------------------------------------------------------------------------
  // Update (DRAFT only)
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateExpenseDto, requesterId: string) {
    const claim = await this.findById(id);

    if (claim.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể chỉnh sửa đề nghị ở trạng thái Nháp');
    }

    if (claim.employeeId !== requesterId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đề nghị này');
    }

    return this.prisma.expenseClaim.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
      include: { items: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Submit (DRAFT → SUBMITTED)
  // ---------------------------------------------------------------------------

  async submit(id: string, requesterId: string) {
    const claim = await this.findById(id);

    if (claim.employeeId !== requesterId) {
      throw new ForbiddenException('Bạn không có quyền gửi đề nghị này');
    }

    if (claim.status !== 'DRAFT') {
      throw new BadRequestException(`Không thể gửi đề nghị ở trạng thái ${claim.status}`);
    }

    if (claim.items.length === 0) {
      throw new BadRequestException('Đề nghị phải có ít nhất một khoản chi trước khi gửi');
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: { items: true },
    });

    this.logger.log(`Expense claim ${claim.code} submitted by ${requesterId}`);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Approve (SUBMITTED → APPROVED)
  // ---------------------------------------------------------------------------

  async approve(id: string, approverId: string) {
    const claim = await this.findById(id);

    if (claim.status !== 'SUBMITTED') {
      throw new BadRequestException(`Không thể duyệt đề nghị ở trạng thái ${claim.status}`);
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
      include: { items: true },
    });

    this.logger.log(`Expense claim ${claim.code} approved by ${approverId}`);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Reject (SUBMITTED → REJECTED)
  // ---------------------------------------------------------------------------

  async reject(id: string, approverId: string, reason: string) {
    const claim = await this.findById(id);

    if (claim.status !== 'SUBMITTED') {
      throw new BadRequestException(`Không thể từ chối đề nghị ở trạng thái ${claim.status}`);
    }

    if (!reason || !reason.trim()) {
      throw new BadRequestException('Phải cung cấp lý do từ chối');
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        rejectionReason: reason.trim(),
      },
      include: { items: true },
    });

    this.logger.log(`Expense claim ${claim.code} rejected by ${approverId}. Reason: ${reason}`);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Mark Paid (APPROVED → PAID)
  // ---------------------------------------------------------------------------

  async markPaid(id: string) {
    const claim = await this.findById(id);

    if (claim.status !== 'APPROVED') {
      throw new BadRequestException(`Không thể đánh dấu đã chi ở trạng thái ${claim.status}`);
    }

    const updated = await this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: { items: true },
    });

    this.logger.log(`Expense claim ${claim.code} marked as PAID`);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Add item (DRAFT only)
  // ---------------------------------------------------------------------------

  async addItem(claimId: string, dto: CreateExpenseItemDto, requesterId: string) {
    const claim = await this.findById(claimId);

    if (claim.employeeId !== requesterId) {
      throw new ForbiddenException('Bạn không có quyền thêm khoản chi vào đề nghị này');
    }

    if (claim.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể thêm khoản chi khi đề nghị ở trạng thái Nháp');
    }

    const newItem = await this.prisma.expenseItem.create({
      data: {
        expenseClaimId: claimId,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        date: new Date(dto.date),
        receiptUrl: dto.receiptUrl,
      },
    });

    // Recalculate total
    const allItems = await this.prisma.expenseItem.findMany({
      where: { expenseClaimId: claimId },
    });
    const newTotal = allItems.reduce((sum, i) => sum + Number(i.amount), 0);

    await this.prisma.expenseClaim.update({
      where: { id: claimId },
      data: { totalAmount: newTotal },
    });

    return newItem;
  }

  // ---------------------------------------------------------------------------
  // Remove item (DRAFT only)
  // ---------------------------------------------------------------------------

  async removeItem(itemId: string, requesterId: string) {
    const item = await this.prisma.expenseItem.findUnique({
      where: { id: itemId },
      include: { expenseClaim: true },
    });

    if (!item) {
      throw new NotFoundException(`Khoản chi ${itemId} không tồn tại`);
    }

    if (item.expenseClaim.employeeId !== requesterId) {
      throw new ForbiddenException('Bạn không có quyền xóa khoản chi này');
    }

    if (item.expenseClaim.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xóa khoản chi khi đề nghị ở trạng thái Nháp');
    }

    await this.prisma.expenseItem.delete({ where: { id: itemId } });

    // Recalculate total
    const remaining = await this.prisma.expenseItem.findMany({
      where: { expenseClaimId: item.expenseClaimId },
    });
    const newTotal = remaining.reduce((sum, i) => sum + Number(i.amount), 0);

    await this.prisma.expenseClaim.update({
      where: { id: item.expenseClaimId },
      data: { totalAmount: newTotal },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  async getStats(employeeId?: string) {
    const where: Prisma.ExpenseClaimWhereInput = employeeId ? { employeeId } : {};

    const [draft, submitted, approved, rejected, paid] = await Promise.all([
      this.prisma.expenseClaim.aggregate({
        where: { ...where, status: 'DRAFT' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { ...where, status: 'SUBMITTED' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { ...where, status: 'APPROVED' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { ...where, status: 'REJECTED' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { ...where, status: 'PAID' },
        _count: true,
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      draft: {
        count: draft._count,
        totalAmount: Number(draft._sum.totalAmount ?? 0),
      },
      submitted: {
        count: submitted._count,
        totalAmount: Number(submitted._sum.totalAmount ?? 0),
      },
      approved: {
        count: approved._count,
        totalAmount: Number(approved._sum.totalAmount ?? 0),
      },
      rejected: {
        count: rejected._count,
        totalAmount: Number(rejected._sum.totalAmount ?? 0),
      },
      paid: {
        count: paid._count,
        totalAmount: Number(paid._sum.totalAmount ?? 0),
      },
    };
  }
}
