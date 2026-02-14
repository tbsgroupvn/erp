import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer, CustomerTier } from '@prisma/client';
import { CrmRepository } from './crm.repository';
import { CustomerTierService } from './domain/customer-tier.service';
import { WalletService } from './domain/wallet.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { PaginatedResponse } from '@common/dto/base-response.dto';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly crmRepository: CrmRepository,
    private readonly customerTierService: CustomerTierService,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new customer with auto-generated code and initial wallet.
   */
  async createCustomer(dto: CreateCustomerDto): Promise<Customer> {
    const code = await this.crmRepository.generateCode();

    const customer = await this.crmRepository.create({
      code,
      fullName: dto.fullName,
      companyName: dto.companyName,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      taxCode: dto.taxCode,
      branch: dto.branch,
      saleId: dto.saleId,
      note: dto.note,
      tier: CustomerTier.NEW,
      depositRate: this.customerTierService.getDepositRate(CustomerTier.NEW),
      creditLimit: this.customerTierService.getCreditLimit(CustomerTier.NEW),
    });

    // Create a wallet for the customer
    await this.walletService.getOrCreateWallet(customer.id);

    this.eventEmitter.emit('customer.created', { customer });
    this.logger.log(`Customer created: ${customer.code}`);

    return customer;
  }

  /**
   * Update an existing customer.
   */
  async updateCustomer(
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
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
        updateData.depositRate = this.customerTierService.getDepositRate(
          CustomerTier.STRATEGIC,
        );
        updateData.creditLimit = this.customerTierService.getCreditLimit(
          CustomerTier.STRATEGIC,
        );
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
   * Get a single customer by ID.
   */
  async getCustomer(id: string): Promise<Customer> {
    const customer = await this.crmRepository.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  /**
   * List customers with pagination and filters.
   */
  async listCustomers(
    query: CustomerQueryDto,
  ): Promise<PaginatedResponse<Customer>> {
    const { data, total } = await this.crmRepository.findMany(query);
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
  async topupWallet(
    customerId: string,
    amount: number,
    reference?: string,
    note?: string,
  ) {
    const customer = await this.crmRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const result = await this.walletService.topup(
      customerId,
      amount,
      reference,
      note,
    );

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
  async deductWallet(
    customerId: string,
    amount: number,
    reference?: string,
    note?: string,
  ) {
    return this.walletService.deduct(customerId, amount, reference, note);
  }
}
