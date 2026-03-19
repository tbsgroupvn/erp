import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  PaymentVoucherValidator,
  VoucherValidationInput,
} from './payment-voucher.validator';
import { PrismaService } from '@core/database/prisma.service';
import { CashFlowGuardService } from './cash-flow-guard.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('PaymentVoucherValidator', () => {
  let validator: PaymentVoucherValidator;
  let prismaService: PrismaService;

  const mockOrder = {
    id: 'order-1',
    status: 'SOURCING',
    saleId: 'sale-user-1',
    totalAmount: new Decimal(10000000), // 10M VND
    code: 'TBS-DH-001',
  };

  const validPaymentInput: VoucherValidationInput = {
    type: 'PAYMENT',
    orderId: 'order-1',
    amount: 5000000, // 5M VND (50% of order revenue)
    reason: 'Thanh toan cho nha cung cap hang hoa dot 1',
    beneficiary: 'NCC ABC Company',
    costType: 'SUPPLIER_PAYMENT',
    attachments: ['invoice-001.pdf'],
    createdBy: 'user-1',
    createdByRole: 'ACCOUNTANT',
    createdAt: new Date(2026, 2, 19, 10, 0, 0), // 10:00 AM business hours
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentVoucherValidator,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findUnique: jest.fn().mockResolvedValue(mockOrder),
            },
            paymentVoucher: {
              count: jest.fn().mockResolvedValue(0),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: any) => {
              const configMap: Record<string, any> = {
                'business.antifraud.expensePercentThreshold': 0.9,
                'business.antifraud.miscExpenseThreshold': 5000000,
                'business.antifraud.maxVouchersPerDay': 5,
                'business.antifraud.minReasonLength': 20,
                'business.antifraud.businessHoursStart': 7,
                'business.antifraud.businessHoursEnd': 19,
              };
              return configMap[key] ?? defaultVal;
            }),
          },
        },
        {
          provide: CashFlowGuardService,
          useValue: {
            validateSupplierPayment: jest.fn().mockResolvedValue({
              allowed: true,
              alertLevel: 'OK',
            }),
          },
        },
      ],
    }).compile();

    validator = module.get<PaymentVoucherValidator>(PaymentVoucherValidator);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== BLOCK CHECKS ====================

  describe('BLOCK rules for PAYMENT type', () => {
    it('should block PAYMENT voucher with empty orderId', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        orderId: '',
      };

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Missing orderId'),
        ]),
      );
    });

    it('should block PAYMENT voucher referencing COMPLETED order', async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      const result = await validator.validate(validPaymentInput);

      expect(result.isBlocked).toBe(true);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('COMPLETED'),
        ]),
      );
    });

    it('should block PAYMENT voucher referencing CANCELLED order', async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      const result = await validator.validate(validPaymentInput);

      expect(result.isBlocked).toBe(true);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CANCELLED'),
        ]),
      );
    });

    it('should block PAYMENT voucher with empty attachments array', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        attachments: [],
      };

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(true);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Missing attachments'),
        ]),
      );
    });

    it('should block PAYMENT voucher with reason shorter than 20 characters', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        reason: 'Too short',
      };

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(true);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Reason must be at least'),
        ]),
      );
    });

    it('should block PAYMENT voucher with empty beneficiary', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        beneficiary: '',
      };

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(true);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Missing beneficiary'),
        ]),
      );
    });

    it('should block PAYMENT voucher with empty costType', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        costType: '',
      };

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(true);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Missing cost type'),
        ]),
      );
    });
  });

  // ==================== RECEIPT OWNERSHIP ====================

  describe('RECEIPT voucher ownership checks', () => {
    it('should block RECEIPT voucher by non-owner non-finance user', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        type: 'RECEIPT',
        createdBy: 'random-user-99',
        createdByRole: 'SALE',
      };

      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        saleId: 'sale-user-1', // Not matching random-user-99
        code: 'TBS-DH-001',
      });

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(true);
      expect(result.blockReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Sale'),
        ]),
      );
    });

    it('should allow RECEIPT voucher by sale owner', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        type: 'RECEIPT',
        createdBy: 'sale-user-1', // Matches order.saleId
        createdByRole: 'SALE',
      };

      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        saleId: 'sale-user-1',
      });

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it('should allow RECEIPT voucher by CHIEF_ACCOUNTANT role', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        type: 'RECEIPT',
        createdBy: 'accountant-user-1', // Not the sale owner
        createdByRole: 'CHIEF_ACCOUNTANT',
      };

      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        saleId: 'sale-user-1', // Different from createdBy
      });

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(false);
      expect(result.isValid).toBe(true);
    });

    it('should allow RECEIPT voucher by CFO role', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        type: 'RECEIPT',
        createdBy: 'cfo-user-1',
        createdByRole: 'CFO',
      };

      (prismaService.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        saleId: 'sale-user-1',
      });

      const result = await validator.validate(input);

      expect(result.isBlocked).toBe(false);
      expect(result.isValid).toBe(true);
    });
  });

  // ==================== FLAG CHECKS ====================

  describe('FLAG rules for PAYMENT type', () => {
    it('should flag PAYMENT amount > 90% of order revenue', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        amount: 9500000, // 9.5M > 90% of 10M
      };

      const result = await validator.validate(input);

      expect(result.isFlagged).toBe(true);
      expect(result.flagReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('90%'),
        ]),
      );
    });

    it('should flag PAYMENT with "phat sinh" reason exceeding threshold', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        reason: 'Chi phi phat sinh cho viec van chuyen hang hoa bo sung',
        amount: 6000000, // 6M > 5M threshold
      };

      const result = await validator.validate(input);

      expect(result.isFlagged).toBe(true);
      expect(result.flagReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('ph\u00e1t sinh'),
        ]),
      );
    });

    it('should flag when creator has >= maxVouchersPerDay in last 24h', async () => {
      (prismaService.paymentVoucher.count as jest.Mock).mockResolvedValue(5); // Exactly at limit

      const result = await validator.validate(validPaymentInput);

      expect(result.isFlagged).toBe(true);
      expect(result.flagReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('payment vouchers'),
        ]),
      );
    });

    it('should flag voucher created outside business hours', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        createdAt: new Date(2026, 2, 19, 22, 0, 0), // 10:00 PM - outside 7-19
      };

      const result = await validator.validate(input);

      expect(result.isFlagged).toBe(true);
      expect(result.flagReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('outside business hours'),
        ]),
      );
    });

    it('should flag voucher created before business hours start', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        createdAt: new Date(2026, 2, 19, 5, 30, 0), // 5:30 AM - before 7:00
      };

      const result = await validator.validate(input);

      expect(result.isFlagged).toBe(true);
      expect(result.flagReasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('outside business hours'),
        ]),
      );
    });
  });

  // ==================== VALID SCENARIOS ====================

  describe('Valid voucher scenarios', () => {
    it('should allow valid PAYMENT voucher with all fields correct', async () => {
      const result = await validator.validate(validPaymentInput);

      expect(result.isValid).toBe(true);
      expect(result.isBlocked).toBe(false);
      expect(result.isFlagged).toBe(false);
      expect(result.blockReasons).toHaveLength(0);
      expect(result.flagReasons).toHaveLength(0);
    });

    it('should return valid immediately for non-PAYMENT non-RECEIPT type', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        type: 'TRANSFER',
        orderId: '',
      };

      const result = await validator.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.isBlocked).toBe(false);
      expect(result.isFlagged).toBe(false);
    });

    it('should not flag PAYMENT amount <= 90% of order revenue', async () => {
      const input: VoucherValidationInput = {
        ...validPaymentInput,
        amount: 8000000, // 8M = 80% of 10M, below 90%
      };

      const result = await validator.validate(input);

      expect(result.isFlagged).toBe(false);
    });
  });
});
