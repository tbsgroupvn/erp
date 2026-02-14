import { Test, TestingModule } from '@nestjs/testing';
import { CommissionCalculatorService } from './commission-calculator.service';
import { PrismaService } from '@core/database/prisma.service';
import { ServiceType } from '@prisma/client';

describe('CommissionCalculatorService', () => {
  let service: CommissionCalculatorService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    commissionRule: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionCalculatorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CommissionCalculatorService>(
      CommissionCalculatorService,
    );
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('calculateCommission', () => {
    it('should calculate commission correctly for VCT service with medium profit', async () => {
      // Arrange
      const order = {
        id: 'order-1',
        code: 'TBS-ORD-001',
        saleId: 'sale-1',
        serviceType: ServiceType.VCT,
        totalAmount: 20_000_000, // 20M VND revenue
        costAllocations: [
          { allocatedAmount: 8_000_000 }, // 8M VND
          { allocatedAmount: 2_000_000 }, // 2M VND
        ],
      };

      const mockRule = {
        id: 'rule-1',
        serviceType: ServiceType.VCT,
        minProfit: 5_000_000,
        maxProfit: 15_000_000,
        rate: 0.04, // 4%
        isActive: true,
      };

      mockPrismaService.commissionRule.findFirst.mockResolvedValue(mockRule);

      // Act
      const result = await service.calculateCommission(order);

      // Assert
      expect(result).toBeDefined();
      expect(result!.revenue).toBe(20_000_000);
      expect(result!.cost).toBe(10_000_000);
      expect(result!.profit).toBe(10_000_000);
      expect(result!.rate).toBe(0.04);
      expect(result!.amount).toBe(400_000); // 10M * 4% = 400K

      expect(mockPrismaService.commissionRule.findFirst).toHaveBeenCalledWith({
        where: {
          serviceType: ServiceType.VCT,
          isActive: true,
          minProfit: { lte: 10_000_000 },
          maxProfit: { gt: 10_000_000 },
        },
        orderBy: {
          minProfit: 'desc',
        },
      });
    });

    it('should return null when no commission rule matches', async () => {
      // Arrange
      const order = {
        id: 'order-1',
        code: 'TBS-ORD-001',
        saleId: 'sale-1',
        serviceType: ServiceType.MHH,
        totalAmount: 50_000_000,
        costAllocations: [{ allocatedAmount: 35_000_000 }],
      };

      mockPrismaService.commissionRule.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.calculateCommission(order);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle orders with Decimal values', async () => {
      // Arrange
      const order = {
        id: 'order-1',
        code: 'TBS-ORD-001',
        saleId: 'sale-1',
        serviceType: ServiceType.UTXNK,
        totalAmount: {
          toNumber: () => 100_000_000,
        },
        costAllocations: [
          {
            allocatedAmount: {
              toNumber: () => 60_000_000,
            },
          },
        ],
      };

      const mockRule = {
        id: 'rule-1',
        serviceType: ServiceType.UTXNK,
        minProfit: 20_000_000,
        maxProfit: 50_000_000,
        rate: 0.045,
        isActive: true,
      };

      mockPrismaService.commissionRule.findFirst.mockResolvedValue(mockRule);

      // Act
      const result = await service.calculateCommission(order as any);

      // Assert
      expect(result).toBeDefined();
      expect(result!.revenue).toBe(100_000_000);
      expect(result!.cost).toBe(60_000_000);
      expect(result!.profit).toBe(40_000_000);
      expect(result!.rate).toBe(0.045);
      expect(result!.amount).toBe(1_800_000); // 40M * 4.5% = 1.8M
    });

    it('should handle negative profit (loss)', async () => {
      // Arrange
      const order = {
        id: 'order-1',
        code: 'TBS-ORD-001',
        saleId: 'sale-1',
        serviceType: ServiceType.MHH,
        totalAmount: 10_000_000,
        costAllocations: [{ allocatedAmount: 15_000_000 }], // Cost > Revenue
      };

      mockPrismaService.commissionRule.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.calculateCommission(order);

      // Assert
      expect(result).toBeNull(); // No commission for loss
    });

    it('should handle zero profit', async () => {
      // Arrange
      const order = {
        id: 'order-1',
        code: 'TBS-ORD-001',
        saleId: 'sale-1',
        serviceType: ServiceType.VCT,
        totalAmount: 20_000_000,
        costAllocations: [{ allocatedAmount: 20_000_000 }], // Break-even
      };

      const mockRule = {
        id: 'rule-1',
        serviceType: ServiceType.VCT,
        minProfit: 0,
        maxProfit: 5_000_000,
        rate: 0.02,
        isActive: true,
      };

      mockPrismaService.commissionRule.findFirst.mockResolvedValue(mockRule);

      // Act
      const result = await service.calculateCommission(order);

      // Assert
      expect(result).toBeDefined();
      expect(result!.profit).toBe(0);
      expect(result!.amount).toBe(0); // 0 * 2% = 0
    });

    it('should handle orders with no cost allocations', async () => {
      // Arrange
      const order = {
        id: 'order-1',
        code: 'TBS-ORD-001',
        saleId: 'sale-1',
        serviceType: ServiceType.LCLCN,
        totalAmount: 30_000_000,
        costAllocations: [], // No costs
      };

      const mockRule = {
        id: 'rule-1',
        serviceType: ServiceType.LCLCN,
        minProfit: 25_000_000,
        maxProfit: 50_000_000,
        rate: 0.07,
        isActive: true,
      };

      mockPrismaService.commissionRule.findFirst.mockResolvedValue(mockRule);

      // Act
      const result = await service.calculateCommission(order);

      // Assert
      expect(result).toBeDefined();
      expect(result!.cost).toBe(0);
      expect(result!.profit).toBe(30_000_000); // 100% profit
      expect(result!.amount).toBe(2_100_000); // 30M * 7% = 2.1M
    });
  });

  describe('getCommissionTiers', () => {
    it('should group commission rules by service type', async () => {
      // Arrange
      const mockRules = [
        {
          serviceType: ServiceType.VCT,
          minProfit: 0,
          maxProfit: 5_000_000,
          rate: 0.02,
        },
        {
          serviceType: ServiceType.VCT,
          minProfit: 5_000_000,
          maxProfit: 15_000_000,
          rate: 0.04,
        },
        {
          serviceType: ServiceType.MHH,
          minProfit: 0,
          maxProfit: 10_000_000,
          rate: 0.03,
        },
      ];

      mockPrismaService.commissionRule.findMany.mockResolvedValue(mockRules);

      // Act
      const result = await service.getCommissionTiers();

      // Assert
      expect(result[ServiceType.VCT]).toHaveLength(2);
      expect(result[ServiceType.MHH]).toHaveLength(1);
      expect(result[ServiceType.VCT][0].rate).toBe(0.02);
      expect(result[ServiceType.VCT][1].rate).toBe(0.04);
    });
  });

  describe('validateCommissionRules', () => {
    it('should detect overlapping rules', async () => {
      // Arrange
      const mockRules = [
        {
          id: 'rule-1',
          serviceType: ServiceType.VCT,
          minProfit: 0,
          maxProfit: 10_000_000,
          rate: 0.02,
          isActive: true,
        },
        {
          id: 'rule-2',
          serviceType: ServiceType.VCT,
          minProfit: 5_000_000, // Overlaps with rule-1
          maxProfit: 15_000_000,
          rate: 0.04,
          isActive: true,
        },
      ];

      mockPrismaService.commissionRule.findMany.mockResolvedValue(mockRules);

      // Act
      const result = await service.validateCommissionRules(ServiceType.VCT);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Overlap detected'),
      );
    });

    it('should detect gaps in rules', async () => {
      // Arrange
      const mockRules = [
        {
          id: 'rule-1',
          serviceType: ServiceType.MHH,
          minProfit: 0,
          maxProfit: 10_000_000,
          rate: 0.03,
          isActive: true,
        },
        {
          id: 'rule-2',
          serviceType: ServiceType.MHH,
          minProfit: 15_000_000, // Gap: 10M-15M uncovered
          maxProfit: 30_000_000,
          rate: 0.05,
          isActive: true,
        },
      ];

      mockPrismaService.commissionRule.findMany.mockResolvedValue(mockRules);

      // Act
      const result = await service.validateCommissionRules(ServiceType.MHH);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Gap detected'));
    });

    it('should validate rules with no gaps or overlaps', async () => {
      // Arrange
      const mockRules = [
        {
          id: 'rule-1',
          serviceType: ServiceType.UTXNK,
          minProfit: 0,
          maxProfit: 10_000_000,
          rate: 0.025,
          isActive: true,
        },
        {
          id: 'rule-2',
          serviceType: ServiceType.UTXNK,
          minProfit: 10_000_000,
          maxProfit: 30_000_000,
          rate: 0.045,
          isActive: true,
        },
      ];

      mockPrismaService.commissionRule.findMany.mockResolvedValue(mockRules);

      // Act
      const result = await service.validateCommissionRules(ServiceType.UTXNK);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
