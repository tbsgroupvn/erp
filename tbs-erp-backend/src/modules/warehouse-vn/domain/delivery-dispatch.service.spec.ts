import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeliveryDispatchService } from './delivery-dispatch.service';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';

describe('DeliveryDispatchService', () => {
  let service: DeliveryDispatchService;
  let prisma: any;
  let eventEmitter: any;

  const mockDriver = {
    id: 'driver-1',
    fullName: 'Nguyen Van A',
    isCODBlocked: false,
  };

  const mockDeliveries = [
    { id: 'delivery-1', orderId: 'order-1' },
    { id: 'delivery-2', orderId: 'order-1' },
  ];

  const mockOrderWithCustomer = (overrides: Record<string, any> = {}) => ({
    id: 'order-1',
    code: 'TBS-DH-000001',
    totalAmount: new Decimal(10000000),
    customer: {
      id: 'customer-1',
      creditLimit: new Decimal(100000000),
      currentDebt: new Decimal(5000000),
      tempOverdraftLimit: null,
      tempOverdraftExpiry: null,
      gracePeriodUntil: null,
      isBlocked: false,
      blockReason: null,
      ...overrides,
    },
  });

  beforeEach(() => {
    prisma = {
      driver: { findUnique: jest.fn() },
      delivery: { findMany: jest.fn(), updateMany: jest.fn() },
      order: { findMany: jest.fn() },
      paymentAllocation: { aggregate: jest.fn() },
    };
    eventEmitter = { emit: jest.fn() };

    service = new DeliveryDispatchService(
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignDriver', () => {
    it('should throw NotFoundException when driver does not exist', async () => {
      prisma.driver.findUnique.mockResolvedValue(null);

      await expect(
        service.assignDriver(['delivery-1'], 'nonexistent-driver'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when driver isCODBlocked', async () => {
      prisma.driver.findUnique.mockResolvedValue({
        ...mockDriver,
        isCODBlocked: true,
      });

      await expect(
        service.assignDriver(['delivery-1'], 'driver-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.assignDriver(['delivery-1'], 'driver-1'),
      ).rejects.toThrow(/COD/);
    });

    it('should throw ForbiddenException when customer isBlocked (DAT-09)', async () => {
      prisma.driver.findUnique.mockResolvedValue(mockDriver);
      prisma.delivery.findMany.mockResolvedValue(mockDeliveries);
      prisma.order.findMany.mockResolvedValue([
        mockOrderWithCustomer({
          isBlocked: true,
          blockReason: 'Cong no qua han 90 ngay',
        }),
      ]);

      await expect(
        service.assignDriver(['delivery-1', 'delivery-2'], 'driver-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.assignDriver(['delivery-1', 'delivery-2'], 'driver-1'),
      ).rejects.toThrow(/chan do cong no/);
    });

    it('should proceed normally when customer isBlocked is false', async () => {
      prisma.driver.findUnique.mockResolvedValue(mockDriver);
      prisma.delivery.findMany.mockResolvedValue(mockDeliveries);
      prisma.order.findMany.mockResolvedValue([
        mockOrderWithCustomer({ isBlocked: false }),
      ]);
      prisma.paymentAllocation.aggregate.mockResolvedValue({
        _sum: { allocatedAmount: new Decimal(10000000) },
      });
      prisma.delivery.updateMany.mockResolvedValue({ count: 2 });

      await service.assignDriver(['delivery-1', 'delivery-2'], 'driver-1');

      expect(prisma.delivery.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['delivery-1', 'delivery-2'] } },
        data: {
          driverId: 'driver-1',
          vehicleId: undefined,
          status: 'DISPATCHED',
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'delivery.driver.assigned',
        expect.objectContaining({
          deliveryIds: ['delivery-1', 'delivery-2'],
          driverId: 'driver-1',
        }),
      );
    });

    it('should dispatch deliveries when driver is valid, customer not blocked, and order fully paid', async () => {
      prisma.driver.findUnique.mockResolvedValue(mockDriver);
      prisma.delivery.findMany.mockResolvedValue([
        { id: 'delivery-1', orderId: 'order-1' },
      ]);
      prisma.order.findMany.mockResolvedValue([
        mockOrderWithCustomer({ isBlocked: false }),
      ]);
      // Order is fully paid (allocated >= totalAmount)
      prisma.paymentAllocation.aggregate.mockResolvedValue({
        _sum: { allocatedAmount: new Decimal(10000000) },
      });
      prisma.delivery.updateMany.mockResolvedValue({ count: 1 });

      await service.assignDriver(['delivery-1'], 'driver-1', 'vehicle-1');

      expect(prisma.delivery.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['delivery-1'] } },
        data: {
          driverId: 'driver-1',
          vehicleId: 'vehicle-1',
          status: 'DISPATCHED',
        },
      });
    });
  });
});
