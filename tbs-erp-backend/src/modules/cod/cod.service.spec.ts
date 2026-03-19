import { CodService } from './cod.service';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { CODStatus } from '@prisma/client';

// Mock calculateBusinessHoursDeadline to control deadline output in tests
jest.mock('@common/utils/business-hours', () => ({
  calculateBusinessHoursDeadline: jest.fn(),
}));

import { calculateBusinessHoursDeadline } from '@common/utils/business-hours';

const mockedCalcDeadline = calculateBusinessHoursDeadline as jest.MockedFunction<
  typeof calculateBusinessHoursDeadline
>;

describe('CodService', () => {
  let service: CodService;
  let prisma: any;
  let eventEmitter: any;
  let configService: any;

  beforeEach(() => {
    prisma = {
      cODRecord: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      driver: {
        updateMany: jest.fn(),
      },
    };

    eventEmitter = { emit: jest.fn() };

    configService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'business.cod.enforcementHours') return 24;
        if (key === 'business.businessHours') {
          return {
            workStart: 8,
            workEnd: 17,
            weekends: [0, 6],
            holidays: [],
          };
        }
        return defaultVal;
      }),
    };

    service = new CodService(
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('enforceCODReconciliation', () => {
    it('should not block any drivers when no overdue records exist', async () => {
      prisma.cODRecord.findMany.mockResolvedValue([]);

      await service.enforceCODReconciliation();

      expect(prisma.driver.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should block drivers with overdue COLLECTED records', async () => {
      const collectedAt = new Date('2026-03-17T10:00:00Z');
      // Deadline is in the past -> record is overdue
      const pastDeadline = new Date('2026-03-18T10:00:00Z');
      mockedCalcDeadline.mockReturnValue(pastDeadline);

      prisma.cODRecord.findMany.mockResolvedValue([
        {
          id: 'cod-1',
          driverId: 'driver-1',
          deliveryId: 'delivery-1',
          collectedAmount: 500000,
          collectedAt,
        },
        {
          id: 'cod-2',
          driverId: 'driver-2',
          deliveryId: 'delivery-2',
          collectedAmount: 300000,
          collectedAt,
        },
      ]);
      prisma.driver.updateMany.mockResolvedValue({ count: 2 });

      await service.enforceCODReconciliation();

      expect(prisma.driver.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: expect.arrayContaining(['driver-1', 'driver-2']) },
          isCODBlocked: false,
        },
        data: {
          isCODBlocked: true,
          codBlockedAt: expect.any(Date),
        },
      });
    });

    it('should emit cod.enforcement.blocked event with driver IDs', async () => {
      const collectedAt = new Date('2026-03-17T10:00:00Z');
      const pastDeadline = new Date('2026-03-18T10:00:00Z');
      mockedCalcDeadline.mockReturnValue(pastDeadline);

      prisma.cODRecord.findMany.mockResolvedValue([
        {
          id: 'cod-1',
          driverId: 'driver-1',
          deliveryId: 'delivery-1',
          collectedAmount: 500000,
          collectedAt,
        },
      ]);
      prisma.driver.updateMany.mockResolvedValue({ count: 1 });

      await service.enforceCODReconciliation();

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cod.enforcement.blocked',
        expect.objectContaining({
          driverIds: ['driver-1'],
          overdueRecordCount: 1,
        }),
      );
    });

    it('should only update drivers that are not already blocked (isCODBlocked: false filter)', async () => {
      const collectedAt = new Date('2026-03-17T10:00:00Z');
      const pastDeadline = new Date('2026-03-18T10:00:00Z');
      mockedCalcDeadline.mockReturnValue(pastDeadline);

      prisma.cODRecord.findMany.mockResolvedValue([
        {
          id: 'cod-1',
          driverId: 'driver-1',
          deliveryId: 'delivery-1',
          collectedAmount: 200000,
          collectedAt,
        },
      ]);
      prisma.driver.updateMany.mockResolvedValue({ count: 0 }); // already blocked

      await service.enforceCODReconciliation();

      // Verify the where clause includes isCODBlocked: false
      expect(prisma.driver.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isCODBlocked: false,
          }),
        }),
      );
    });
  });
});
