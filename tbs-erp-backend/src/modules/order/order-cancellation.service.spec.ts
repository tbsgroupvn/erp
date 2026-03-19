import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderRepository } from './order.repository';
import { PrismaService } from '@core/database/prisma.service';
import { OrderStatusMachine } from './domain/order-status.machine';
import { OrderStatus, ServiceType } from '@prisma/client';
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
  totalAmount: new Decimal(5000000),
  depositPaid: new Decimal(0),
  depositRequired: new Decimal(5000000),
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

describe('OrderCancellationService', () => {
  let service: OrderCancellationService;
  let orderRepo: OrderRepository;
  let prisma: PrismaService;
  let statusMachine: OrderStatusMachine;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCancellationService,
        {
          provide: OrderRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue({ ...mockOrder }),
            updateStatus: jest.fn().mockResolvedValue({
              ...mockOrder,
              status: OrderStatus.CANCELLED,
            }),
            update: jest.fn().mockResolvedValue(mockOrder),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            approval: {
              create: jest.fn().mockResolvedValue({
                id: 'approval-001',
                type: 'ORDER_CANCEL',
                referenceId: 'order-001',
              }),
            },
          },
        },
        {
          provide: OrderStatusMachine,
          useValue: {
            canCancel: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderCancellationService>(OrderCancellationService);
    orderRepo = module.get<OrderRepository>(OrderRepository);
    prisma = module.get<PrismaService>(PrismaService);
    statusMachine = module.get<OrderStatusMachine>(OrderStatusMachine);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // cancelOrder
  // ─────────────────────────────────────────────────────────
  describe('cancelOrder', () => {
    it('should directly cancel a CONSULTING order with low value and emit order.cancelled', async () => {
      // CONSULTING status + totalAmount=5M (< 50M) => direct cancellation
      const result = await service.cancelOrder(
        'order-001',
        'Customer changed their mind about this order',
        'user-001',
      );

      expect(result.status).toBe('CANCELLED');

      // Status machine was checked
      expect(statusMachine.canCancel).toHaveBeenCalledWith(
        OrderStatus.CONSULTING,
      );

      // Status was updated to CANCELLED
      expect(orderRepo.updateStatus).toHaveBeenCalledWith(
        'order-001',
        OrderStatus.CONSULTING,
        OrderStatus.CANCELLED,
        'user-001',
        expect.stringContaining('Cancelled'),
        expect.objectContaining({ cancelReason: expect.any(String) }),
      );

      // Event was emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.cancelled',
        expect.objectContaining({
          orderId: 'order-001',
          cancelledBy: 'user-001',
          previousStatus: OrderStatus.CONSULTING,
        }),
      );
    });

    it('should throw NotFoundException when order is not found', async () => {
      (orderRepo.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.cancelOrder(
          'non-existent',
          'Valid reason for cancellation here',
          'user-001',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order status is non-cancellable', async () => {
      (orderRepo.findById as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.IN_TRANSIT,
      });

      (statusMachine.canCancel as jest.Mock).mockReturnValue(false);

      await expect(
        service.cancelOrder(
          'order-001',
          'Want to cancel this in-transit order',
          'user-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when reason is too short', async () => {
      await expect(
        service.cancelOrder('order-001', 'short', 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create approval record for high-value order (> 50M) even in early stage', async () => {
      // CONSULTING status but totalAmount > 50M => needs approval
      (orderRepo.findById as jest.Mock).mockResolvedValue({
        ...mockOrder,
        totalAmount: new Decimal(60000000),
      });

      const result = await service.cancelOrder(
        'order-001',
        'High value order cancellation request by customer',
        'user-001',
      );

      expect(result.status).toBe('PENDING_APPROVAL');
      expect((result as any).approvalId).toBe('approval-001');

      // Approval was created in the database
      expect(prisma.approval.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ORDER_CANCEL',
            referenceId: 'order-001',
            requestedBy: 'user-001',
          }),
        }),
      );

      // cancel.requested event emitted (not order.cancelled)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.cancel.requested',
        expect.objectContaining({
          orderId: 'order-001',
          approvalId: 'approval-001',
        }),
      );
    });
  });
});
