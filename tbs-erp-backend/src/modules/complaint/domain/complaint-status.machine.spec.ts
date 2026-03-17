import { BadRequestException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';
import { ComplaintStatusMachine } from './complaint-status.machine';

describe('ComplaintStatusMachine', () => {
  let machine: ComplaintStatusMachine;

  beforeEach(() => {
    machine = new ComplaintStatusMachine();
  });

  // ---------------------------------------------------------------------------
  // validateTransition — valid transitions
  // ---------------------------------------------------------------------------
  describe('validateTransition (valid)', () => {
    it('should allow OPEN → INVESTIGATING', () => {
      expect(
        machine.validateTransition(ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING),
      ).toBe(true);
    });

    it('should allow INVESTIGATING → PENDING_RESOLUTION', () => {
      expect(
        machine.validateTransition(ComplaintStatus.INVESTIGATING, ComplaintStatus.PENDING_RESOLUTION),
      ).toBe(true);
    });

    it('should allow INVESTIGATING → RESOLVED (fast-track)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.INVESTIGATING, ComplaintStatus.RESOLVED),
      ).toBe(true);
    });

    it('should allow PENDING_RESOLUTION → RESOLVED', () => {
      expect(
        machine.validateTransition(ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.RESOLVED),
      ).toBe(true);
    });

    it('should allow RESOLVED → CLOSED', () => {
      expect(
        machine.validateTransition(ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // validateTransition — invalid transitions
  // ---------------------------------------------------------------------------
  describe('validateTransition (invalid)', () => {
    it('should reject OPEN → RESOLVED (must investigate first)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.OPEN, ComplaintStatus.RESOLVED),
      ).toBe(false);
    });

    it('should reject OPEN → CLOSED (skip all intermediate states)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.OPEN, ComplaintStatus.CLOSED),
      ).toBe(false);
    });

    it('should reject OPEN → PENDING_RESOLUTION (must investigate first)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.OPEN, ComplaintStatus.PENDING_RESOLUTION),
      ).toBe(false);
    });

    it('should reject INVESTIGATING → CLOSED (must resolve first)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.INVESTIGATING, ComplaintStatus.CLOSED),
      ).toBe(false);
    });

    it('should reject INVESTIGATING → OPEN (no backward)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.INVESTIGATING, ComplaintStatus.OPEN),
      ).toBe(false);
    });

    it('should reject PENDING_RESOLUTION → CLOSED (must resolve first)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.CLOSED),
      ).toBe(false);
    });

    it('should reject PENDING_RESOLUTION → OPEN (no backward)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.OPEN),
      ).toBe(false);
    });

    it('should reject PENDING_RESOLUTION → INVESTIGATING (no backward)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.INVESTIGATING),
      ).toBe(false);
    });

    it('should reject RESOLVED → OPEN (no backward)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.RESOLVED, ComplaintStatus.OPEN),
      ).toBe(false);
    });

    it('should reject RESOLVED → INVESTIGATING (no backward)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.RESOLVED, ComplaintStatus.INVESTIGATING),
      ).toBe(false);
    });

    it('should return false for unknown source status', () => {
      expect(
        machine.validateTransition('UNKNOWN' as ComplaintStatus, ComplaintStatus.OPEN),
      ).toBe(false);
    });

    it('should reject self-transitions (OPEN → OPEN)', () => {
      expect(
        machine.validateTransition(ComplaintStatus.OPEN, ComplaintStatus.OPEN),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Terminal states — no outgoing transitions
  // ---------------------------------------------------------------------------
  describe('terminal states', () => {
    it('should reject any transition from CLOSED', () => {
      const allStatuses = Object.values(ComplaintStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(ComplaintStatus.CLOSED, target)).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Happy-path scenarios (multi-step)
  // ---------------------------------------------------------------------------
  describe('happy-path scenarios', () => {
    it('should complete full flow: OPEN → INVESTIGATING → PENDING_RESOLUTION → RESOLVED → CLOSED', () => {
      const steps: [ComplaintStatus, ComplaintStatus][] = [
        [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING],
        [ComplaintStatus.INVESTIGATING, ComplaintStatus.PENDING_RESOLUTION],
        [ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.RESOLVED],
        [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
      ];
      for (const [from, to] of steps) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });

    it('should complete fast-track flow: OPEN → INVESTIGATING → RESOLVED → CLOSED', () => {
      const steps: [ComplaintStatus, ComplaintStatus][] = [
        [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING],
        [ComplaintStatus.INVESTIGATING, ComplaintStatus.RESOLVED],
        [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
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
    it('should not throw for valid OPEN → INVESTIGATING', () => {
      expect(() =>
        machine.assertTransition(ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING),
      ).not.toThrow();
    });

    it('should not throw for valid INVESTIGATING → RESOLVED (fast-track)', () => {
      expect(() =>
        machine.assertTransition(ComplaintStatus.INVESTIGATING, ComplaintStatus.RESOLVED),
      ).not.toThrow();
    });

    it('should not throw for valid RESOLVED → CLOSED', () => {
      expect(() =>
        machine.assertTransition(ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED),
      ).not.toThrow();
    });

    it('should throw BadRequestException for OPEN → RESOLVED', () => {
      expect(() =>
        machine.assertTransition(ComplaintStatus.OPEN, ComplaintStatus.RESOLVED),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for OPEN → CLOSED', () => {
      expect(() =>
        machine.assertTransition(ComplaintStatus.OPEN, ComplaintStatus.CLOSED),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for CLOSED → OPEN (terminal)', () => {
      expect(() =>
        machine.assertTransition(ComplaintStatus.CLOSED, ComplaintStatus.OPEN),
      ).toThrow(BadRequestException);
    });

    it('should include allowed transitions in error message', () => {
      try {
        machine.assertTransition(ComplaintStatus.OPEN, ComplaintStatus.CLOSED);
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('OPEN');
        expect(error.message).toContain('CLOSED');
        expect(error.message).toContain('INVESTIGATING');
      }
    });

    it('should show "none (terminal state)" for CLOSED in error message', () => {
      try {
        machine.assertTransition(ComplaintStatus.CLOSED, ComplaintStatus.OPEN);
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
    it('should return [INVESTIGATING] for OPEN', () => {
      expect(machine.getNextStatuses(ComplaintStatus.OPEN)).toEqual([
        ComplaintStatus.INVESTIGATING,
      ]);
    });

    it('should return [PENDING_RESOLUTION, RESOLVED] for INVESTIGATING', () => {
      expect(machine.getNextStatuses(ComplaintStatus.INVESTIGATING)).toEqual([
        ComplaintStatus.PENDING_RESOLUTION,
        ComplaintStatus.RESOLVED,
      ]);
    });

    it('should return [RESOLVED] for PENDING_RESOLUTION', () => {
      expect(machine.getNextStatuses(ComplaintStatus.PENDING_RESOLUTION)).toEqual([
        ComplaintStatus.RESOLVED,
      ]);
    });

    it('should return [CLOSED] for RESOLVED', () => {
      expect(machine.getNextStatuses(ComplaintStatus.RESOLVED)).toEqual([ComplaintStatus.CLOSED]);
    });

    it('should return empty array for CLOSED', () => {
      expect(machine.getNextStatuses(ComplaintStatus.CLOSED)).toEqual([]);
    });

    it('should return empty array for unknown status', () => {
      expect(machine.getNextStatuses('NONEXISTENT' as ComplaintStatus)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // isTerminal
  // ---------------------------------------------------------------------------
  describe('isTerminal', () => {
    it('should return true for CLOSED', () => {
      expect(machine.isTerminal(ComplaintStatus.CLOSED)).toBe(true);
    });

    it('should return false for OPEN', () => {
      expect(machine.isTerminal(ComplaintStatus.OPEN)).toBe(false);
    });

    it('should return false for INVESTIGATING', () => {
      expect(machine.isTerminal(ComplaintStatus.INVESTIGATING)).toBe(false);
    });

    it('should return false for PENDING_RESOLUTION', () => {
      expect(machine.isTerminal(ComplaintStatus.PENDING_RESOLUTION)).toBe(false);
    });

    it('should return false for RESOLVED', () => {
      expect(machine.isTerminal(ComplaintStatus.RESOLVED)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Exhaustive: every pair of distinct statuses
  // ---------------------------------------------------------------------------
  describe('exhaustive transition matrix', () => {
    const validPairs: [ComplaintStatus, ComplaintStatus][] = [
      [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING],
      [ComplaintStatus.INVESTIGATING, ComplaintStatus.PENDING_RESOLUTION],
      [ComplaintStatus.INVESTIGATING, ComplaintStatus.RESOLVED],
      [ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.RESOLVED],
      [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
    ];

    const allStatuses = Object.values(ComplaintStatus);

    it('should have exactly 5 valid transitions in the entire FSM', () => {
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
  });
});
