import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer, CustomerTier, UserRole } from '@prisma/client';
import { CrmRepository } from './crm.repository';
import { CustomerTierService } from './domain/customer-tier.service';
import { WalletService } from './domain/wallet.service';
import { DataScopeService } from '@core/rbac/data-scope.service';
import { CacheService } from '@core/cache/cache.service';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { PaginatedResponse } from '@common/dto/base-response.dto';

/** Roles that auto-assign saleId to themselves when creating customers. */
const SALE_ROLES: UserRole[] = [UserRole.SALE, UserRole.SALES_LEADER];

/** Cache TTLs in milliseconds */
const CACHE_TTL = {
  /** Customer profile: 10 minutes — changes only on explicit update */
  PROFILE: 600_000,
  /** Customer list page: 5 minutes — tolerable eventual consistency */
  LIST: 300_000,
  /** Wallet balance: 30 seconds — high-frequency write path */
  BALANCE: 30_000,
  /** Credit limit: 5 minutes — infrequent manual changes */
  CREDIT: 300_000,
  /** Tier statistics aggregation: 15 minutes — heavy query, low churn */
  TIER_STATS: 900_000,
} as const;

/**
 * Generates a stable, short MD5 hex hash from a query-params object.
 * Undefined/null/"" values are omitted so that default params produce the
 * same cache key regardless of whether they were explicitly sent.
 * Key sorting guarantees param-order independence.
 */
function hashQueryParams(params: Record<string, unknown>): string {
  const stable = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        acc[k] = params[k];
      }
      return acc;
    }, {});
  return createHash('md5').update(JSON.stringify(stable)).digest('hex').slice(0, 16);
}

/** Build canonical cache keys for the customer domain. */
export const CRM_CACHE_KEYS = {
  profile: (id: string) => `customer:profile:${id}`,
  list: (queryHash: string) => `customer:list:${queryHash}`,
  balance: (id: string) => `customer:balance:${id}`,
  credit: (id: string) => `customer:credit:${id}`,
  tierStats: () => `customer:tier-stats`,
} as const;

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly crmRepository: CrmRepository,
    private readonly customerTierService: CustomerTierService,
    private readonly walletService: WalletService,
    private readonly dataScopeService: DataScopeService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
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

    // Invalidate all list pages — a new customer renders every cached list stale.
    await this.cacheService.invalidateByPrefix('customer:list:');

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

    // Invalidate all list pages — a new customer renders every cached list stale.
    await this.cacheService.invalidateByPrefix('customer:list:');

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

    // Invalidate profile, credit, and list caches — any field change can affect them.
    await Promise.all([
      this.cacheService.invalidate(CRM_CACHE_KEYS.profile(id)),
      this.cacheService.invalidate(CRM_CACHE_KEYS.credit(id)),
      this.cacheService.invalidateByPrefix('customer:list:'),
    ]);

    return updated;
  }

  /**
   * Get a single customer by ID with data-scope enforcement.
   * Result is cached under `customer:profile:{id}` for CACHE_TTL.PROFILE ms.
   * Scope enforcement is always performed against the (possibly cached) record;
   * the cache is user-agnostic so we never cache a forbidden record — we only
   * cache the raw DB payload and re-run the scope check each time.
   */
  async getCustomer(id: string, user?: ICurrentUser): Promise<Customer> {
    // Attempt to serve the profile from cache first (scope-independent raw record).
    const profileKey = CRM_CACHE_KEYS.profile(id);
    let customer = await this.cacheService.get<Customer>(profileKey) ?? null;

    if (!customer) {
      customer = await this.crmRepository.findById(id);
      if (customer) {
        await this.cacheService.set(profileKey, customer, CACHE_TTL.PROFILE);
      }
    }

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    // Enforce data scope: verify the caller has access to this customer.
    // This check must always run — it is not cached.
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
   * Results are cached under `customer:list:{hash}` for CACHE_TTL.LIST ms.
   * The cache key incorporates both the query params and the user scope so
   * that different callers with different data-scopes never share a page.
   *
   * Cache key uses a 16-char MD5 hex hash instead of raw JSON.stringify to
   * keep Redis key lengths predictable and avoid extremely long keys when the
   * scope filter carries many predicates.
   */
  async listCustomers(query: CustomerQueryDto, user?: ICurrentUser): Promise<PaginatedResponse<Customer>> {
    let scopeFilter: Record<string, unknown> = {};
    if (user) {
      scopeFilter = await this.dataScopeService.getDataScopeFilter(
        { userId: user.id, role: user.role, branch: user.branch },
        'customer',
      );
    }

    // Build a stable, length-bounded hash that uniquely identifies this
    // query + scope combination.  Scope fields are inlined so that two users
    // with different scopes always get different cache entries.
    const cacheKey = CRM_CACHE_KEYS.list(
      hashQueryParams({ ...query, ...scopeFilter }),
    );

    const cached = await this.cacheService.get<PaginatedResponse<Customer>>(cacheKey);
    if (cached) {
      return cached;
    }

    const { data, total } = await this.crmRepository.findMany(query, scopeFilter);

    // Batch-fetch outstanding debt for all customers on this page in 2 DB
    // round-trips instead of one query per customer.
    const customerIds = data.map((c) => c.id);
    const debtMap = await this.crmRepository.getCustomerDebts(customerIds);

    // Attach debt summary to each customer object without mutating the DB
    // model type — we cast to any to stay within the existing response shape
    // (the frontend already reads these fields when present).
    const enriched = data.map((customer) => {
      const debt = debtMap.get(customer.id);
      if (!debt) return customer;
      return Object.assign(Object.create(Object.getPrototypeOf(customer)), customer, {
        outstandingDebt: debt.outstanding,
        overdueDebt: debt.overdue,
      });
    });

    const result = PaginatedResponse.paginate(enriched as Customer[], total, query.page, query.limit);

    await this.cacheService.set(cacheKey, result, CACHE_TTL.LIST);
    return result;
  }

  /**
   * Re-evaluate and auto-update a customer's tier based on order stats.
   * Called after order.completed events.
   */
  async updateTier(customerId: string): Promise<Customer> {
    // Always fetch from DB — tier evaluation must see current totalOrders/totalRevenue.
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

      // Tier change affects profile, credit limit, and the global tier-stats aggregation.
      await Promise.all([
        this.cacheService.invalidate(CRM_CACHE_KEYS.profile(customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.credit(customerId)),
        this.cacheService.invalidate(CRM_CACHE_KEYS.tierStats()),
      ]);

      return updated;
    }

    return customer;
  }

  /**
   * Get wallet balance for a customer.
   * Result is cached under `customer:balance:{id}` for CACHE_TTL.BALANCE ms
   * (30 s) because wallet balance changes with every payment operation.
   */
  async getWalletBalance(customerId: string) {
    const customer = await this.crmRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const balanceKey = CRM_CACHE_KEYS.balance(customerId);
    const cached = await this.cacheService.get<{ balance: number; currency: string; walletId: string }>(balanceKey);
    if (cached) {
      return cached;
    }

    const balance = await this.walletService.getBalance(customerId);
    await this.cacheService.set(balanceKey, balance, CACHE_TTL.BALANCE);
    return balance;
  }

  /**
   * Top up a customer's wallet.
   * Invalidates the balance cache immediately after the DB write so that the
   * next read reflects the new balance without waiting for TTL expiry.
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

    // Invalidate stale balance cache — new balance is now in the DB.
    await this.cacheService.invalidate(CRM_CACHE_KEYS.balance(customerId));

    return result;
  }

  /**
   * Deduct from a customer's wallet.
   * Invalidates the balance cache so the next read reflects the reduced balance.
   */
  async deductWallet(customerId: string, amount: number, reference?: string, note?: string) {
    const result = await this.walletService.deduct(customerId, amount, reference, note);

    // Invalidate stale balance cache — balance was decremented in the DB.
    await this.cacheService.invalidate(CRM_CACHE_KEYS.balance(customerId));

    return result;
  }
}
