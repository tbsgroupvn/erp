import { Test, TestingModule } from '@nestjs/testing';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableRepository } from './accounts-receivable.repository';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { ARAgingSnapshotService } from './ar-aging-snapshot.service';
import { ARAgingCalculatorService } from './ar-aging-calculator.service';
import { ArStatus } from './dto/ar-query.dto';

describe('AccountsReceivableService - getOverdueDebt', () => {
  let service: AccountsReceivableService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    accountReceivable: {
      findMany: jest.fn(),
    },
  };

  const mockRepository = {
    generateCode: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    findOverdue: jest.fn(),
    findByCustomer: jest.fn(),
    update: jest.fn(),
    getAgingReport: jest.fn(),
    getCustomerDebt: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockSnapshotService = {
    createSnapshot: jest.fn(),
    getLatestSnapshot: jest.fn(),
    getSnapshotHistory: jest.fn(),
  };

  const mockCalculatorService = {
    calculateAging: jest.fn(),
    getAgingSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsReceivableService,
        {
          provide: AccountsReceivableRepository,
          useValue: mockRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: ARAgingSnapshotService,
          useValue: mockSnapshotService,
        },
        {
          provide: ARAgingCalculatorService,
          useValue: mockCalculatorService,
        },
      ],
    }).compile();

    service = module.get<AccountsReceivableService>(AccountsReceivableService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOverdueDebt', () => {
    it('should return zero values when customer has no overdue receivables', async () => {
      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([]);

      const result = await service.getOverdueDebt('customer-1');

      expect(result).toEqual({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      expect(prismaService.accountReceivable.findMany).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-1',
          dueDate: { lt: expect.any(Date) },
          status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
        },
        select: {
          amount: true,
          paidAmount: true,
          dueDate: true,
        },
      });
    });

    it('should calculate total overdue amount for single receivable', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([
        {
          amount: new Decimal(10000000), // 10M VND
          paidAmount: new Decimal(3000000), // 3M paid
          dueDate,
        },
      ] as any);

      const result = await service.getOverdueDebt('customer-1');

      expect(result.total).toBe(7000000); // 10M - 3M = 7M outstanding
      expect(result.count).toBe(1);
      expect(result.maxOverdueDays).toBeGreaterThanOrEqual(19);
      expect(result.maxOverdueDays).toBeLessThanOrEqual(20);
    });

    it('should calculate total overdue amount for multiple receivables', async () => {
      const now = new Date();
      const dueDate1 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const dueDate2 = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000); // 25 days ago
      const dueDate3 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([
        {
          amount: new Decimal(10000000), // 10M VND
          paidAmount: new Decimal(2000000), // 2M paid, 8M outstanding
          dueDate: dueDate1,
        },
        {
          amount: new Decimal(20000000), // 20M VND
          paidAmount: new Decimal(5000000), // 5M paid, 15M outstanding
          dueDate: dueDate2,
        },
        {
          amount: new Decimal(5000000), // 5M VND
          paidAmount: new Decimal(0), // 0M paid, 5M outstanding
          dueDate: dueDate3,
        },
      ] as any);

      const result = await service.getOverdueDebt('customer-1');

      expect(result.total).toBe(28000000); // 8M + 15M + 5M = 28M
      expect(result.count).toBe(3);
      expect(result.maxOverdueDays).toBeGreaterThanOrEqual(24);
      expect(result.maxOverdueDays).toBeLessThanOrEqual(25);
    });

    it('should identify the maximum overdue days correctly', async () => {
      const now = new Date();
      const dueDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days
      const dueDate2 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
      const dueDate3 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([
        {
          amount: new Decimal(5000000),
          paidAmount: new Decimal(0),
          dueDate: dueDate1,
        },
        {
          amount: new Decimal(10000000),
          paidAmount: new Decimal(0),
          dueDate: dueDate2,
        },
        {
          amount: new Decimal(7000000),
          paidAmount: new Decimal(0),
          dueDate: dueDate3,
        },
      ] as any);

      const result = await service.getOverdueDebt('customer-1');

      expect(result.maxOverdueDays).toBeGreaterThanOrEqual(29);
      expect(result.maxOverdueDays).toBeLessThanOrEqual(30);
    });

    it('should handle fully paid receivables (0 outstanding)', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([
        {
          amount: new Decimal(10000000),
          paidAmount: new Decimal(10000000), // Fully paid
          dueDate,
        },
      ] as any);

      const result = await service.getOverdueDebt('customer-1');

      expect(result.total).toBe(0);
      expect(result.count).toBe(1);
      expect(result.maxOverdueDays).toBeGreaterThanOrEqual(9);
      expect(result.maxOverdueDays).toBeLessThanOrEqual(10);
    });

    it('should handle partial payments correctly', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([
        {
          amount: new Decimal(50000000), // 50M total
          paidAmount: new Decimal(35000000), // 35M paid
          dueDate,
        },
      ] as any);

      const result = await service.getOverdueDebt('customer-1');

      expect(result.total).toBe(15000000); // 15M outstanding
      expect(result.count).toBe(1);
    });

    it('should only include OPEN and PARTIAL status receivables', async () => {
      const customerId = 'customer-1';
      await service.getOverdueDebt(customerId);

      expect(prismaService.accountReceivable.findMany).toHaveBeenCalledWith({
        where: {
          customerId,
          dueDate: { lt: expect.any(Date) },
          status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
        },
        select: {
          amount: true,
          paidAmount: true,
          dueDate: true,
        },
      });
    });

    it('should handle decimal precision correctly', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([
        {
          amount: new Decimal('10000000.50'),
          paidAmount: new Decimal('3000000.25'),
          dueDate,
        },
      ] as any);

      const result = await service.getOverdueDebt('customer-1');

      expect(result.total).toBe(7000000.25);
    });

    it('should handle edge case of due date exactly at current time', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 1000); // 1 second ago

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue([
        {
          amount: new Decimal(5000000),
          paidAmount: new Decimal(0),
          dueDate,
        },
      ] as any);

      const result = await service.getOverdueDebt('customer-1');

      expect(result.total).toBe(5000000);
      expect(result.count).toBe(1);
      expect(result.maxOverdueDays).toBe(0); // Less than a day
    });

    it('should accumulate totals from multiple receivables correctly', async () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Create 5 receivables with various amounts
      const receivables = [
        { amount: new Decimal(1000000), paidAmount: new Decimal(200000), dueDate }, // 800k
        { amount: new Decimal(2000000), paidAmount: new Decimal(500000), dueDate }, // 1.5M
        { amount: new Decimal(3000000), paidAmount: new Decimal(0), dueDate }, // 3M
        { amount: new Decimal(4000000), paidAmount: new Decimal(1000000), dueDate }, // 3M
        { amount: new Decimal(5000000), paidAmount: new Decimal(2500000), dueDate }, // 2.5M
      ];

      jest.spyOn(prismaService.accountReceivable, 'findMany').mockResolvedValue(receivables as any);

      const result = await service.getOverdueDebt('customer-1');

      // 800k + 1.5M + 3M + 3M + 2.5M = 10.8M
      expect(result.total).toBe(10800000);
      expect(result.count).toBe(5);
    });
  });
});
