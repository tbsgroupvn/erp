import { Test, TestingModule } from '@nestjs/testing';
import { DepositGateService } from './deposit-gate.service';
import { PrismaService } from '@core/database/prisma.service';
import { CustomerTier, ServiceType, OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('DepositGateService', () => {
  let service: DepositGateService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositGateService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DepositGateService>(DepositGateService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------- shouldBlockTransition ----------

  describe('shouldBlockTransition', () => {
    describe('blocks MHH orders with insufficient deposit for SOURCING', () => {
      it('should block NEW tier customer with < 100% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(10000000), // 10M required (100%)
          depositPaid: new Decimal(5000000),       // 5M paid (50%)
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(true);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('deposit not satisfied');
      });

      it('should block REGULAR tier customer with < 70% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(7000000), // 7M required (70% of 10M)
          depositPaid: new Decimal(3000000),      // 3M paid
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('deposit not satisfied');
      });

      it('should block VIP tier customer with < 50% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(5000000), // 5M required (50% of 10M)
          depositPaid: new Decimal(2000000),      // 2M paid
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('deposit not satisfied');
      });

      it('should block STRATEGIC tier customer with < 30% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(3000000), // 3M required (30% of 10M)
          depositPaid: new Decimal(1000000),      // 1M paid
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('deposit not satisfied');
      });
    });

    describe('allows MHH orders with sufficient deposit for SOURCING', () => {
      it('should allow NEW tier customer with 100% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(10000000),
          depositPaid: new Decimal(10000000),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(false);
        expect(result.reason).toBeUndefined();
      });

      it('should allow REGULAR tier customer with >= 70% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(7000000),
          depositPaid: new Decimal(7000000),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(false);
      });

      it('should allow VIP tier customer with >= 50% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(5000000),
          depositPaid: new Decimal(5000000),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(false);
      });

      it('should allow STRATEGIC tier customer with >= 30% deposit', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(3000000),
          depositPaid: new Decimal(3000000),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(false);
      });
    });

    describe('VCT service type exemption', () => {
      it('should never block VCT orders regardless of deposit', () => {
        const order = {
          serviceType: ServiceType.VCT,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(10000000),
          depositPaid: new Decimal(0), // Zero deposit
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(false);
      });
    });

    describe('MHH enforces deposit check', () => {
      it('should enforce deposit check for MHH serviceType', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.PENDING_DEPOSIT,
          depositRequired: new Decimal(10000000),
          depositPaid: new Decimal(0),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.SOURCING);

        expect(result.blocked).toBe(true);
      });
    });

    describe('only blocks SOURCING transition', () => {
      it('should not block transition to WAREHOUSE_CN', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.SOURCING,
          depositRequired: new Decimal(10000000),
          depositPaid: new Decimal(0),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.WAREHOUSE_CN);

        expect(result.blocked).toBe(false);
      });

      it('should not block transition to PACKING', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.WAREHOUSE_CN,
          depositRequired: new Decimal(10000000),
          depositPaid: new Decimal(0),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.PACKING);

        expect(result.blocked).toBe(false);
      });

      it('should not block transition to COMPLETED', () => {
        const order = {
          serviceType: ServiceType.MHH,
          status: OrderStatus.SETTLEMENT,
          depositRequired: new Decimal(10000000),
          depositPaid: new Decimal(0),
          isDepositPaid: false,
        };

        const result = service.shouldBlockTransition(order, OrderStatus.COMPLETED);

        expect(result.blocked).toBe(false);
      });
    });
  });

  // ---------- checkDepositRequirement ----------

  describe('checkDepositRequirement', () => {
    it('should return required=false for VCT service type', () => {
      const result = service.checkDepositRequirement(
        10000000,
        CustomerTier.NEW,
        ServiceType.VCT,
      );

      expect(result.required).toBe(false);
      expect(result.depositRate).toBe(0);
      expect(result.depositAmount).toBe(0);
    });

    it('should return depositRate=100 for MHH + NEW tier', () => {
      const result = service.checkDepositRequirement(
        10000000,
        CustomerTier.NEW,
        ServiceType.MHH,
      );

      expect(result.required).toBe(true);
      expect(result.depositRate).toBe(100);
      expect(result.depositAmount).toBe(10000000);
    });

    it('should return depositRate=70 for MHH + REGULAR tier', () => {
      const result = service.checkDepositRequirement(
        10000000,
        CustomerTier.REGULAR,
        ServiceType.MHH,
      );

      expect(result.depositRate).toBe(70);
      expect(result.depositAmount).toBe(7000000);
    });

    it('should return depositRate=50 for MHH + VIP tier', () => {
      const result = service.checkDepositRequirement(
        10000000,
        CustomerTier.VIP,
        ServiceType.MHH,
      );

      expect(result.depositRate).toBe(50);
      expect(result.depositAmount).toBe(5000000);
    });

    it('should return depositRate=30 for MHH + STRATEGIC tier', () => {
      const result = service.checkDepositRequirement(
        10000000,
        CustomerTier.STRATEGIC,
        ServiceType.MHH,
      );

      expect(result.depositRate).toBe(30);
      expect(result.depositAmount).toBe(3000000);
    });

    it('should use customer-level override when provided', () => {
      const result = service.checkDepositRequirement(
        10000000,
        CustomerTier.NEW,
        ServiceType.MHH,
        60, // Override: 60% instead of 100%
      );

      expect(result.depositRate).toBe(60);
      expect(result.depositAmount).toBe(6000000);
    });

    it('should fall back to tier rate when customerDepositRate is 0', () => {
      const result = service.checkDepositRequirement(
        10000000,
        CustomerTier.NEW,
        ServiceType.MHH,
        0, // Zero override -> use tier default
      );

      expect(result.depositRate).toBe(100);
      expect(result.depositAmount).toBe(10000000);
    });
  });

  // ---------- isDepositSatisfied ----------

  describe('isDepositSatisfied', () => {
    it('should return satisfied=true when depositPaid >= depositRequired', () => {
      const order = {
        depositRequired: new Decimal(7000000),
        depositPaid: new Decimal(7000000),
        isDepositPaid: false,
      };

      const result = service.isDepositSatisfied(order);

      expect(result.satisfied).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should return satisfied=true when depositRequired is 0', () => {
      const order = {
        depositRequired: new Decimal(0),
        depositPaid: new Decimal(0),
        isDepositPaid: false,
      };

      const result = service.isDepositSatisfied(order);

      expect(result.satisfied).toBe(true);
      expect(result.required).toBe(0);
    });

    it('should return satisfied=true when isDepositPaid flag is true even if paid < required', () => {
      const order = {
        depositRequired: new Decimal(10000000),
        depositPaid: new Decimal(5000000),
        isDepositPaid: true, // Manually marked as paid
      };

      const result = service.isDepositSatisfied(order);

      expect(result.satisfied).toBe(true);
    });

    it('should return satisfied=false when paid < required and isDepositPaid=false', () => {
      const order = {
        depositRequired: new Decimal(10000000),
        depositPaid: new Decimal(3000000),
        isDepositPaid: false,
      };

      const result = service.isDepositSatisfied(order);

      expect(result.satisfied).toBe(false);
      expect(result.remaining).toBe(7000000);
    });

    it('should return remaining=0 when overpaid', () => {
      const order = {
        depositRequired: new Decimal(5000000),
        depositPaid: new Decimal(8000000),
        isDepositPaid: false,
      };

      const result = service.isDepositSatisfied(order);

      expect(result.satisfied).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  // ---------- canProcure ----------

  describe('canProcure', () => {
    it('should return allowed=false when depositPaid < depositRequired', async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        totalAmount: new Decimal(10000000),
        depositPaid: new Decimal(3000000),
        depositRequired: new Decimal(7000000),
        isDepositPaid: false,
      });

      const result = await service.canProcure('order-1');

      expect(result.allowed).toBe(false);
      expect(result.depositPaidPercent).toBe(30);
      expect(result.isPriority).toBe(false);
    });

    it('should return allowed=true and isPriority=true when 100% paid', async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-2',
        totalAmount: new Decimal(10000000),
        depositPaid: new Decimal(10000000),
        depositRequired: new Decimal(7000000),
        isDepositPaid: true,
      });

      const result = await service.canProcure('order-2');

      expect(result.allowed).toBe(true);
      expect(result.isPriority).toBe(true);
      expect(result.depositPaidPercent).toBe(100);
    });

    it('should return allowed=true and isPriority=false when partially paid but sufficient', async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-3',
        totalAmount: new Decimal(10000000),
        depositPaid: new Decimal(7000000),
        depositRequired: new Decimal(7000000),
        isDepositPaid: false,
      });

      const result = await service.canProcure('order-3');

      expect(result.allowed).toBe(true);
      expect(result.isPriority).toBe(false);
      expect(result.depositPaidPercent).toBe(70);
    });

    it('should return allowed=false when order not found', async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.canProcure('non-existent');

      expect(result.allowed).toBe(false);
      expect(result.depositPaid).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });
});
