import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, EmployeeStatus, Branch } from '@prisma/client';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { DeactivateEmployeeDto } from './dto/deactivate-employee.dto';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new employee record with auto-generated code EMP-XXXX.
   */
  async createEmployee(dto: CreateEmployeeDto) {
    // Validate manager exists if provided
    if (dto.managerId) {
      const manager = await this.prisma.employee.findUnique({
        where: { id: dto.managerId },
      });
      if (!manager) {
        throw new NotFoundException(`Manager with ID ${dto.managerId} not found`);
      }
    }

    const code = await this.generateEmployeeCode();

    const employee = await this.prisma.employee.create({
      data: {
        code,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        departmentCode: dto.departmentCode,
        positionTitle: dto.positionTitle,
        branch: dto.branch,
        managerId: dto.managerId,
        joinDate: new Date(dto.joinDate),
        salary: dto.salary,
        bankAccount: dto.bankAccount,
        bankName: dto.bankName,
        taxCode: dto.taxCode,
        insuranceId: dto.insuranceId,
        userId: dto.userId,
        status: EmployeeStatus.ACTIVE,
      },
      include: {
        manager: { select: { id: true, code: true, fullName: true } },
      },
    });

    this.eventEmitter.emit('employee.created', {
      employeeId: employee.id,
      code: employee.code,
      fullName: employee.fullName,
    });

    this.logger.log(`Employee ${code} created`);
    return employee;
  }

  /**
   * Updates an existing employee record.
   */
  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    if (dto.managerId) {
      const manager = await this.prisma.employee.findUnique({
        where: { id: dto.managerId },
      });
      if (!manager) {
        throw new NotFoundException(`Manager with ID ${dto.managerId} not found`);
      }
      if (dto.managerId === id) {
        throw new BadRequestException('Employee cannot be their own manager');
      }
    }

    const updateData: Prisma.EmployeeUpdateInput = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.departmentCode !== undefined) updateData.departmentCode = dto.departmentCode;
    if (dto.positionTitle !== undefined) updateData.positionTitle = dto.positionTitle;
    if (dto.branch !== undefined) updateData.branch = dto.branch;
    if (dto.managerId !== undefined) {
      updateData.manager = { connect: { id: dto.managerId } };
    }
    if (dto.joinDate !== undefined) updateData.joinDate = new Date(dto.joinDate);
    if (dto.salary !== undefined) updateData.salary = dto.salary;
    if (dto.bankAccount !== undefined) updateData.bankAccount = dto.bankAccount;
    if (dto.bankName !== undefined) updateData.bankName = dto.bankName;
    if (dto.taxCode !== undefined) updateData.taxCode = dto.taxCode;
    if (dto.insuranceId !== undefined) updateData.insuranceId = dto.insuranceId;
    if (dto.userId !== undefined) {
      updateData.user = { connect: { id: dto.userId } };
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        manager: { select: { id: true, code: true, fullName: true } },
      },
    });

    this.logger.log(`Employee ${employee.code} updated`);
    return updated;
  }

  /**
   * Lists employees with pagination and filters.
   */
  async findAll(query: EmployeeQueryDto) {
    const where: Prisma.EmployeeWhereInput = {};

    if (query.departmentCode) {
      where.departmentCode = query.departmentCode;
    }
    if (query.branch) {
      where.branch = query.branch;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy as Prisma.EmployeeOrderByWithRelationInput,
        include: {
          manager: { select: { id: true, code: true, fullName: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets a single employee by ID with manager info.
   */
  async findById(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, code: true, fullName: true } },
        subordinates: { select: { id: true, code: true, fullName: true, positionTitle: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  /**
   * Gets employees by department code (team view).
   */
  async getByDepartment(deptCode: string) {
    return this.prisma.employee.findMany({
      where: { departmentCode: deptCode, status: EmployeeStatus.ACTIVE },
      include: {
        manager: { select: { id: true, code: true, fullName: true } },
      },
      orderBy: { fullName: 'asc' },
      take: 500,
    });
  }

  /**
   * Deactivates an employee (sets INACTIVE or RESIGNED).
   */
  async deactivate(id: string, dto: DeactivateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException(
        `Employee ${employee.code} is already ${employee.status}`,
      );
    }

    const targetStatus = dto.status || EmployeeStatus.RESIGNED;
    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        status: targetStatus,
      },
    });

    this.eventEmitter.emit('employee.deactivated', {
      employeeId: id,
      code: employee.code,
      status: targetStatus,
      reason: dto.reason,
      effectiveDate,
    });

    this.logger.log(
      `Employee ${employee.code} deactivated: ${targetStatus} - ${dto.reason}`,
    );

    return updated;
  }

  /**
   * Gets headcount grouped by department and optionally filtered by branch.
   */
  async getHeadcount(branch?: Branch) {
    const where: Prisma.EmployeeWhereInput = {
      status: EmployeeStatus.ACTIVE,
    };
    if (branch) {
      where.branch = branch;
    }

    const result = await this.prisma.employee.groupBy({
      by: ['departmentCode', 'branch'],
      where,
      _count: { id: true },
    });

    const total = result.reduce((sum, r) => sum + r._count.id, 0);

    return {
      total,
      byDepartment: result.map((r) => ({
        departmentCode: r.departmentCode,
        branch: r.branch,
        count: r._count.id,
      })),
    };
  }

  /**
   * Generates the next employee code in format EMP-XXXX.
   */
  private async generateEmployeeCode(): Promise<string> {
    const latest = await this.prisma.employee.findFirst({
      where: { code: { startsWith: 'EMP-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.replace('EMP-', ''), 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `EMP-${String(sequence).padStart(4, '0')}`;
  }
}
