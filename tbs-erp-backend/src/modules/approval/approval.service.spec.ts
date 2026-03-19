import { ApprovalService } from './approval.service';
import { ApprovalStatus } from '@prisma/client';

/**
 * Unit tests for ApprovalService.checkOverdueApprovals
 * Tests the cron-based overdue detection and escalation event emission.
 */
describe('ApprovalService', () => {
  let service: ApprovalService;
  let mockPrisma: any;
  let mockEventEmitter: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      approval: {
        findMany: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      approvalStep: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
      approvalActionLog: {
        create: jest.fn(),
      },
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: number) => {
        if (key === 'business.approval.escalateAfterHours') return 24;
        return defaultVal;
      }),
    };

    // Manually construct ApprovalService with all deps mocked
    service = new ApprovalService(
      {} as any, // graphEngine
      {} as any, // approvalRepository
      {} as any, // flowDefRepo
      {} as any, // delegationService
      mockConfigService,
      mockEventEmitter,
      mockPrisma,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('checkOverdueApprovals', () => {
    it('should not emit any events when no overdue approvals found', async () => {
      mockPrisma.approval.findMany.mockResolvedValue([]);

      await service.checkOverdueApprovals();

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      expect(mockPrisma.approvalStep.update).not.toHaveBeenCalled();
    });

    it('should emit approval.overdue but NOT approval.escalated for 1x threshold breach', async () => {
      // 25 hours ago = past 1x threshold (24h) but NOT past 2x threshold (48h)
      const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

      const mockApproval = {
        id: 'approval-1',
        type: 'PAYMENT_VOUCHER',
        referenceId: 'ref-1',
        referenceCode: 'PV-001',
        currentStep: 1,
        status: ApprovalStatus.PENDING,
        updatedAt: pastDate,
        steps: [
          {
            id: 'step-1',
            stepNumber: 1,
            approverRole: 'ACCOUNTANT',
            status: ApprovalStatus.PENDING,
            isOverdue: false,
          },
        ],
      };

      mockPrisma.approval.findMany.mockResolvedValue([mockApproval]);
      mockPrisma.approvalStep.update.mockResolvedValue({});

      await service.checkOverdueApprovals();

      // Should mark step as overdue
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: { isOverdue: true },
      });

      // Should emit approval.overdue
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'approval.overdue',
        expect.objectContaining({
          approvalId: 'approval-1',
          type: 'PAYMENT_VOUCHER',
          currentStep: 1,
          currentStepRole: 'ACCOUNTANT',
        }),
      );

      // Should NOT emit approval.escalated (only 1x threshold, not 2x)
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        'approval.escalated',
        expect.anything(),
      );
    });

    it('should emit both approval.overdue AND approval.escalated at 2x threshold', async () => {
      // 49 hours ago = past 2x threshold (48h)
      const pastDate = new Date(Date.now() - 49 * 60 * 60 * 1000);

      const mockApproval = {
        id: 'approval-2',
        type: 'QUOTATION',
        referenceId: 'ref-2',
        referenceCode: 'QT-001',
        currentStep: 2,
        status: ApprovalStatus.PENDING,
        updatedAt: pastDate,
        steps: [
          {
            id: 'step-2a',
            stepNumber: 1,
            approverRole: 'SALES_LEADER',
            status: ApprovalStatus.APPROVED,
            isOverdue: false,
          },
          {
            id: 'step-2b',
            stepNumber: 2,
            approverRole: 'SALES_DIRECTOR',
            status: ApprovalStatus.PENDING,
            isOverdue: false,
          },
        ],
      };

      mockPrisma.approval.findMany.mockResolvedValue([mockApproval]);
      mockPrisma.approvalStep.update.mockResolvedValue({});

      await service.checkOverdueApprovals();

      // Should mark step as overdue
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: 'step-2b' },
        data: { isOverdue: true },
      });

      // Should emit approval.overdue
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'approval.overdue',
        expect.objectContaining({
          approvalId: 'approval-2',
          currentStep: 2,
          currentStepRole: 'SALES_DIRECTOR',
        }),
      );

      // Should also emit approval.escalated (2x threshold exceeded)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'approval.escalated',
        expect.objectContaining({
          approvalId: 'approval-2',
          type: 'QUOTATION',
          currentStep: 2,
          currentStepRole: 'SALES_DIRECTOR',
          pendingSince: pastDate,
        }),
      );
    });

    it('should not update step if already marked overdue', async () => {
      const pastDate = new Date(Date.now() - 30 * 60 * 60 * 1000);

      const mockApproval = {
        id: 'approval-3',
        type: 'PAYMENT_VOUCHER',
        referenceId: 'ref-3',
        referenceCode: 'PV-003',
        currentStep: 1,
        status: ApprovalStatus.PENDING,
        updatedAt: pastDate,
        steps: [
          {
            id: 'step-3',
            stepNumber: 1,
            approverRole: 'CFO',
            status: ApprovalStatus.PENDING,
            isOverdue: true, // Already overdue
          },
        ],
      };

      mockPrisma.approval.findMany.mockResolvedValue([mockApproval]);

      await service.checkOverdueApprovals();

      // Should NOT update step (already overdue)
      expect(mockPrisma.approvalStep.update).not.toHaveBeenCalled();

      // Should still emit overdue event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'approval.overdue',
        expect.objectContaining({
          approvalId: 'approval-3',
        }),
      );
    });

    it('should include event payload with approvalId, type, currentStep, currentStepRole', async () => {
      const pastDate = new Date(Date.now() - 50 * 60 * 60 * 1000);

      const mockApproval = {
        id: 'approval-payload',
        type: 'QUOTATION',
        referenceId: 'ref-payload',
        referenceCode: 'QT-PAYLOAD',
        currentStep: 1,
        status: ApprovalStatus.PENDING,
        updatedAt: pastDate,
        steps: [
          {
            id: 'step-payload',
            stepNumber: 1,
            approverRole: 'SALE',
            status: ApprovalStatus.PENDING,
            isOverdue: false,
          },
        ],
      };

      mockPrisma.approval.findMany.mockResolvedValue([mockApproval]);
      mockPrisma.approvalStep.update.mockResolvedValue({});

      await service.checkOverdueApprovals();

      // Verify escalation event payload structure
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'approval.escalated',
        {
          approvalId: 'approval-payload',
          type: 'QUOTATION',
          referenceId: 'ref-payload',
          currentStep: 1,
          currentStepRole: 'SALE',
          pendingSince: pastDate,
        },
      );
    });
  });
});
