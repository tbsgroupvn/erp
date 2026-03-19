import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, ServiceType, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatusService } from '@modules/order/order-status.service';
import { OrderStatusMachine } from '@modules/order/domain/order-status.machine';
import { DepositGateService } from '@modules/order/domain/deposit-gate.service';
import { ORDER_LIFECYCLE } from '@common/constants/order-status.enum';

/**
 * Service-layer integration test for the Order lifecycle.
 *
 * Uses a REAL OrderStatusMachine and REAL DepositGateService to validate
 * that the full 13-status lifecycle (CONSULTING -> COMPLETED) is enforced
 * correctly through OrderStatusService.changeStatus().
 *
 * All database and event dependencies are mocked.
 *
 * Run: npx jest --testPathPattern="order-lifecycle" --no-coverage
 */
describe('Order Lifecycle Integration', () => {
  let service: OrderStatusService;
  let statusMachine: OrderStatusMachine;
  let depositGate: DepositGateService;

  // Mocks
  let mockOrderRepo: any;
  let mockPrisma: any;
  let mockEventEmitter: any;
  let mockTxEmitter: any;
  let mockCacheService: any;

  /**
   * Creates a mock order object with default fields for MHH service type.
   * Includes customer relation required by status change event emission.
   */
  function createMockOrder(overrides: Record<string, any> = {}) {
    return {
      id: 'order-1',
      code: 'ORD-001',
      status: OrderStatus.CONSULTING,
      serviceType: ServiceType.MHH,
      totalAmount: new Decimal(10_000_000),
      depositRequired: new Decimal(10_000_000),
      depositPaid: new Decimal(10_000_000),
      isDepositPaid: true,
      customerId: 'customer-1',
      saleId: 'sale-1',
      completedAt: null,
      customer: {
        id: 'customer-1',
        code: 'KH-001',
        fullName: 'Test Customer',
        companyName: 'Test Corp',
        tier: 'REGULAR',
        phone: '0901234567',
      },
      items: [],
      statusHistory: [],
      packages: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    // Real instances -- these are the core of what we're testing
    statusMachine = new OrderStatusMachine();
    mockPrisma = {};
    depositGate = new DepositGateService(mockPrisma as any);

    // Mocked dependencies
    mockOrderRepo = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockEventEmitter = { emit: jest.fn() };

    mockTxEmitter = {
      createCollector: jest.fn().mockReturnValue({
        emit: jest.fn(),
        flush: jest.fn(),
        discard: jest.fn(),
      }),
    };

    mockCacheService = {
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };

    // Instantiate the service with real FSM and real deposit gate
    service = new OrderStatusService(
      mockOrderRepo,
      mockPrisma as any,
      statusMachine,
      depositGate,
      mockEventEmitter,
      mockTxEmitter,
      mockCacheService,
    );
  });

  // -----------------------------------------------------------------------
  // Happy path: CONSULTING to COMPLETED (MHH)
  // -----------------------------------------------------------------------
  describe('Happy path: CONSULTING to COMPLETED (MHH)', () => {
    it('should drive an MHH order through all 13 lifecycle statuses', async () => {
      const userId = 'user-1';

      // For each transition, determine the correct role
      function getRoleForTransition(targetStatus: OrderStatus): UserRole {
        if (targetStatus === OrderStatus.SOURCING) return UserRole.ACCOUNTANT;
        if (targetStatus === OrderStatus.COMPLETED) return UserRole.WAREHOUSE_VN_MANAGER;
        return UserRole.CEO;
      }

      // Drive through all 12 transitions (13 statuses)
      for (let i = 0; i < ORDER_LIFECYCLE.length - 1; i++) {
        const fromStatus = ORDER_LIFECYCLE[i];
        const toStatus = ORDER_LIFECYCLE[i + 1];
        const role = getRoleForTransition(toStatus);

        const currentOrder = createMockOrder({ status: fromStatus });
        const updatedOrder = createMockOrder({ status: toStatus });

        mockOrderRepo.findById.mockResolvedValueOnce(currentOrder);
        mockOrderRepo.updateStatus.mockResolvedValueOnce(updatedOrder);

        await service.changeStatus('order-1', toStatus, userId, undefined, role);
      }

      // Verify all 12 transitions were executed
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledTimes(12);

      // Verify the last transition was to COMPLETED
      const lastCall = mockOrderRepo.updateStatus.mock.calls[11];
      expect(lastCall[2]).toBe(OrderStatus.COMPLETED);
    });

    it('should emit status.changed event for each transition', async () => {
      const fromStatus = OrderStatus.CONSULTING;
      const toStatus = OrderStatus.QUOTATION;

      mockOrderRepo.findById.mockResolvedValueOnce(createMockOrder({ status: fromStatus }));
      mockOrderRepo.updateStatus.mockResolvedValueOnce(createMockOrder({ status: toStatus }));

      await service.changeStatus('order-1', toStatus, 'user-1', undefined, UserRole.CEO);

      const collector = mockTxEmitter.createCollector();
      expect(collector.flush).toHaveBeenCalled();
    });

    it('should set completedAt when transitioning to COMPLETED', async () => {
      const fromStatus = OrderStatus.SETTLEMENT;
      const toStatus = OrderStatus.COMPLETED;

      mockOrderRepo.findById.mockResolvedValueOnce(createMockOrder({ status: fromStatus }));
      mockOrderRepo.updateStatus.mockResolvedValueOnce(createMockOrder({ status: toStatus }));

      await service.changeStatus('order-1', toStatus, 'user-1', undefined, UserRole.WAREHOUSE_VN_MANAGER);

      // Verify additionalData includes completedAt
      const updateCall = mockOrderRepo.updateStatus.mock.calls[0];
      expect(updateCall[5]).toHaveProperty('completedAt');
      expect(updateCall[5].completedAt).toBeInstanceOf(Date);
    });
  });

  // -----------------------------------------------------------------------
  // Deposit gate enforcement
  // -----------------------------------------------------------------------
  describe('Deposit gate enforcement', () => {
    it('should block MHH order with insufficient deposit from transitioning to SOURCING', async () => {
      const order = createMockOrder({
        status: OrderStatus.PENDING_DEPOSIT,
        depositPaid: new Decimal(0),
        depositRequired: new Decimal(10_000_000),
        isDepositPaid: false,
      });

      mockOrderRepo.findById.mockResolvedValueOnce(order);

      await expect(
        service.changeStatus('order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.ACCOUNTANT),
      ).rejects.toThrow(BadRequestException);

      // Verify updateStatus was NOT called
      expect(mockOrderRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should allow MHH order with sufficient deposit to transition to SOURCING', async () => {
      const order = createMockOrder({
        status: OrderStatus.PENDING_DEPOSIT,
        depositPaid: new Decimal(10_000_000),
        depositRequired: new Decimal(10_000_000),
        isDepositPaid: true,
      });

      const updated = createMockOrder({ status: OrderStatus.SOURCING });

      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      const result = await service.changeStatus(
        'order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.ACCOUNTANT,
      );

      expect(result.status).toBe(OrderStatus.SOURCING);
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('should allow VCT order to transition to SOURCING without deposit gate', async () => {
      // VCT orders skip the deposit step entirely; they go QUOTATION -> SOURCING
      const order = createMockOrder({
        status: OrderStatus.QUOTATION,
        serviceType: ServiceType.VCT,
        depositPaid: new Decimal(0),
        depositRequired: new Decimal(0),
        isDepositPaid: false,
      });

      const updated = createMockOrder({
        status: OrderStatus.SOURCING,
        serviceType: ServiceType.VCT,
      });

      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      const result = await service.changeStatus(
        'order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.ACCOUNTANT,
      );

      expect(result.status).toBe(OrderStatus.SOURCING);
    });

    it('should emit order.confirmed event when MHH order moves to SOURCING', async () => {
      const order = createMockOrder({
        status: OrderStatus.PENDING_DEPOSIT,
        totalAmount: new Decimal(10_000_000),
        depositPaid: new Decimal(5_000_000),
        depositRequired: new Decimal(5_000_000),
        isDepositPaid: true,
      });

      const updated = createMockOrder({ status: OrderStatus.SOURCING });

      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      await service.changeStatus(
        'order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.ACCOUNTANT,
      );

      // The collector.emit should have been called with 'order.confirmed'
      const collector = mockTxEmitter.createCollector.mock.results[0].value;
      const confirmedCalls = collector.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'order.confirmed',
      );
      expect(confirmedCalls.length).toBe(1);
      expect(confirmedCalls[0][1]).toMatchObject({
        orderId: 'order-1',
        totalAmount: 5_000_000, // 10M - 5M deposit paid
      });
    });
  });

  // -----------------------------------------------------------------------
  // Invalid transition rejection
  // -----------------------------------------------------------------------
  describe('Invalid transition rejection at service level', () => {
    it('should reject CONSULTING -> COMPLETED (skip not allowed)', async () => {
      mockOrderRepo.findById.mockResolvedValueOnce(
        createMockOrder({ status: OrderStatus.CONSULTING }),
      );

      await expect(
        service.changeStatus('order-1', OrderStatus.COMPLETED, 'user-1', undefined, UserRole.CEO),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject COMPLETED -> CONSULTING (backward jump not allowed)', async () => {
      mockOrderRepo.findById.mockResolvedValueOnce(
        createMockOrder({ status: OrderStatus.COMPLETED }),
      );

      await expect(
        service.changeStatus('order-1', OrderStatus.CONSULTING, 'user-1', undefined, UserRole.CEO),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject any transition from CANCELLED', async () => {
      mockOrderRepo.findById.mockResolvedValueOnce(
        createMockOrder({ status: OrderStatus.CANCELLED }),
      );

      await expect(
        service.changeStatus('order-1', OrderStatus.CONSULTING, 'user-1', undefined, UserRole.CEO),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow COMPLETED -> SETTLEMENT (reopen by BGD)', async () => {
      const order = createMockOrder({ status: OrderStatus.COMPLETED });
      const updated = createMockOrder({ status: OrderStatus.SETTLEMENT });

      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      const result = await service.changeStatus(
        'order-1', OrderStatus.SETTLEMENT, 'user-1', undefined, UserRole.CEO,
      );

      expect(result.status).toBe(OrderStatus.SETTLEMENT);
    });
  });

  // -----------------------------------------------------------------------
  // Role restriction enforcement
  // -----------------------------------------------------------------------
  describe('Role restriction enforcement', () => {
    it('should reject SALE role from transitioning to SOURCING', async () => {
      mockOrderRepo.findById.mockResolvedValueOnce(
        createMockOrder({ status: OrderStatus.PENDING_DEPOSIT }),
      );

      await expect(
        service.changeStatus('order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.SALE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ACCOUNTANT role to transition to SOURCING', async () => {
      const order = createMockOrder({ status: OrderStatus.PENDING_DEPOSIT });
      const updated = createMockOrder({ status: OrderStatus.SOURCING });

      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      const result = await service.changeStatus(
        'order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.ACCOUNTANT,
      );

      expect(result.status).toBe(OrderStatus.SOURCING);
    });

    it('should reject SALE role from transitioning to COMPLETED', async () => {
      mockOrderRepo.findById.mockResolvedValueOnce(
        createMockOrder({ status: OrderStatus.SETTLEMENT }),
      );

      await expect(
        service.changeStatus('order-1', OrderStatus.COMPLETED, 'user-1', undefined, UserRole.SALE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow WAREHOUSE_VN_MANAGER role to transition to COMPLETED', async () => {
      const order = createMockOrder({ status: OrderStatus.SETTLEMENT });
      const updated = createMockOrder({ status: OrderStatus.COMPLETED });

      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      const result = await service.changeStatus(
        'order-1', OrderStatus.COMPLETED, 'user-1', undefined, UserRole.WAREHOUSE_VN_MANAGER,
      );

      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('should allow CHIEF_ACCOUNTANT role to transition to SOURCING', async () => {
      const order = createMockOrder({ status: OrderStatus.PENDING_DEPOSIT });
      const updated = createMockOrder({ status: OrderStatus.SOURCING });

      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      const result = await service.changeStatus(
        'order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.CHIEF_ACCOUNTANT,
      );

      expect(result.status).toBe(OrderStatus.SOURCING);
    });

    it('should allow CEO to transition to any restricted status', async () => {
      // SOURCING
      let order = createMockOrder({ status: OrderStatus.PENDING_DEPOSIT });
      let updated = createMockOrder({ status: OrderStatus.SOURCING });
      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      await service.changeStatus(
        'order-1', OrderStatus.SOURCING, 'user-1', undefined, UserRole.CEO,
      );

      // COMPLETED
      order = createMockOrder({ status: OrderStatus.SETTLEMENT });
      updated = createMockOrder({ status: OrderStatus.COMPLETED });
      mockOrderRepo.findById.mockResolvedValueOnce(order);
      mockOrderRepo.updateStatus.mockResolvedValueOnce(updated);

      await service.changeStatus(
        'order-1', OrderStatus.COMPLETED, 'user-1', undefined, UserRole.CEO,
      );

      expect(mockOrderRepo.updateStatus).toHaveBeenCalledTimes(2);
    });
  });
});
