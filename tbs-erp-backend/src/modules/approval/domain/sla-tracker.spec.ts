import { SlaTracker } from './sla-tracker';
import { ApprovalStatus } from '@prisma/client';

/**
 * Unit tests for SlaTracker.
 * Tests overdue step detection and deadline calculation.
 */
describe('SlaTracker', () => {
  let tracker: SlaTracker;
  let mockPrisma: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    mockPrisma = {
      approvalStep: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    // Manually instantiate with mocked deps
    tracker = new SlaTracker(mockPrisma, mockEventEmitter);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('checkOverdueSteps', () => {
    it('should not emit events or update when no overdue steps found', async () => {
      mockPrisma.approvalStep.findMany.mockResolvedValue([]);

      await tracker.checkOverdueSteps();

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      expect(mockPrisma.approvalStep.update).not.toHaveBeenCalled();
    });

    it('should mark overdue steps and emit approval.step.overdue for each', async () => {
      const pastDeadline = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      const overdueSteps = [
        {
          id: 'step-1',
          approvalId: 'approval-1',
          stepNumber: 1,
          approverRole: 'ACCOUNTANT',
          assignedUserId: 'user-1',
          deadlineAt: pastDeadline,
          status: ApprovalStatus.PENDING,
          isOverdue: false,
          approval: {
            id: 'approval-1',
            type: 'PAYMENT_VOUCHER',
            referenceId: 'ref-1',
            referenceCode: 'PV-001',
          },
        },
        {
          id: 'step-2',
          approvalId: 'approval-2',
          stepNumber: 2,
          approverRole: 'SALES_DIRECTOR',
          assignedUserId: null,
          deadlineAt: pastDeadline,
          status: ApprovalStatus.PENDING,
          isOverdue: false,
          approval: {
            id: 'approval-2',
            type: 'QUOTATION',
            referenceId: 'ref-2',
            referenceCode: 'QT-002',
          },
        },
      ];

      mockPrisma.approvalStep.findMany.mockResolvedValue(overdueSteps);
      mockPrisma.approvalStep.update.mockResolvedValue({});

      await tracker.checkOverdueSteps();

      // Should update both steps
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: { isOverdue: true },
      });
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: 'step-2' },
        data: { isOverdue: true },
      });

      // Should emit for each step
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'approval.step.overdue',
        expect.objectContaining({
          approvalId: 'approval-1',
          stepId: 'step-1',
          stepNumber: 1,
          approverRole: 'ACCOUNTANT',
          assignedUserId: 'user-1',
          deadlineAt: pastDeadline,
          type: 'PAYMENT_VOUCHER',
          referenceId: 'ref-1',
          referenceCode: 'PV-001',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'approval.step.overdue',
        expect.objectContaining({
          approvalId: 'approval-2',
          stepId: 'step-2',
          stepNumber: 2,
          approverRole: 'SALES_DIRECTOR',
        }),
      );
    });

    it('should only query for steps with isOverdue=false (excludes already overdue)', async () => {
      mockPrisma.approvalStep.findMany.mockResolvedValue([]);

      await tracker.checkOverdueSteps();

      // Verify the query filters for isOverdue: false
      expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ApprovalStatus.PENDING,
            isOverdue: false,
          }),
        }),
      );
    });
  });

  describe('calculateDeadline', () => {
    it('should return correct date for given hours', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const result = tracker.calculateDeadline(4);

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBe(now + 4 * 60 * 60 * 1000);
    });

    it('should return null for null input', () => {
      const result = tracker.calculateDeadline(null);
      expect(result).toBeNull();
    });

    it('should return null for 0 input', () => {
      const result = tracker.calculateDeadline(0);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = tracker.calculateDeadline(undefined);
      expect(result).toBeNull();
    });
  });
});
