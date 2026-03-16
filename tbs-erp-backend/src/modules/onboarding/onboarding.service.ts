import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

export type ChecklistType = 'ONBOARDING' | 'OFFBOARDING';

export interface ChecklistItem {
  task: string;
  completed: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
}

const DEFAULT_ONBOARDING_ITEMS: ChecklistItem[] = [
  { task: 'Tạo tài khoản email', completed: false },
  { task: 'Cấp thẻ ra vào', completed: false },
  { task: 'Cài đặt máy tính làm việc', completed: false },
  { task: 'Giới thiệu phòng ban', completed: false },
  { task: 'Hướng dẫn quy trình nội bộ', completed: false },
  { task: 'Ký hợp đồng lao động', completed: false },
  { task: 'Đăng ký bảo hiểm', completed: false },
  { task: 'Đào tạo an toàn lao động', completed: false },
];

const DEFAULT_OFFBOARDING_ITEMS: ChecklistItem[] = [
  { task: 'Thu hồi thẻ ra vào', completed: false },
  { task: 'Thu hồi thiết bị công ty', completed: false },
  { task: 'Bàn giao công việc', completed: false },
  { task: 'Tất toán lương và phép', completed: false },
  { task: 'Vô hiệu hóa tài khoản', completed: false },
  { task: 'Phỏng vấn thôi việc', completed: false },
];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new checklist for an employee.
   * Seeds default items based on type.
   */
  async create(employeeId: string, type: ChecklistType, createdBy: string) {
    // Validate employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, fullName: true },
    });
    if (!employee) {
      throw new NotFoundException(`Không tìm thấy nhân viên với ID ${employeeId}`);
    }

    const items =
      type === 'ONBOARDING'
        ? DEFAULT_ONBOARDING_ITEMS
        : DEFAULT_OFFBOARDING_ITEMS;

    const checklist = await this.prisma.onboardingChecklist.create({
      data: {
        employeeId,
        type,
        items: items as unknown as any,
        createdBy,
      },
      include: {
        employee: {
          select: { id: true, code: true, fullName: true, positionTitle: true, departmentCode: true },
        },
      },
    });

    this.logger.log(
      `Checklist ${type} created for employee ${employeeId} by ${createdBy}`,
    );
    return checklist;
  }

  /**
   * Get all checklists for an employee.
   */
  async findByEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException(`Không tìm thấy nhân viên với ID ${employeeId}`);
    }

    return this.prisma.onboardingChecklist.findMany({
      where: { employeeId },
      include: {
        employee: {
          select: { id: true, code: true, fullName: true, positionTitle: true, departmentCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single checklist by ID.
   */
  async findById(id: string) {
    const checklist = await this.prisma.onboardingChecklist.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, code: true, fullName: true, positionTitle: true, departmentCode: true },
        },
      },
    });
    if (!checklist) {
      throw new NotFoundException(`Không tìm thấy checklist với ID ${id}`);
    }
    return checklist;
  }

  /**
   * Get all checklists with optional filters.
   */
  async findAll(params: {
    type?: string;
    completed?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { type, completed, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (completed === true) where.completedAt = { not: null };
    if (completed === false) where.completedAt = null;

    const [data, total] = await Promise.all([
      this.prisma.onboardingChecklist.findMany({
        where,
        include: {
          employee: {
            select: { id: true, code: true, fullName: true, positionTitle: true, departmentCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.onboardingChecklist.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Toggle the completed state of a single item by index.
   */
  async toggleItem(id: string, itemIndex: number, userId: string) {
    const checklist = await this.findById(id);

    if (checklist.completedAt) {
      throw new BadRequestException('Checklist đã hoàn thành, không thể chỉnh sửa');
    }

    const items = checklist.items as unknown as ChecklistItem[];

    if (itemIndex < 0 || itemIndex >= items.length) {
      throw new BadRequestException(`Chỉ số mục không hợp lệ: ${itemIndex}`);
    }

    const item = items[itemIndex];
    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date().toISOString() : null;
    item.completedBy = item.completed ? userId : null;

    const updated = await this.prisma.onboardingChecklist.update({
      where: { id },
      data: { items: items as unknown as any },
      include: {
        employee: {
          select: { id: true, code: true, fullName: true, positionTitle: true, departmentCode: true },
        },
      },
    });

    this.logger.log(
      `Checklist ${id} item[${itemIndex}] toggled to ${item.completed} by ${userId}`,
    );
    return updated;
  }

  /**
   * Mark the entire checklist as complete.
   */
  async markComplete(id: string) {
    const checklist = await this.findById(id);

    if (checklist.completedAt) {
      throw new BadRequestException('Checklist đã được đánh dấu hoàn thành trước đó');
    }

    const updated = await this.prisma.onboardingChecklist.update({
      where: { id },
      data: { completedAt: new Date() },
      include: {
        employee: {
          select: { id: true, code: true, fullName: true, positionTitle: true, departmentCode: true },
        },
      },
    });

    this.logger.log(`Checklist ${id} marked complete`);
    return updated;
  }
}
