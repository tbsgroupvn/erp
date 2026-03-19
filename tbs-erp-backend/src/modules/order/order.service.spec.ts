import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderService } from './order.service';
import { OrderRepository } from './order.repository';
import { PrismaService } from '@core/database/prisma.service';
import { DepositGateService } from './domain/deposit-gate.service';
import { TransactionalEmitter } from '@core/events/transactional-emitter.service';
import { ExchangeRateService } from '@modules/exchange-rate/exchange-rate.service';
import { CacheService } from '@core/cache/cache.service';
import { OrderStatus, ServiceType, Branch, CustomerTier } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Mock data constants
// ---------------------------------------------------------------------------

const mockCurrentUser = {
  id: 'user-001',
  email: 'sale@tbs.vn',
  role: 'SALE' as const,
  branch: 'HN' as const,
};

const mockCustomer = {
  id: 'cust-001',
  code: 'KH-001',
  fullName: 'Nguyen Van A',
  tier: CustomerTier.NEW,
  depositRate: null,
  isActive: true,
  exchangeRateMode: 'FLOATING',
};

const mockCreateOrderDto = {
  customerId: 'cust-001',
  serviceType: ServiceType.MHH,
  branch: Branch.HN,
  items: [
    {
      productName: 'Test Product',
      productUrl: 'https://taobao.com/item/123',
      quantity: 10,
      unitPrice: 100,
      note: 'Test note',
    },
  ],
  note: 'Test order',
};

const mockOrder = {
  id: 'order-001',
  code: 'TBS-ORD-260319-0001',
  customerId: 'cust-001',
  saleId: 'user-001',
  serviceType: ServiceType.MHH,
  branch: Branch.HN,
  status: OrderStatus.CONSULTING,
  totalAmount: new Decimal(1000),
  depositRequired: new Decimal(1000),
  depositPaid: new Decimal(0),
  isDepositPaid: false,
  items: [],
  customer: {
    id: 'cust-001',
    code: 'KH-001',
    fullName: 'Nguyen Van A',
    companyName: null,
    tier: CustomerTier.NEW,
    phone: '0901234567',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderService', () => {
  let service: OrderService;
  let orderRepo: OrderRepository;
  let prisma: PrismaService;
  let depositGate: DepositGateService;
  let eventEmitter: EventEmitter2;
  let txEmitter: TransactionalEmitter;
  let exchangeRateService: ExchangeRateService;
  let cacheService: CacheService;

  const mockCollector = {
    emit: jest.fn(),
    flush: jest.fn(),
    discard: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: OrderRepository,
          useValue: {
            generateOrderCode: jest.fn().mockResolvedValue('TBS-ORD-260319-0001'),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            replaceItems: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findUnique: jest.fn(),
            },
            order: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
            },
            orderStatusHistory: {
              create: jest.fn(),
            },
            $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
              // The callback receives the same prisma mock as the "tx" arg
              return cb({
                order: {
                  create: jest.fn().mockResolvedValue(mockOrder),
                  update: jest.fn().mockResolvedValue(mockOrder),
                  findUnique: jest.fn().mockResolvedValue(mockOrder),
                },
                orderStatusHistory: {
                  create: jest.fn().mockResolvedValue({}),
                },
              });
            }),
          },
        },
        {
          provide: DepositGateService,
          useValue: {
            checkDepositRequirement: jest.fn().mockReturnValue({
              required: true,
              depositRate: 100,
              depositAmount: 1000,
              serviceType: ServiceType.MHH,
              customerTier: CustomerTier.NEW,
            }),
            shouldBlockTransition: jest.fn().mockReturnValue({ blocked: false }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: TransactionalEmitter,
          useValue: {
            createCollector: jest.fn().mockReturnValue({
              emit: jest.fn(),
              flush: jest.fn(),
              discard: jest.fn(),
            }),
          },
        },
        {
          provide: ExchangeRateService,
          useValue: {
            getCurrentRate: jest.fn().mockResolvedValue({ rate: 3500 }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            delByPrefix: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepo = module.get<OrderRepository>(OrderRepository);
    prisma = module.get<PrismaService>(PrismaService);
    depositGate = module.get<DepositGateService>(DepositGateService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    txEmitter = module.get<TransactionalEmitter>(TransactionalEmitter);
    exchangeRateService = module.get<ExchangeRateService>(ExchangeRateService);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // createOrder
  // ─────────────────────────────────────────────────────────
  describe('createOrder', () => {
    it('should create an order for a valid active customer and emit order.created', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer);

      const result = await service.createOrder(
        mockCreateOrderDto as any,
        mockCurrentUser as any,
      );

      // Order created successfully
      expect(result).toBeDefined();
      expect(result.id).toBe('order-001');

      // Deposit gate was checked
      expect(depositGate.checkDepositRequirement).toHaveBeenCalledWith(
        1000, // 10 * 100
        CustomerTier.NEW,
        ServiceType.MHH,
        null,
      );

      // Event emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          orderId: 'order-001',
          customerId: 'cust-001',
          serviceType: ServiceType.MHH,
        }),
      );
    });

    it('should throw NotFoundException when customer is not found', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createOrder(mockCreateOrderDto as any, mockCurrentUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when customer is inactive', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
        ...mockCustomer,
        isActive: false,
      });

      await expect(
        service.createOrder(mockCreateOrderDto as any, mockCurrentUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should retry on P2002 code conflict and succeed on second attempt', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer);

      // First $transaction call throws P2002, second succeeds
      let callCount = 0;
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: any) => Promise<any>) => {
          callCount++;
          if (callCount === 1) {
            const error: any = new Error('Unique constraint violation');
            error.code = 'P2002';
            throw error;
          }
          return cb({
            order: {
              create: jest.fn().mockResolvedValue(mockOrder),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValue({}),
            },
          });
        },
      );

      const result = await service.createOrder(
        mockCreateOrderDto as any,
        mockCurrentUser as any,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('order-001');
      // Should have been called twice (first failed, second succeeded)
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      // generateOrderCode called for retry
      expect(orderRepo.generateOrderCode).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────
  // reopenOrder
  // ─────────────────────────────────────────────────────────
  describe('reopenOrder', () => {
    it('should reopen a COMPLETED order to SETTLEMENT and verify TransactionalEmitter', async () => {
      const completedOrder = {
        id: 'order-001',
        code: 'TBS-ORD-260319-0001',
        status: OrderStatus.COMPLETED,
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(completedOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...completedOrder,
        status: OrderStatus.SETTLEMENT,
      });

      // Get the collector mock that will be returned by createCollector
      const collector = (txEmitter.createCollector as jest.Mock)();
      // Reset so we can track calls from the actual service method
      (txEmitter.createCollector as jest.Mock).mockReturnValue(collector);
      collector.emit.mockClear();
      collector.flush.mockClear();

      const result = await service.reopenOrder(
        'order-001',
        mockCurrentUser as any,
        'Financial reconciliation needed',
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.SETTLEMENT);

      // Verify prisma update was called with SETTLEMENT status
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-001' },
          data: expect.objectContaining({
            status: OrderStatus.SETTLEMENT,
          }),
        }),
      );

      // Verify TransactionalEmitter collector usage
      expect(txEmitter.createCollector).toHaveBeenCalled();
      expect(collector.emit).toHaveBeenCalledWith(
        'order.reopened',
        expect.objectContaining({
          orderId: 'order-001',
          reopenedBy: 'user-001',
        }),
      );
      expect(collector.emit).toHaveBeenCalledWith(
        'order.status.changed',
        expect.objectContaining({
          orderId: 'order-001',
          fromStatus: OrderStatus.COMPLETED,
          toStatus: OrderStatus.SETTLEMENT,
        }),
      );
      expect(collector.flush).toHaveBeenCalled();
    });

    it('should throw NotFoundException when order is not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.reopenOrder('non-existent', mockCurrentUser as any, 'reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order is not in COMPLETED status', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-001',
        code: 'TBS-ORD-260319-0001',
        status: OrderStatus.CONSULTING,
      });

      await expect(
        service.reopenOrder('order-001', mockCurrentUser as any, 'reason'),
      ).rejects.toThrow(BadRequestException);

      // Verify the error message mentions COMPLETED
      try {
        await service.reopenOrder('order-001', mockCurrentUser as any, 'reason');
      } catch (error) {
        expect(error.message).toContain('COMPLETED');
      }
    });
  });
});
