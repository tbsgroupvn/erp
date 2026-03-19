import { BadRequestException } from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';
import { QuotationStatusMachine } from './quotation-status.machine';

describe('QuotationStatusMachine', () => {
  let machine: QuotationStatusMachine;

  beforeEach(() => {
    machine = new QuotationStatusMachine();
  });

  // ---------------------------------------------------------------------------
  // validateTransition — valid transitions
  // ---------------------------------------------------------------------------
  describe('validateTransition (valid)', () => {
    it('should allow DRAFT → PENDING_APPROVAL', () => {
      expect(
        machine.validateTransition(QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL),
      ).toBe(true);
    });

    it('should allow PENDING_APPROVAL → APPROVED', () => {
      expect(
        machine.validateTransition(QuotationStatus.PENDING_APPROVAL, QuotationStatus.APPROVED),
      ).toBe(true);
    });

    it('should allow PENDING_APPROVAL → REJECTED', () => {
      expect(
        machine.validateTransition(QuotationStatus.PENDING_APPROVAL, QuotationStatus.REJECTED),
      ).toBe(true);
    });

    it('should allow APPROVED → CONVERTED', () => {
      expect(
        machine.validateTransition(QuotationStatus.APPROVED, QuotationStatus.CONVERTED),
      ).toBe(true);
    });

    it('should allow APPROVED → EXPIRED', () => {
      expect(
        machine.validateTransition(QuotationStatus.APPROVED, QuotationStatus.EXPIRED),
      ).toBe(true);
    });

    it('should allow REJECTED → DRAFT (revision cycle)', () => {
      expect(
        machine.validateTransition(QuotationStatus.REJECTED, QuotationStatus.DRAFT),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // validateTransition — invalid transitions
  // ---------------------------------------------------------------------------
  describe('validateTransition (invalid)', () => {
    it('should reject DRAFT → APPROVED (skipping PENDING_APPROVAL)', () => {
      expect(
        machine.validateTransition(QuotationStatus.DRAFT, QuotationStatus.APPROVED),
      ).toBe(false);
    });

    it('should reject DRAFT → CONVERTED (skipping approval)', () => {
      expect(
        machine.validateTransition(QuotationStatus.DRAFT, QuotationStatus.CONVERTED),
      ).toBe(false);
    });

    it('should reject DRAFT → REJECTED (must go through PENDING_APPROVAL)', () => {
      expect(
        machine.validateTransition(QuotationStatus.DRAFT, QuotationStatus.REJECTED),
      ).toBe(false);
    });

    it('should reject DRAFT → EXPIRED', () => {
      expect(
        machine.validateTransition(QuotationStatus.DRAFT, QuotationStatus.EXPIRED),
      ).toBe(false);
    });

    it('should reject APPROVED → DRAFT (no backward from approved)', () => {
      expect(
        machine.validateTransition(QuotationStatus.APPROVED, QuotationStatus.DRAFT),
      ).toBe(false);
    });

    it('should reject APPROVED → PENDING_APPROVAL', () => {
      expect(
        machine.validateTransition(QuotationStatus.APPROVED, QuotationStatus.PENDING_APPROVAL),
      ).toBe(false);
    });

    it('should reject APPROVED → REJECTED', () => {
      expect(
        machine.validateTransition(QuotationStatus.APPROVED, QuotationStatus.REJECTED),
      ).toBe(false);
    });

    it('should reject PENDING_APPROVAL → CONVERTED (must be approved first)', () => {
      expect(
        machine.validateTransition(QuotationStatus.PENDING_APPROVAL, QuotationStatus.CONVERTED),
      ).toBe(false);
    });

    it('should reject PENDING_APPROVAL → EXPIRED (must be approved first)', () => {
      expect(
        machine.validateTransition(QuotationStatus.PENDING_APPROVAL, QuotationStatus.EXPIRED),
      ).toBe(false);
    });

    it('should reject REJECTED → APPROVED (must go through DRAFT first)', () => {
      expect(
        machine.validateTransition(QuotationStatus.REJECTED, QuotationStatus.APPROVED),
      ).toBe(false);
    });

    it('should return false for unknown source status', () => {
      expect(machine.validateTransition('UNKNOWN' as QuotationStatus, QuotationStatus.DRAFT)).toBe(
        false,
      );
    });

    it('should reject self-transitions (DRAFT → DRAFT)', () => {
      expect(
        machine.validateTransition(QuotationStatus.DRAFT, QuotationStatus.DRAFT),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Terminal states — no outgoing transitions
  // ---------------------------------------------------------------------------
  describe('terminal states', () => {
    it('should reject any transition from CONVERTED', () => {
      const allStatuses = Object.values(QuotationStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(QuotationStatus.CONVERTED, target)).toBe(false);
      }
    });

    it('should reject any transition from EXPIRED', () => {
      const allStatuses = Object.values(QuotationStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(QuotationStatus.EXPIRED, target)).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Happy-path scenarios (multi-step)
  // ---------------------------------------------------------------------------
  describe('happy-path scenarios', () => {
    it('should complete approval flow: DRAFT → PENDING_APPROVAL → APPROVED → CONVERTED', () => {
      const steps: [QuotationStatus, QuotationStatus][] = [
        [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL],
        [QuotationStatus.PENDING_APPROVAL, QuotationStatus.APPROVED],
        [QuotationStatus.APPROVED, QuotationStatus.CONVERTED],
      ];
      for (const [from, to] of steps) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });

    it('should complete expiry flow: DRAFT → PENDING_APPROVAL → APPROVED → EXPIRED', () => {
      const steps: [QuotationStatus, QuotationStatus][] = [
        [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL],
        [QuotationStatus.PENDING_APPROVAL, QuotationStatus.APPROVED],
        [QuotationStatus.APPROVED, QuotationStatus.EXPIRED],
      ];
      for (const [from, to] of steps) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });

    it('should support rejection-revision cycle: DRAFT → PENDING → REJECTED → DRAFT → PENDING → APPROVED', () => {
      const steps: [QuotationStatus, QuotationStatus][] = [
        [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL],
        [QuotationStatus.PENDING_APPROVAL, QuotationStatus.REJECTED],
        [QuotationStatus.REJECTED, QuotationStatus.DRAFT],
        [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL],
        [QuotationStatus.PENDING_APPROVAL, QuotationStatus.APPROVED],
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
    it('should not throw for valid DRAFT → PENDING_APPROVAL', () => {
      expect(() =>
        machine.assertTransition(QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL),
      ).not.toThrow();
    });

    it('should not throw for valid REJECTED → DRAFT', () => {
      expect(() =>
        machine.assertTransition(QuotationStatus.REJECTED, QuotationStatus.DRAFT),
      ).not.toThrow();
    });

    it('should throw BadRequestException for DRAFT → APPROVED', () => {
      expect(() =>
        machine.assertTransition(QuotationStatus.DRAFT, QuotationStatus.APPROVED),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for CONVERTED → DRAFT (terminal)', () => {
      expect(() =>
        machine.assertTransition(QuotationStatus.CONVERTED, QuotationStatus.DRAFT),
      ).toThrow(BadRequestException);
    });

    it('should include allowed transitions in error message', () => {
      try {
        machine.assertTransition(QuotationStatus.DRAFT, QuotationStatus.CONVERTED);
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('DRAFT');
        expect(error.message).toContain('CONVERTED');
        expect(error.message).toContain('PENDING_APPROVAL');
      }
    });

    it('should show "none (terminal state)" for terminal states in error message', () => {
      try {
        machine.assertTransition(QuotationStatus.EXPIRED, QuotationStatus.DRAFT);
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
    it('should return [PENDING_APPROVAL] for DRAFT', () => {
      expect(machine.getNextStatuses(QuotationStatus.DRAFT)).toEqual([
        QuotationStatus.PENDING_APPROVAL,
      ]);
    });

    it('should return [APPROVED, REJECTED] for PENDING_APPROVAL', () => {
      expect(machine.getNextStatuses(QuotationStatus.PENDING_APPROVAL)).toEqual([
        QuotationStatus.APPROVED,
        QuotationStatus.REJECTED,
      ]);
    });

    it('should return [CONVERTED, EXPIRED] for APPROVED', () => {
      expect(machine.getNextStatuses(QuotationStatus.APPROVED)).toEqual([
        QuotationStatus.CONVERTED,
        QuotationStatus.EXPIRED,
      ]);
    });

    it('should return [DRAFT] for REJECTED', () => {
      expect(machine.getNextStatuses(QuotationStatus.REJECTED)).toEqual([QuotationStatus.DRAFT]);
    });

    it('should return empty array for CONVERTED', () => {
      expect(machine.getNextStatuses(QuotationStatus.CONVERTED)).toEqual([]);
    });

    it('should return empty array for EXPIRED', () => {
      expect(machine.getNextStatuses(QuotationStatus.EXPIRED)).toEqual([]);
    });

    it('should return empty array for unknown status', () => {
      expect(machine.getNextStatuses('NONEXISTENT' as QuotationStatus)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isTerminal
  // ---------------------------------------------------------------------------
  describe('isTerminal', () => {
    it('should return true for CONVERTED', () => {
      expect(machine.isTerminal(QuotationStatus.CONVERTED)).toBe(true);
    });

    it('should return true for EXPIRED', () => {
      expect(machine.isTerminal(QuotationStatus.EXPIRED)).toBe(true);
    });

    it('should return false for DRAFT', () => {
      expect(machine.isTerminal(QuotationStatus.DRAFT)).toBe(false);
    });

    it('should return false for PENDING_APPROVAL', () => {
      expect(machine.isTerminal(QuotationStatus.PENDING_APPROVAL)).toBe(false);
    });

    it('should return false for APPROVED', () => {
      expect(machine.isTerminal(QuotationStatus.APPROVED)).toBe(false);
    });

    it('should return false for REJECTED', () => {
      expect(machine.isTerminal(QuotationStatus.REJECTED)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Exhaustive transition matrix
  // ---------------------------------------------------------------------------
  describe('exhaustive transition matrix', () => {
    const validPairs: [QuotationStatus, QuotationStatus][] = [
      // DRAFT -> 1
      [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL],
      // PENDING_APPROVAL -> 2
      [QuotationStatus.PENDING_APPROVAL, QuotationStatus.APPROVED],
      [QuotationStatus.PENDING_APPROVAL, QuotationStatus.REJECTED],
      // APPROVED -> 2
      [QuotationStatus.APPROVED, QuotationStatus.CONVERTED],
      [QuotationStatus.APPROVED, QuotationStatus.EXPIRED],
      // REJECTED -> 1
      [QuotationStatus.REJECTED, QuotationStatus.DRAFT],
    ];

    const allStatuses = Object.values(QuotationStatus);

    it('should have exactly 6 valid transitions in the entire FSM', () => {
      let validCount = 0;
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          if (machine.validateTransition(from, to)) {
            validCount++;
          }
        }
      }
      expect(validCount).toBe(validPairs.length);
    });

    it('should throw for every invalid transition', () => {
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          if (!machine.validateTransition(from, to)) {
            expect(() => machine.assertTransition(from, to)).toThrow(BadRequestException);
          }
        }
      }
    });
  });
});
