import { BadRequestException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { VoucherStatusMachine } from './voucher-status.machine';

describe('VoucherStatusMachine', () => {
  let machine: VoucherStatusMachine;

  beforeEach(() => {
    machine = new VoucherStatusMachine();
  });

  // ---------------------------------------------------------------------------
  // validateTransition — valid transitions
  // ---------------------------------------------------------------------------
  describe('validateTransition (valid)', () => {
    it('should allow PENDING → APPROVED', () => {
      expect(
        machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.APPROVED),
      ).toBe(true);
    });

    it('should allow PENDING → REJECTED', () => {
      expect(
        machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.REJECTED),
      ).toBe(true);
    });

    it('should allow RETURNED → PENDING (re-submit for review)', () => {
      expect(
        machine.validateTransition(ApprovalStatus.RETURNED, ApprovalStatus.PENDING),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // validateTransition — invalid transitions
  // ---------------------------------------------------------------------------
  describe('validateTransition (invalid)', () => {
    it('should reject PENDING → RETURNED (approver returns, not self-return)', () => {
      expect(
        machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.RETURNED),
      ).toBe(false);
    });

    it('should reject PENDING → CANCELLED', () => {
      expect(
        machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.CANCELLED),
      ).toBe(false);
    });

    it('should reject PENDING → WITHDRAWN', () => {
      expect(
        machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.WITHDRAWN),
      ).toBe(false);
    });

    it('should reject APPROVED → PENDING (no reversal)', () => {
      expect(
        machine.validateTransition(ApprovalStatus.APPROVED, ApprovalStatus.PENDING),
      ).toBe(false);
    });

    it('should reject APPROVED → REJECTED', () => {
      expect(
        machine.validateTransition(ApprovalStatus.APPROVED, ApprovalStatus.REJECTED),
      ).toBe(false);
    });

    it('should reject REJECTED → PENDING (no direct resubmit from rejected)', () => {
      expect(
        machine.validateTransition(ApprovalStatus.REJECTED, ApprovalStatus.PENDING),
      ).toBe(false);
    });

    it('should reject REJECTED → APPROVED', () => {
      expect(
        machine.validateTransition(ApprovalStatus.REJECTED, ApprovalStatus.APPROVED),
      ).toBe(false);
    });

    it('should reject CANCELLED → PENDING', () => {
      expect(
        machine.validateTransition(ApprovalStatus.CANCELLED, ApprovalStatus.PENDING),
      ).toBe(false);
    });

    it('should reject WITHDRAWN → PENDING', () => {
      expect(
        machine.validateTransition(ApprovalStatus.WITHDRAWN, ApprovalStatus.PENDING),
      ).toBe(false);
    });

    it('should reject RETURNED → APPROVED (must go through PENDING)', () => {
      expect(
        machine.validateTransition(ApprovalStatus.RETURNED, ApprovalStatus.APPROVED),
      ).toBe(false);
    });

    it('should reject RETURNED → REJECTED (must go through PENDING)', () => {
      expect(
        machine.validateTransition(ApprovalStatus.RETURNED, ApprovalStatus.REJECTED),
      ).toBe(false);
    });

    it('should return false for unknown source status', () => {
      expect(
        machine.validateTransition('UNKNOWN' as ApprovalStatus, ApprovalStatus.PENDING),
      ).toBe(false);
    });

    it('should reject self-transitions (PENDING → PENDING)', () => {
      expect(
        machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.PENDING),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Terminal states — no outgoing transitions
  // ---------------------------------------------------------------------------
  describe('terminal states', () => {
    it('should reject any transition from APPROVED', () => {
      const allStatuses = Object.values(ApprovalStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(ApprovalStatus.APPROVED, target)).toBe(false);
      }
    });

    it('should reject any transition from REJECTED', () => {
      const allStatuses = Object.values(ApprovalStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(ApprovalStatus.REJECTED, target)).toBe(false);
      }
    });

    it('should reject any transition from CANCELLED', () => {
      const allStatuses = Object.values(ApprovalStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(ApprovalStatus.CANCELLED, target)).toBe(false);
      }
    });

    it('should reject any transition from WITHDRAWN', () => {
      const allStatuses = Object.values(ApprovalStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(ApprovalStatus.WITHDRAWN, target)).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Happy-path scenarios (multi-step)
  // ---------------------------------------------------------------------------
  describe('happy-path scenarios', () => {
    it('should complete approval flow: PENDING → APPROVED', () => {
      expect(machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.APPROVED)).toBe(
        true,
      );
    });

    it('should complete rejection flow: PENDING → REJECTED', () => {
      expect(machine.validateTransition(ApprovalStatus.PENDING, ApprovalStatus.REJECTED)).toBe(
        true,
      );
    });

    it('should complete return-and-resubmit flow: RETURNED → PENDING → APPROVED', () => {
      const steps: [ApprovalStatus, ApprovalStatus][] = [
        [ApprovalStatus.RETURNED, ApprovalStatus.PENDING],
        [ApprovalStatus.PENDING, ApprovalStatus.APPROVED],
      ];
      for (const [from, to] of steps) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });

    it('should complete return-then-reject flow: RETURNED → PENDING → REJECTED', () => {
      const steps: [ApprovalStatus, ApprovalStatus][] = [
        [ApprovalStatus.RETURNED, ApprovalStatus.PENDING],
        [ApprovalStatus.PENDING, ApprovalStatus.REJECTED],
      ];
      for (const [from, to] of steps) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // assertTransition
  // ---------------------------------------------------------------------------
  describe('assertTransition', () => {
    it('should not throw for valid PENDING → APPROVED', () => {
      expect(() =>
        machine.assertTransition(ApprovalStatus.PENDING, ApprovalStatus.APPROVED),
      ).not.toThrow();
    });

    it('should not throw for valid PENDING → REJECTED', () => {
      expect(() =>
        machine.assertTransition(ApprovalStatus.PENDING, ApprovalStatus.REJECTED),
      ).not.toThrow();
    });

    it('should not throw for valid RETURNED → PENDING', () => {
      expect(() =>
        machine.assertTransition(ApprovalStatus.RETURNED, ApprovalStatus.PENDING),
      ).not.toThrow();
    });

    it('should throw BadRequestException for APPROVED → PENDING', () => {
      expect(() =>
        machine.assertTransition(ApprovalStatus.APPROVED, ApprovalStatus.PENDING),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for REJECTED → APPROVED', () => {
      expect(() =>
        machine.assertTransition(ApprovalStatus.REJECTED, ApprovalStatus.APPROVED),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for CANCELLED → PENDING', () => {
      expect(() =>
        machine.assertTransition(ApprovalStatus.CANCELLED, ApprovalStatus.PENDING),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for WITHDRAWN → PENDING', () => {
      expect(() =>
        machine.assertTransition(ApprovalStatus.WITHDRAWN, ApprovalStatus.PENDING),
      ).toThrow(BadRequestException);
    });

    it('should include allowed transitions in error message for PENDING', () => {
      try {
        machine.assertTransition(ApprovalStatus.PENDING, ApprovalStatus.CANCELLED);
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('PENDING');
        expect(error.message).toContain('CANCELLED');
        expect(error.message).toContain('APPROVED');
        expect(error.message).toContain('REJECTED');
      }
    });

    it('should show "none (terminal state)" for APPROVED in error message', () => {
      try {
        machine.assertTransition(ApprovalStatus.APPROVED, ApprovalStatus.PENDING);
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('none (terminal state)');
      }
    });

    it('should show "none (terminal state)" for CANCELLED in error message', () => {
      try {
        machine.assertTransition(ApprovalStatus.CANCELLED, ApprovalStatus.PENDING);
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('none (terminal state)');
      }
    });

    it('should show "none (terminal state)" for WITHDRAWN in error message', () => {
      try {
        machine.assertTransition(ApprovalStatus.WITHDRAWN, ApprovalStatus.PENDING);
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('none (terminal state)');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getNextStatuses
  // ---------------------------------------------------------------------------
  describe('getNextStatuses', () => {
    it('should return [APPROVED, REJECTED] for PENDING', () => {
      expect(machine.getNextStatuses(ApprovalStatus.PENDING)).toEqual([
        ApprovalStatus.APPROVED,
        ApprovalStatus.REJECTED,
      ]);
    });

    it('should return empty array for APPROVED', () => {
      expect(machine.getNextStatuses(ApprovalStatus.APPROVED)).toEqual([]);
    });

    it('should return empty array for REJECTED', () => {
      expect(machine.getNextStatuses(ApprovalStatus.REJECTED)).toEqual([]);
    });

    it('should return empty array for CANCELLED', () => {
      expect(machine.getNextStatuses(ApprovalStatus.CANCELLED)).toEqual([]);
    });

    it('should return [PENDING] for RETURNED', () => {
      expect(machine.getNextStatuses(ApprovalStatus.RETURNED)).toEqual([ApprovalStatus.PENDING]);
    });

    it('should return empty array for WITHDRAWN', () => {
      expect(machine.getNextStatuses(ApprovalStatus.WITHDRAWN)).toEqual([]);
    });

    it('should return empty array for unknown status', () => {
      expect(machine.getNextStatuses('NONEXISTENT' as ApprovalStatus)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isTerminal
  // ---------------------------------------------------------------------------
  describe('isTerminal', () => {
    it('should return true for APPROVED', () => {
      expect(machine.isTerminal(ApprovalStatus.APPROVED)).toBe(true);
    });

    it('should return true for REJECTED', () => {
      expect(machine.isTerminal(ApprovalStatus.REJECTED)).toBe(true);
    });

    it('should return true for CANCELLED', () => {
      expect(machine.isTerminal(ApprovalStatus.CANCELLED)).toBe(true);
    });

    it('should return true for WITHDRAWN', () => {
      expect(machine.isTerminal(ApprovalStatus.WITHDRAWN)).toBe(true);
    });

    it('should return false for PENDING', () => {
      expect(machine.isTerminal(ApprovalStatus.PENDING)).toBe(false);
    });

    it('should return false for RETURNED', () => {
      expect(machine.isTerminal(ApprovalStatus.RETURNED)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Exhaustive: total valid transition count
  // ---------------------------------------------------------------------------
  describe('exhaustive transition matrix', () => {
    const allStatuses = Object.values(ApprovalStatus);

    it('should have exactly 3 valid transitions in the entire FSM', () => {
      let validCount = 0;
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          if (machine.validateTransition(from, to)) {
            validCount++;
          }
        }
      }
      // PENDING→APPROVED, PENDING→REJECTED, RETURNED→PENDING
      expect(validCount).toBe(3);
    });
  });
});
