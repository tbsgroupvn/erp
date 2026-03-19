import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatusService } from './order-status.service';
import { OrderRepository } from './order.repository';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatusMachine } from './domain/order-status.machine';
import { DepositGateService } from './domain/deposit-gate.service';
import { TransactionalEmitter } from '@core/events/transactional-emitter.service';
import { CacheService } from '@core/cache/cache.service';
import { OrderStatus, ServiceType, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Mock data constants
// ---------------------------------------------------------------------------

const mockOrder = {
  id: 'order-001',
  code: 'TBS-ORD-260319-0001',
  customerId: 'cust-001',
  saleId: 'user-001',
  serviceType: ServiceType.MHH,
  status: OrderStatus.CONSULTING,
  totalAmount: new Decimal(10000000),
  depositPaid: new Decimal(0),
  depositRequired: new Decimal(10000000),
  isDepositPaid: false,
  items: [],
  customer: {
    id: 'cust-001',
    code: 'KH-001',
    fullName: 'Nguyen Van A',
    companyName: null,
    tier: 'NEW',
    phone: '0901234567',
  },
  statusHistory: [],
  packages: [],
  paymentVouchers: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderStatusService', () => {
  let service: OrderStatusService;
  let orderRepo: OrderRepository;
  let prisma: PrismaService;
  let statusMachine: OrderStatusMachine;
  let depositGate: DepositGateService;
  let eventEmitter: EventEmitter2;
  let txEmitter: TransactionalEmitter;
  let cacheService: CacheService;

  let mockCollector: { emit: jest.Mock; flush: jest.Mock; discard: jest.Mock };

  beforeEach(async () => {
    mockCollector = {
      emit: jest.fn(),
      flush: jest.fn(),
      discard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderStatusService,
        {
          provide: OrderRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue({ ...mockOrder }),
            updateStatus: jest.fn().mockResolvedValue({
              ...mockOrder,
              status: OrderStatus.QUOTATION,
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            order: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            package: {
              count: jest.fn(),
            },
            orderItem: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: OrderStatusMachine,
          useValue: {
            assertTransition: jest.fn(), // no-op = valid transition
            validateTransition: jest.fn().mockReturnValue(true),
            canCancel: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: DepositGateService,
          useValue: {
            shouldBlockTransition: jest
              .fn()
              .mockReturnValue({ blocked: false }),
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
            createCollector: jest.fn().mockReturnValue(mockCollector),
          },
        },
        {
          provide: CacheService,
          useValue: {
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<OrderStatusService>(OrderStatusService);
    orderRepo = module.get<OrderRepository>(OrderRepository);
    prisma = module.get<PrismaService>(PrismaService);
    statusMachine = module.get<OrderStatusMachine>(OrderStatusMachine);
    depositGate = module.get<DepositGateService>(DepositGateService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    txEmitter = module.get<TransactionalEmitter>(TransactionalEmitter);
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // changeStatus
  // ─────────────────────────────────────────────────────────
  describe('changeStatus', () => {
    it('should successfully change status and verify TransactionalEmitter collector', async () => {
      const result = await service.changeStatus(
        'order-001',
        OrderStatus.QUOTATION,
        'user-001',
        'Moving to quotation',
      );

      expect(result).toBeDefined();

      // FSM validation was called
      expect(statusMachine.assertTransition).toHaveBeenCalledWith(
        OrderStatus.CONSULTING,
        OrderStatus.QUOTATION,
        ServiceType.MHH,
      );

      // Deposit gate was checked
      expect(depositGate.shouldBlockTransition).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'order-001' }),
        OrderStatus.QUOTATION,
      );

      // Status update was called
      expect(orderRepo.updateStatus).toHaveBeenCalledWith(
        'order-001',
        OrderStatus.CONSULTING,
        OrderStatus.QUOTATION,
        'user-001',
        'Moving to quotation',
        expect.any(Object),
      );

      // TransactionalEmitter collector was used
      expect(txEmitter.createCollector).toHaveBeenCalled();
      expect(mockCollector.emit).toHaveBeenCalledWith(
        'order.status.changed',
        expect.objectContaining({
          orderId: 'order-001',
          fromStatus: OrderStatus.CONSULTING,
          toStatus: OrderStatus.QUOTATION,
        }),
      );
      expect(mockCollector.flush).toHaveBeenCalled();
    });

    it('should throw NotFoundException when order is not found', async () => {
      (orderRepo.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.changeStatus('non-existent', OrderStatus.QUOTATION, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate error when FSM rejects the transition', async () => {
      (statusMachine.assertTransition as jest.Mock).mockImplementation(() => {
        throw new BadRequestException(
          'Invalid status transition from CONSULTING to COMPLETED',
        );
      });

      await expect(
        service.changeStatus('order-001', OrderStatus.COMPLETED, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when deposit gate blocks the transition', async () => {
      // Order in PENDING_DEPOSIT trying to go to SOURCING
      (orderRepo.findById as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PENDING_DEPOSIT,
      });

      (depositGate.shouldBlockTransition as jest.Mock).mockReturnValue({
        blocked: true,
        reason: 'Cannot proceed to SOURCING: deposit not satisfied',
      });

      await expect(
        service.changeStatus('order-001', OrderStatus.SOURCING, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when role is restricted from target status', async () => {
      // SALE trying to change to SOURCING (restricted to accountants/executives)
      (orderRepo.findById as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PENDING_DEPOSIT,
      });

      await expect(
        service.changeStatus(
          'order-001',
          OrderStatus.SOURCING,
          'user-001',
          undefined,
          UserRole.SALE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────
  // updateDepositPayment
  // ─────────────────────────────────────────────────────────
  describe('updateDepositPayment', () => {
    it('should update deposit payment and return updated values', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-001',
        depositRequired: new Decimal(10000000),
        depositPaid: new Decimal(3000000),
      });

      (prisma.order.update as jest.Mock).mockResolvedValue({});

      const result = await service.updateDepositPayment('order-001', 4000000);

      expect(result.depositPaid).toBe(7000000);
      expect(result.isDepositPaid).toBe(false);

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-001' },
          data: expect.objectContaining({
            depositPaid: expect.any(Decimal),
            isDepositPaid: false,
          }),
        }),
      );
    });

    it('should mark deposit as satisfied when paid >= required', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-001',
        depositRequired: new Decimal(10000000),
        depositPaid: new Decimal(7000000),
      });

      (prisma.order.update as jest.Mock).mockResolvedValue({});

      const result = await service.updateDepositPayment('order-001', 3000000);

      expect(result.depositPaid).toBe(10000000);
      expect(result.isDepositPaid).toBe(true);
    });
  });
});
