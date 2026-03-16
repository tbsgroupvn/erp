import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer, CustomerTier, UserRole } from '@prisma/client';
import { CrmRepository } from './crm.repository';
import { CustomerTierService } from './domain/customer-tier.service';
import { WalletService } from './domain/wallet.service';
import { DataScopeService } from '@core/rbac/data-scope.service';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { PaginatedResponse } from '@common/dto/base-response.dto';

/** Roles that auto-assign saleId to themselves when creating customers. */
const SALE_ROLES: UserRole[] = [UserRole.SALE, UserRole.SALES_LEADER];

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly crmRepository: CrmRepository,
    private readonly customerTierService: CustomerTierService,
    private readonly walletService: WalletService,
    private readonly dataScopeService: DataScopeService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Create a new customer with auto-generated code and initial wallet.
   * Auto-assigns saleId from the creator when the creator has a SALE role.
   */
  async createCustomer(dto: CreateCustomerDto, user?: ICurrentUser): Promise<Customer> {
    const code = await this.crmRepository.generateCode();

    // Auto-assign saleId: if not explicitly set and creator is a SALE role, use their ID
    const saleId = dto.saleId ?? (user && SALE_ROLES.includes(user.role) ? user.id : undefined);

    const customer = await this.crmRepository.create({
      code,
      fullName: dto.fullName,
      companyName: dto.companyName,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      taxCode: dto.taxCode,
      branch: dto.branch,
      saleId,
      note: dto.note,
      tier: CustomerTier.NEW,
      depositRate: this.customerTierService.getDepositRate(CustomerTier.NEW),
      creditLimit: this.customerTierService.getCreditLimit(CustomerTier.NEW),
    });

    // Create a wallet for the customer
    await this.walletService.getOrCreateWallet(customer.id);

    this.eventEmitter.emit('customer.created', { customer });
    this.logger.log(`Customer created: ${customer.code}`);

    // Re-fetch to include wallet in response
    return this.crmRepository.findById(customer.id) as Promise<Customer>;
  }

  /**
   * Create a new customer quickly from order form.
   * Checks for duplicate phone numbers.
   */
  async createQuickCustomer(dto: any, user?: ICurrentUser): Promise<Customer> {
    const code = await this.crmRepository.generateCode();

    // Check if phone already exists
    const existing = await this.crmRepository.findByPhone(dto.phone);
    if (existing) {
      throw new BadRequestException(`Khách hàng với số điện thoại ${dto.phone} đã tồn tại trong hệ thống.`);
    }

    // Auto-assign saleId: from creator if they are SALE
    const saleId = user && SALE_ROLES.includes(user.role) ? user.id : undefined;

    const customer = await this.crmRepository.create({
      code,
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email,
      note: `Source: ${dto.source || 'QUICK_ADD'}`,
      tier: CustomerTier.NEW,
      depositRate: this.customerTierService.getDepositRate(CustomerTier.NEW),
      creditLimit: this.customerTierService.getCreditLimit(CustomerTier.NEW),
      saleId,
      isActive: true,
    } as any);

    // Create a wallet for the customer
    await this.walletService.getOrCreateWallet(customer.id);

    this.eventEmitter.emit('customer.created', { customer });
    this.logger.log(`Quick customer created: ${customer.code}`);

    return this.crmRepository.findById(customer.id) as Promise<Customer>;
  }

  /**
   * Update an existing customer.
   */
  async updateCustomer(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const existing = await this.crmRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};

    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.companyName !== undefined) updateData.companyName = dto.companyName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.taxCode !== undefined) updateData.taxCode = dto.taxCode;
    if (dto.branch !== undefined) updateData.branch = dto.branch;
    if (dto.saleId !== undefined) updateData.saleId = dto.saleId;
    if (dto.note !== undefined) updateData.note = dto.note;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Only allow manual tier override for STRATEGIC
    if (dto.tier !== undefined) {
      if (dto.tier === CustomerTier.STRATEGIC) {
        updateData.tier = CustomerTier.STRATEGIC;
        updateData.depositRate = this.customerTierService.getDepositRate(CustomerTier.STRATEGIC);
        updateData.creditLimit = this.customerTierService.getCreditLimit(CustomerTier.STRATEGIC);
      } else {
        throw new BadRequestException(
          'Only STRATEGIC tier can be set manually. Other tiers are auto-calculated.',
        );
      }
    }

    const updated = await this.crmRepository.update(id, updateData);

    this.eventEmitter.emit('customer.updated', {
      customer: updated,
      changes: dto,
    });

    return updated;
  }

  /**
   * Get a single customer by ID with data-scope enforcement.
   */
  async getCustomer(id: string, user?: ICurrentUser): Promise<Customer> {
    const customer = await this.crmRepository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    // Enforce data scope: verify the caller has access to this customer
    if (user) {
      const scopeFilter = await this.dataScopeService.getDataScopeFilter(
        { userId: user.id, role: user.role, branch: user.branch },
        'customer',
      );
      if (Object.keys(scopeFilter).length > 0) {
        const accessible = await this.crmRepository.findByIdWithScope(id, scopeFilter);
        if (!accessible) {
          throw new ForbiddenException('You do not have access to this customer');
        }
      }
    }

    return customer;
  }

  /**
   * List customers with pagination, filters, and data-scope enforcement.
   */
  async listCustomers(query: CustomerQueryDto, user?: ICurrentUser): Promise<PaginatedResponse<Customer>> {
    let scopeFilter = {};
    if (user) {
      scopeFilter = await this.dataScopeService.getDataScopeFilter(
        { userId: user.id, role: user.role, branch: user.branch },
        'customer',
      );
    }
    const { data, total } = await this.crmRepository.findMany(query, scopeFilter);
    return PaginatedResponse.paginate(data, total, query.page, query.limit);
  }

  /**
   * Re-evaluate and auto-update a customer's tier based on order stats.
   * Called after order.completed events.
   */
  async updateTier(customerId: string): Promise<Customer> {
    const customer = await this.crmRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const evaluation = this.customerTierService.evaluateTier({
      tier: customer.tier,
      totalOrders: customer.totalOrders,
      totalRevenue: customer.totalRevenue,
    });

    if (evaluation.shouldUpgrade) {
      const updated = await this.crmRepository.updateTier(
        customerId,
        evaluation.recommendedTier,
        evaluation.depositRate,
        evaluation.creditLimit,
      );

      this.eventEmitter.emit('customer.tier.changed', {
        customerId,
        previousTier: evaluation.currentTier,
        newTier: evaluation.recommendedTier,
      });

      this.logger.log(
        `Customer ${customerId} tier upgraded: ${evaluation.currentTier} -> ${evaluation.recommendedTier}`,
      );

      return updated;
    }

    return customer;
  }

  /**
   * Get wallet balance for a customer.
   */
  async getWalletBalance(customerId: string) {
    const customer = await this.crmRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
    return this.walletService.getBalance(customerId);
  }

  /**
   * Top up a customer's wallet.
   */
  async topupWallet(customerId: string, amount: number, reference?: string, note?: string, bankTraceId?: string) {
    const customer = await this.crmRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    if (!bankTraceId) {
      throw new BadRequestException('Ma giao dich ngan hang (Bank Trace ID) la bat buoc khi nap vi');
    }

    const result = await this.walletService.topup(customerId, amount, reference, note, bankTraceId);

    this.eventEmitter.emit('wallet.topup', {
      customerId,
      amount,
      newBalance: result.wallet.balance.toNumber(),
      transactionId: result.transaction.id,
    });

    return result;
  }

  /**
   * Deduct from a customer's wallet.
   */
  async deductWallet(customerId: string, amount: number, reference?: string, note?: string) {
    return this.walletService.deduct(customerId, amount, reference, note);
  }
}
