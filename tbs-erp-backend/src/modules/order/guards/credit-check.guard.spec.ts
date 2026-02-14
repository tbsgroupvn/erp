import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CreditCheckGuard } from './credit-check.guard';
import { PrismaService } from '@core/database/prisma.service';
import { AccountsReceivableService } from '@modules/accounts-receivable/accounts-receivable.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { ServiceType, Branch, Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('CreditCheckGuard', () => {
  let guard: CreditCheckGuard;
  let prismaService: PrismaService;
  let arService: AccountsReceivableService;
  let reflector: Reflector;

  const mockCustomer = {
    id: 'customer-1',
    code: 'TBS-KH-000001',
    fullName: 'Công ty ABC',
    creditLimit: new Decimal(100000000), // 100M VND
    currentDebt: new Decimal(50000000), // 50M VND
    tier: 'GOLD',
    isActive: true,
  };

  const createMockExecutionContext = (dto: CreateOrderDto): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          body: dto,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditCheckGuard,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: AccountsReceivableService,
          useValue: {
            getOverdueDebt: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<CreditCheckGuard>(CreditCheckGuard);
    prismaService = module.get<PrismaService>(PrismaService);
    arService = module.get<AccountsReceivableService>(AccountsReceivableService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Bypass scenarios', () => {
    it('should allow request when @SkipCreditCheck decorator is used', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 100,
            currency: Currency.CNY,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(true);

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.customer.findUnique).not.toHaveBeenCalled();
    });

    it('should allow request when customerId is missing (validation will handle)', async () => {
      const dto: CreateOrderDto = {
        customerId: '',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prismaService.customer.findUnique).not.toHaveBeenCalled();
    });

    it('should allow request when customer not found (service will handle)', async () => {
      const dto: CreateOrderDto = {
        customerId: 'non-existent',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 100,
            currency: Currency.CNY,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(null);

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Customer status validation', () => {
    it('should block request when customer is inactive', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 100,
            currency: Currency.CNY,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue({
        ...mockCustomer,
        isActive: false,
      } as any);

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        /Không thể tạo đơn hàng.*đã bị vô hiệu hóa/,
      );
    });
  });

  describe('Overdue debt validation', () => {
    it('should block request when customer has overdue debt > 15 days', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 1000000, // 1M
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 20000000, // 20M VND overdue
        maxOverdueDays: 30, // 30 days overdue
        count: 2,
      });

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        /có công nợ quá hạn 30 ngày.*vượt quá 15 ngày/,
      );
    });

    it('should allow request when overdue debt is <= 15 days', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 1000000, // 1M VND
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 5000000, // 5M VND overdue
        maxOverdueDays: 10, // 10 days overdue (within threshold)
        count: 1,
      });

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow request when customer has no overdue debt', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: 1000000,
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Credit limit validation', () => {
    it('should block request when order amount exceeds available credit', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Expensive Product',
            quantity: 1,
            unitPrice: 60000000, // 60M VND (exceeds 50M available)
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        /Giá trị đơn hàng.*vượt quá hạn mức tín dụng khả dụng/,
      );
    });

    it('should allow request when order amount is within available credit', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Affordable Product',
            quantity: 2,
            unitPrice: 10000000, // 20M VND total (within 50M available)
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow request when order amount equals available credit', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 50000000, // Exactly 50M available
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Order amount calculation', () => {
    it('should correctly calculate total for multiple items', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product 1',
            quantity: 5,
            unitPrice: 1000000, // 5M
            currency: Currency.VND,
          },
          {
            productName: 'Product 2',
            quantity: 3,
            unitPrice: 2000000, // 6M
            currency: Currency.VND,
          },
          {
            productName: 'Product 3',
            quantity: 2,
            unitPrice: 500000, // 1M
            currency: Currency.VND,
          },
        ],
        // Total: 5M + 6M + 1M = 12M
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle empty items array', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle customer with zero credit limit', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 1000,
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue({
        ...mockCustomer,
        creditLimit: new Decimal(0),
        currentDebt: new Decimal(0),
      } as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle customer with debt equal to credit limit', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 1000,
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue({
        ...mockCustomer,
        creditLimit: new Decimal(100000000),
        currentDebt: new Decimal(100000000), // Maxed out
      } as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle exactly 15 days overdue (at threshold)', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 1000000,
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 5000000,
        maxOverdueDays: 15, // Exactly at threshold
        count: 1,
      });

      const context = createMockExecutionContext(dto);
      const result = await guard.canActivate(context);

      // Should pass since threshold is > 15, not >= 15
      expect(result).toBe(true);
    });

    it('should handle 16 days overdue (just over threshold)', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 1000000,
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 5000000,
        maxOverdueDays: 16, // Just over threshold
        count: 1,
      });

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Error message localization', () => {
    it('should provide Vietnamese error message for overdue debt', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 1000000,
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 20000000,
        maxOverdueDays: 30,
        count: 2,
      });

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Công ty ABC'),
        }),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('TBS-KH-000001'),
        }),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('VND'),
        }),
      );
    });

    it('should provide Vietnamese error message for credit limit exceeded', async () => {
      const dto: CreateOrderDto = {
        customerId: 'customer-1',
        serviceType: ServiceType.MHH,
        branch: Branch.HN,
        items: [
          {
            productName: 'Product',
            quantity: 1,
            unitPrice: 60000000,
            currency: Currency.VND,
          },
        ],
      };

      jest.spyOn(reflector, 'get').mockReturnValue(false);
      jest.spyOn(prismaService.customer, 'findUnique').mockResolvedValue(mockCustomer as any);
      jest.spyOn(arService, 'getOverdueDebt').mockResolvedValue({
        total: 0,
        maxOverdueDays: 0,
        count: 0,
      });

      const context = createMockExecutionContext(dto);

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Hạn mức tín dụng'),
        }),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Công nợ hiện tại'),
        }),
      );
    });
  });
});
