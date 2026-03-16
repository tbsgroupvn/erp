import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { AccountsPayableRepository } from './accounts-payable.repository';
import { CreateApDto } from './dto/create-ap.dto';
import { ApQueryDto } from './dto/ap-query.dto';
import { PaginatedResponse } from '@common/dto/base-response.dto';

@Injectable()
export class AccountsPayableService {
  private readonly logger = new Logger(AccountsPayableService.name);

  constructor(
    private readonly apRepository: AccountsPayableRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new accounts payable record.
   */
  async createPayable(dto: CreateApDto, createdBy: string) {
    const code = await this.apRepository.generateCode();

    const createData: any = {
      code,
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency ?? 'VND',
      dueDate: new Date(dto.dueDate),
      note: dto.note,
      createdBy,
    };

    // Use vendor relation if vendorId is provided
    if (dto.vendorId) {
      createData.vendor = { connect: { id: dto.vendorId } };
    }

    const ap = await this.apRepository.create(createData);

    this.eventEmitter.emit('ap.created', {
      apId: ap.id,
      vendorId: dto.vendorId,
      amount: dto.amount,
    });

    const vendorLabel = dto.vendorName ?? dto.vendorId ?? 'unknown';
    this.logger.log(`AP created: ${code}, vendor=${vendorLabel}, amount=${dto.amount}`);
    return ap;
  }

  /**
   * Record a payment against an accounts payable.
   */
  async recordPayment(apId: string, amount: number, reference?: string, note?: string) {
    const ap = await this.apRepository.findById(apId);
    if (!ap) {
      throw new NotFoundException(`AP record ${apId} not found`);
    }

    if (ap.status === 'PAID' || ap.status === 'NETTED') {
      throw new BadRequestException(
        `AP ${ap.code} is already ${ap.status}. Cannot record more payments.`,
      );
    }

    const outstanding = ap.amount.toNumber() - (ap.paidAmount?.toNumber() ?? 0);

    if (amount > outstanding) {
      throw new BadRequestException(
        `Payment amount (${amount}) exceeds outstanding balance (${outstanding})`,
      );
    }

    const newPaidAmount = (ap.paidAmount?.toNumber() ?? 0) + amount;
    const isFullyPaid = newPaidAmount >= ap.amount.toNumber();

    const updated = await this.apRepository.update(apId, {
      paidAmount: new Prisma.Decimal(newPaidAmount),
      status: isFullyPaid ? 'PAID' : 'PARTIAL',
      note: note ? `${ap.note ?? ''}\n[Payment] ${amount} - ${note}` : ap.note,
    });

    this.eventEmitter.emit('ap.payment.recorded', {
      apId: ap.id,
      vendorId: ap.vendorId,
      paymentAmount: amount,
      isFullyPaid,
      reference,
    });

    this.logger.log(`AP payment recorded: ${ap.code}, amount=${amount}, status=${updated.status}`);

    return updated;
  }

  /**
   * List AP records with pagination and filters.
   */
  async findAll(query: ApQueryDto) {
    const { data, total } = await this.apRepository.findMany(query);
    return PaginatedResponse.paginate(data, total, query.page, query.limit);
  }

  /**
   * Get all payables for a specific vendor.
   */
  async getVendorPayables(vendorId: string) {
    return this.apRepository.findByVendor(vendorId);
  }

  /**
   * Get AP summary (total open, overdue, count).
   */
  async getSummary() {
    return this.apRepository.getSummary();
  }

  /**
   * Get a single AP record by ID.
   */
  async findById(id: string) {
    const ap = await this.apRepository.findById(id);
    if (!ap) {
      throw new NotFoundException(`AP record ${id} not found`);
    }
    return ap;
  }
}
