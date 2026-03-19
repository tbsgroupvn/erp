import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContainerStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ContainerService } from '@modules/container/container.service';
import { ContainerStatusMachine } from '@modules/container/domain/container-status.machine';

/**
 * Service-layer integration test for the Container lifecycle.
 *
 * Uses a REAL ContainerStatusMachine to validate that the full container
 * lifecycle (PLANNING -> COMPLETED) is enforced correctly through
 * ContainerService.updateStatus().
 *
 * All database and event dependencies are mocked.
 *
 * Run: npx jest --testPathPattern="container-lifecycle" --no-coverage --testPathIgnorePatterns='[]'
 */
describe('Container Lifecycle Integration', () => {
  let service: ContainerService;
  let statusMachine: ContainerStatusMachine;

  // Mocks
  let mockContainerRepo: any;
  let mockConsolidation: any;
  let mockPrisma: any;
  let mockTx: any;
  let mockEventEmitter: any;
  let mockTxEmitter: any;
  let mockCacheService: any;

  /**
   * Creates a mock container object with default fields.
   * Includes all fields read by updateStatus() for event emission.
   */
  function createMockContainer(overrides: Record<string, any> = {}) {
    return {
      id: 'container-1',
      code: 'CONT-001',
      status: ContainerStatus.PLANNING,
      shippingRoute: 'CN-VN',
      totalPackages: 10,
      totalWeight: new Decimal(500),
      maxCapacity: new Decimal(1000),
      fillRate: new Decimal(50),
      origin: 'Guangzhou',
      destination: 'HCMC',
      carrier: 'COSCO',
      bookingRef: 'BK-001',
      sealNumber: null,
      vesselName: 'Ever Green',
      estimatedDepartureAt: null,
      estimatedArrivalAt: null,
      actualDepartureAt: null,
      actualArrivalAt: null,
      customsClearedAt: null,
      portOfDischarge: 'Cat Lai',
      createdBy: 'user-1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ...overrides,
    };
  }

  beforeEach(() => {
    // Real FSM instance -- the core of what we're testing
    statusMachine = new ContainerStatusMachine();

    // Mock transaction object used by executeInTransaction
    mockTx = {
      container: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    // Mock PrismaService
    mockPrisma = {
      executeInTransaction: jest.fn().mockImplementation(async (callback: any) => callback(mockTx)),
    };

    // Mock dependencies not used by updateStatus()
    mockContainerRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      generateContainerCode: jest.fn(),
    };

    mockConsolidation = {
      calculateOptimalFill: jest.fn(),
      suggestContainerPlan: jest.fn(),
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
      invalidateByPrefix: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn(),
    };

    // Instantiate the service with real ContainerStatusMachine
    service = new ContainerService(
      mockContainerRepo,
      mockConsolidation,
      statusMachine,
      mockPrisma as any,
      mockEventEmitter,
      mockTxEmitter,
      mockCacheService,
    );
  });

  // -----------------------------------------------------------------------
  // Happy path: PLANNING to COMPLETED
  // -----------------------------------------------------------------------
  describe('Happy path: PLANNING to COMPLETED', () => {
    const MAIN_LIFECYCLE: ContainerStatus[] = [
      ContainerStatus.PLANNING,
      ContainerStatus.LOADING,
      ContainerStatus.IN_TRANSIT,
      ContainerStatus.ARRIVED,
      ContainerStatus.CUSTOMS,
      ContainerStatus.COMPLETED,
    ];

    it('should drive a container through all 6 main lifecycle statuses', async () => {
      const userId = 'user-1';

      for (let i = 0; i < MAIN_LIFECYCLE.length - 1; i++) {
        const fromStatus = MAIN_LIFECYCLE[i];
        const toStatus = MAIN_LIFECYCLE[i + 1];

        const currentContainer = createMockContainer({ status: fromStatus });
        const updatedContainer = createMockContainer({ status: toStatus });

        mockTx.container.findUnique.mockResolvedValueOnce(currentContainer);
        mockTx.container.update.mockResolvedValueOnce(updatedContainer);

        await service.updateStatus('container-1', toStatus, userId);
      }

      // Verify all 5 transitions were executed
      expect(mockTx.container.update).toHaveBeenCalledTimes(5);
    });

    it('should set actualDepartureAt when transitioning to IN_TRANSIT', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.LOADING }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );

      await service.updateStatus('container-1', 'IN_TRANSIT', 'user-1');

      const updateCall = mockTx.container.update.mock.calls[0][0];
      expect(updateCall.data.actualDepartureAt).toBeInstanceOf(Date);
    });

    it('should set actualArrivalAt when transitioning to ARRIVED', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ARRIVED }),
      );

      await service.updateStatus('container-1', 'ARRIVED', 'user-1');

      const updateCall = mockTx.container.update.mock.calls[0][0];
      expect(updateCall.data.actualArrivalAt).toBeInstanceOf(Date);
    });

    it('should set customsClearedAt when transitioning to COMPLETED', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.COMPLETED }),
      );

      await service.updateStatus('container-1', 'COMPLETED', 'user-1');

      const updateCall = mockTx.container.update.mock.calls[0][0];
      expect(updateCall.data.customsClearedAt).toBeInstanceOf(Date);
    });

    it('should emit container.status.changed event for each transition', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.PLANNING }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.LOADING }),
      );

      await service.updateStatus('container-1', 'LOADING', 'user-1');

      const collector = mockTxEmitter.createCollector.mock.results[0].value;
      const statusChangedCalls = collector.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'container.status.changed',
      );
      expect(statusChangedCalls.length).toBe(1);
      expect(statusChangedCalls[0][1]).toMatchObject({
        containerId: 'container-1',
        fromStatus: ContainerStatus.PLANNING,
        toStatus: 'LOADING',
      });
    });

    it('should emit container.arrived event when transitioning to ARRIVED', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ARRIVED }),
      );

      await service.updateStatus('container-1', 'ARRIVED', 'user-1');

      const collector = mockTxEmitter.createCollector.mock.results[0].value;
      const arrivedCalls = collector.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'container.arrived',
      );
      expect(arrivedCalls.length).toBe(1);
    });

    it('should emit container.departed event when transitioning to IN_TRANSIT', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.LOADING }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );

      await service.updateStatus('container-1', 'IN_TRANSIT', 'user-1');

      const collector = mockTxEmitter.createCollector.mock.results[0].value;
      const departedCalls = collector.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'container.departed',
      );
      expect(departedCalls.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // ON_HOLD_BORDER scenario
  // -----------------------------------------------------------------------
  describe('ON_HOLD_BORDER scenario', () => {
    it('should allow IN_TRANSIT -> ON_HOLD_BORDER -> IN_TRANSIT -> ARRIVED flow', async () => {
      const userId = 'user-1';

      // Step 1: IN_TRANSIT -> ON_HOLD_BORDER
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ON_HOLD_BORDER }),
      );
      await service.updateStatus('container-1', 'ON_HOLD_BORDER', userId);

      // Step 2: ON_HOLD_BORDER -> IN_TRANSIT (resume)
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ON_HOLD_BORDER }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );
      await service.updateStatus('container-1', 'IN_TRANSIT', userId);

      // Step 3: IN_TRANSIT -> ARRIVED
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ARRIVED }),
      );
      await service.updateStatus('container-1', 'ARRIVED', userId);

      expect(mockTx.container.update).toHaveBeenCalledTimes(3);
    });

    it('should allow ON_HOLD_BORDER -> ARRIVED (skip resume, go direct)', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ON_HOLD_BORDER }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ARRIVED }),
      );

      await service.updateStatus('container-1', 'ARRIVED', 'user-1');

      expect(mockTx.container.update).toHaveBeenCalledTimes(1);
    });

    it('should emit container.on_hold_border event when transitioning to ON_HOLD_BORDER', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.IN_TRANSIT }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ON_HOLD_BORDER }),
      );
      mockTx.order.groupBy.mockResolvedValueOnce([
        { customerId: 'cust-1' },
        { customerId: 'cust-2' },
      ]);

      await service.updateStatus('container-1', 'ON_HOLD_BORDER', 'user-1');

      const collector = mockTxEmitter.createCollector.mock.results[0].value;
      const holdCalls = collector.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'container.on_hold_border',
      );
      expect(holdCalls.length).toBe(1);
      expect(holdCalls[0][1]).toMatchObject({
        containerId: 'container-1',
        customerIds: ['cust-1', 'cust-2'],
      });
    });
  });

  // -----------------------------------------------------------------------
  // CUSTOMS_HOLD scenario
  // -----------------------------------------------------------------------
  describe('CUSTOMS_HOLD scenario', () => {
    it('should allow CUSTOMS -> CUSTOMS_HOLD -> CUSTOMS -> COMPLETED flow', async () => {
      const userId = 'user-1';

      // Step 1: CUSTOMS -> CUSTOMS_HOLD
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS_HOLD }),
      );
      await service.updateStatus('container-1', 'CUSTOMS_HOLD', userId);

      // Step 2: CUSTOMS_HOLD -> CUSTOMS (resume)
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS_HOLD }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS }),
      );
      await service.updateStatus('container-1', 'CUSTOMS', userId);

      // Step 3: CUSTOMS -> COMPLETED
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.COMPLETED }),
      );
      await service.updateStatus('container-1', 'COMPLETED', userId);

      expect(mockTx.container.update).toHaveBeenCalledTimes(3);
    });

    it('should allow CUSTOMS_HOLD -> COMPLETED directly (all holds resolved)', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS_HOLD }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.COMPLETED }),
      );

      await service.updateStatus('container-1', 'COMPLETED', 'user-1');

      const updateCall = mockTx.container.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('COMPLETED');
      expect(updateCall.data.customsClearedAt).toBeInstanceOf(Date);
    });

    it('should emit container.customs.started event when transitioning to CUSTOMS', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.ARRIVED }),
      );
      mockTx.container.update.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.CUSTOMS }),
      );

      await service.updateStatus('container-1', 'CUSTOMS', 'user-1');

      const collector = mockTxEmitter.createCollector.mock.results[0].value;
      const customsCalls = collector.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'container.customs.started',
      );
      expect(customsCalls.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Invalid transition rejection
  // -----------------------------------------------------------------------
  describe('Invalid transition rejection at service level', () => {
    it('should reject PLANNING -> COMPLETED (skip not allowed)', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.PLANNING }),
      );

      await expect(
        service.updateStatus('container-1', 'COMPLETED', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject COMPLETED -> PLANNING (backward jump not allowed)', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.COMPLETED }),
      );

      await expect(
        service.updateStatus('container-1', 'PLANNING', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject LOADING -> CUSTOMS (skipping IN_TRANSIT and ARRIVED)', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.LOADING }),
      );

      await expect(
        service.updateStatus('container-1', 'CUSTOMS', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PLANNING -> IN_TRANSIT (must go through LOADING first)', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(
        createMockContainer({ status: ContainerStatus.PLANNING }),
      );

      await expect(
        service.updateStatus('container-1', 'IN_TRANSIT', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent container', async () => {
      mockTx.container.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateStatus('non-existent', 'LOADING', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
