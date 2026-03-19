import { BadRequestException } from '@nestjs/common';
import { CustomsDeclarationStatus } from '@prisma/client';
import { CustomsStatusMachine, validateTransition } from './customs-status.machine';

describe('CustomsStatusMachine', () => {
  let machine: CustomsStatusMachine;

  beforeEach(() => {
    machine = new CustomsStatusMachine();
  });

  // ---------------------------------------------------------------------------
  // Happy path — GREEN channel (no inspection)
  // ---------------------------------------------------------------------------
  describe('happy path — GREEN channel', () => {
    it('should allow DRAFT → READY → SUBMITTED → CHANNEL_ASSIGNED → CLEARED', () => {
      const path: CustomsDeclarationStatus[] = [
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.SUBMITTED,
        CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        CustomsDeclarationStatus.CLEARED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it('should not throw for the GREEN channel path via assertTransition', () => {
      const path: CustomsDeclarationStatus[] = [
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.SUBMITTED,
        CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        CustomsDeclarationStatus.CLEARED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(() => machine.assertTransition(path[i], path[i + 1])).not.toThrow();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path — YELLOW/RED channel (with inspection)
  // ---------------------------------------------------------------------------
  describe('happy path — YELLOW/RED channel (with inspection)', () => {
    it('should allow DRAFT → READY → SUBMITTED → CHANNEL_ASSIGNED → INSPECTING → CLEARED', () => {
      const path: CustomsDeclarationStatus[] = [
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.SUBMITTED,
        CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        CustomsDeclarationStatus.INSPECTING,
        CustomsDeclarationStatus.CLEARED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Rejection and revision cycle
  // ---------------------------------------------------------------------------
  describe('rejection and revision cycle', () => {
    it('should allow SUBMITTED → REJECTED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.SUBMITTED,
          CustomsDeclarationStatus.REJECTED,
        ),
      ).toBe(true);
    });

    it('should allow INSPECTING → REJECTED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.INSPECTING,
          CustomsDeclarationStatus.REJECTED,
        ),
      ).toBe(true);
    });

    it('should allow REJECTED → DRAFT (revision)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.REJECTED,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toBe(true);
    });

    it('should allow full rejection-resubmission cycle: SUBMITTED → REJECTED → DRAFT → READY → SUBMITTED', () => {
      const path: CustomsDeclarationStatus[] = [
        CustomsDeclarationStatus.SUBMITTED,
        CustomsDeclarationStatus.REJECTED,
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.SUBMITTED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it('should allow inspection rejection cycle: INSPECTING → REJECTED → DRAFT → READY → SUBMITTED → CHANNEL_ASSIGNED → CLEARED', () => {
      const path: CustomsDeclarationStatus[] = [
        CustomsDeclarationStatus.INSPECTING,
        CustomsDeclarationStatus.REJECTED,
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.SUBMITTED,
        CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        CustomsDeclarationStatus.CLEARED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it('should NOT allow REJECTED → READY (must go through DRAFT first)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.REJECTED,
          CustomsDeclarationStatus.READY,
        ),
      ).toBe(false);
    });

    it('should NOT allow REJECTED → SUBMITTED (must go through DRAFT and READY first)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.REJECTED,
          CustomsDeclarationStatus.SUBMITTED,
        ),
      ).toBe(false);
    });

    it('should NOT allow REJECTED → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.REJECTED,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // READY can go back to DRAFT
  // ---------------------------------------------------------------------------
  describe('READY → DRAFT regression', () => {
    it('should allow READY → DRAFT', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.READY,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toBe(true);
    });

    it('should allow round-trip DRAFT → READY → DRAFT → READY → SUBMITTED', () => {
      const path: CustomsDeclarationStatus[] = [
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.SUBMITTED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Cancellation
  // ---------------------------------------------------------------------------
  describe('cancellation from allowed states', () => {
    it('should allow DRAFT → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(true);
    });

    it('should allow READY → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.READY,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(true);
    });

    it('should allow SUBMITTED → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.SUBMITTED,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(true);
    });
  });

  describe('cancellation NOT allowed from later states', () => {
    it('should NOT allow CHANNEL_ASSIGNED → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(false);
    });

    it('should NOT allow INSPECTING → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.INSPECTING,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(false);
    });

    it('should NOT allow CLEARED → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.CLEARED,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(false);
    });

    it('should NOT allow REJECTED → CANCELLED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.REJECTED,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Terminal states
  // ---------------------------------------------------------------------------
  describe('terminal states', () => {
    it('should mark CLEARED as terminal', () => {
      expect(machine.isTerminal(CustomsDeclarationStatus.CLEARED)).toBe(true);
    });

    it('should mark CANCELLED as terminal', () => {
      expect(machine.isTerminal(CustomsDeclarationStatus.CANCELLED)).toBe(true);
    });

    it('should NOT allow any transition from CLEARED', () => {
      const allStatuses = Object.values(CustomsDeclarationStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(CustomsDeclarationStatus.CLEARED, target)).toBe(false);
      }
    });

    it('should NOT allow any transition from CANCELLED', () => {
      const allStatuses = Object.values(CustomsDeclarationStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(CustomsDeclarationStatus.CANCELLED, target)).toBe(false);
      }
    });

    it('should return empty array from getNextStatuses(CLEARED)', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.CLEARED)).toEqual([]);
    });

    it('should return empty array from getNextStatuses(CANCELLED)', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.CANCELLED)).toEqual([]);
    });

    it('should throw BadRequestException when assertTransition is called from CLEARED', () => {
      expect(() =>
        machine.assertTransition(
          CustomsDeclarationStatus.CLEARED,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when assertTransition is called from CANCELLED', () => {
      expect(() =>
        machine.assertTransition(
          CustomsDeclarationStatus.CANCELLED,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toThrow(BadRequestException);
    });

    it('should include "none (terminal state)" in error from CLEARED', () => {
      try {
        machine.assertTransition(
          CustomsDeclarationStatus.CLEARED,
          CustomsDeclarationStatus.DRAFT,
        );
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e.message).toContain('none (terminal state)');
      }
    });

    it('should include "none (terminal state)" in error from CANCELLED', () => {
      try {
        machine.assertTransition(
          CustomsDeclarationStatus.CANCELLED,
          CustomsDeclarationStatus.DRAFT,
        );
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e.message).toContain('none (terminal state)');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // isTerminal for non-terminal statuses
  // ---------------------------------------------------------------------------
  describe('isTerminal returns false for non-terminal statuses', () => {
    const nonTerminal: CustomsDeclarationStatus[] = [
      CustomsDeclarationStatus.DRAFT,
      CustomsDeclarationStatus.READY,
      CustomsDeclarationStatus.SUBMITTED,
      CustomsDeclarationStatus.CHANNEL_ASSIGNED,
      CustomsDeclarationStatus.INSPECTING,
      CustomsDeclarationStatus.REJECTED,
    ];

    it.each(nonTerminal)('should return false for isTerminal(%s)', (status) => {
      expect(machine.isTerminal(status)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid transitions — skipping states
  // ---------------------------------------------------------------------------
  describe('invalid transitions — skipping states', () => {
    it('should NOT allow DRAFT → SUBMITTED (skipping READY)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.SUBMITTED,
        ),
      ).toBe(false);
    });

    it('should NOT allow DRAFT → CHANNEL_ASSIGNED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        ),
      ).toBe(false);
    });

    it('should NOT allow DRAFT → CLEARED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.CLEARED,
        ),
      ).toBe(false);
    });

    it('should NOT allow DRAFT → INSPECTING', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.INSPECTING,
        ),
      ).toBe(false);
    });

    it('should NOT allow READY → CHANNEL_ASSIGNED (skipping SUBMITTED)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.READY,
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        ),
      ).toBe(false);
    });

    it('should NOT allow READY → CLEARED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.READY,
          CustomsDeclarationStatus.CLEARED,
        ),
      ).toBe(false);
    });

    it('should NOT allow SUBMITTED → CLEARED (skipping CHANNEL_ASSIGNED)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.SUBMITTED,
          CustomsDeclarationStatus.CLEARED,
        ),
      ).toBe(false);
    });

    it('should NOT allow SUBMITTED → INSPECTING (skipping CHANNEL_ASSIGNED)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.SUBMITTED,
          CustomsDeclarationStatus.INSPECTING,
        ),
      ).toBe(false);
    });

    it('should NOT allow CHANNEL_ASSIGNED → CANCELLED (process already started)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
          CustomsDeclarationStatus.CANCELLED,
        ),
      ).toBe(false);
    });

    it('should NOT allow CHANNEL_ASSIGNED → REJECTED (must inspect first or clear)', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
          CustomsDeclarationStatus.REJECTED,
        ),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid transitions — backward jumps
  // ---------------------------------------------------------------------------
  describe('invalid transitions — backward jumps', () => {
    it('should NOT allow SUBMITTED → READY', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.SUBMITTED,
          CustomsDeclarationStatus.READY,
        ),
      ).toBe(false);
    });

    it('should NOT allow SUBMITTED → DRAFT', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.SUBMITTED,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toBe(false);
    });

    it('should NOT allow CHANNEL_ASSIGNED → SUBMITTED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
          CustomsDeclarationStatus.SUBMITTED,
        ),
      ).toBe(false);
    });

    it('should NOT allow CHANNEL_ASSIGNED → DRAFT', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toBe(false);
    });

    it('should NOT allow INSPECTING → SUBMITTED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.INSPECTING,
          CustomsDeclarationStatus.SUBMITTED,
        ),
      ).toBe(false);
    });

    it('should NOT allow INSPECTING → CHANNEL_ASSIGNED', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.INSPECTING,
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        ),
      ).toBe(false);
    });

    it('should NOT allow INSPECTING → DRAFT', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.INSPECTING,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Self-transitions are not allowed
  // ---------------------------------------------------------------------------
  describe('self-transitions are not allowed', () => {
    it.each(Object.values(CustomsDeclarationStatus))(
      'should NOT allow self-transition %s → %s',
      (status) => {
        expect(machine.validateTransition(status, status)).toBe(false);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // getNextStatuses
  // ---------------------------------------------------------------------------
  describe('getNextStatuses', () => {
    it('should return [READY, CANCELLED] for DRAFT', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.DRAFT)).toEqual([
        CustomsDeclarationStatus.READY,
        CustomsDeclarationStatus.CANCELLED,
      ]);
    });

    it('should return [SUBMITTED, DRAFT, CANCELLED] for READY', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.READY)).toEqual([
        CustomsDeclarationStatus.SUBMITTED,
        CustomsDeclarationStatus.DRAFT,
        CustomsDeclarationStatus.CANCELLED,
      ]);
    });

    it('should return [CHANNEL_ASSIGNED, REJECTED, CANCELLED] for SUBMITTED', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.SUBMITTED)).toEqual([
        CustomsDeclarationStatus.CHANNEL_ASSIGNED,
        CustomsDeclarationStatus.REJECTED,
        CustomsDeclarationStatus.CANCELLED,
      ]);
    });

    it('should return [INSPECTING, CLEARED] for CHANNEL_ASSIGNED', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.CHANNEL_ASSIGNED)).toEqual([
        CustomsDeclarationStatus.INSPECTING,
        CustomsDeclarationStatus.CLEARED,
      ]);
    });

    it('should return [CLEARED, REJECTED] for INSPECTING', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.INSPECTING)).toEqual([
        CustomsDeclarationStatus.CLEARED,
        CustomsDeclarationStatus.REJECTED,
      ]);
    });

    it('should return [] for CLEARED', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.CLEARED)).toEqual([]);
    });

    it('should return [DRAFT] for REJECTED', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.REJECTED)).toEqual([
        CustomsDeclarationStatus.DRAFT,
      ]);
    });

    it('should return [] for CANCELLED', () => {
      expect(machine.getNextStatuses(CustomsDeclarationStatus.CANCELLED)).toEqual([]);
    });

    it('should return [] for an unknown status', () => {
      expect(machine.getNextStatuses('UNKNOWN' as CustomsDeclarationStatus)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // assertTransition — error messages
  // ---------------------------------------------------------------------------
  describe('assertTransition error messages', () => {
    it('should throw with descriptive message including "from" and "to" statuses', () => {
      try {
        machine.assertTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.CLEARED,
        );
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('DRAFT');
        expect(e.message).toContain('CLEARED');
      }
    });

    it('should list allowed transitions in the error message', () => {
      try {
        machine.assertTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.CLEARED,
        );
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e.message).toContain('READY');
        expect(e.message).toContain('CANCELLED');
      }
    });

    it('should NOT throw for valid transition DRAFT → READY', () => {
      expect(() =>
        machine.assertTransition(
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.READY,
        ),
      ).not.toThrow();
    });

    it('should throw for backward transition CHANNEL_ASSIGNED → DRAFT', () => {
      expect(() =>
        machine.assertTransition(
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
          CustomsDeclarationStatus.DRAFT,
        ),
      ).toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle multiple rejection-revision cycles', () => {
      const transitions: [CustomsDeclarationStatus, CustomsDeclarationStatus][] = [
        [CustomsDeclarationStatus.DRAFT, CustomsDeclarationStatus.READY],
        [CustomsDeclarationStatus.READY, CustomsDeclarationStatus.SUBMITTED],
        [CustomsDeclarationStatus.SUBMITTED, CustomsDeclarationStatus.REJECTED],
        [CustomsDeclarationStatus.REJECTED, CustomsDeclarationStatus.DRAFT],
        [CustomsDeclarationStatus.DRAFT, CustomsDeclarationStatus.READY],
        [CustomsDeclarationStatus.READY, CustomsDeclarationStatus.SUBMITTED],
        [CustomsDeclarationStatus.SUBMITTED, CustomsDeclarationStatus.CHANNEL_ASSIGNED],
        [CustomsDeclarationStatus.CHANNEL_ASSIGNED, CustomsDeclarationStatus.INSPECTING],
        [CustomsDeclarationStatus.INSPECTING, CustomsDeclarationStatus.REJECTED],
        [CustomsDeclarationStatus.REJECTED, CustomsDeclarationStatus.DRAFT],
        [CustomsDeclarationStatus.DRAFT, CustomsDeclarationStatus.READY],
        [CustomsDeclarationStatus.READY, CustomsDeclarationStatus.SUBMITTED],
        [CustomsDeclarationStatus.SUBMITTED, CustomsDeclarationStatus.CHANNEL_ASSIGNED],
        [CustomsDeclarationStatus.CHANNEL_ASSIGNED, CustomsDeclarationStatus.CLEARED],
      ];

      for (const [from, to] of transitions) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });

    it('should return false for validateTransition with unknown "from" status', () => {
      expect(
        machine.validateTransition(
          'NONEXISTENT' as CustomsDeclarationStatus,
          CustomsDeclarationStatus.READY,
        ),
      ).toBe(false);
    });

    it('should return false for validateTransition with unknown "to" status', () => {
      expect(
        machine.validateTransition(
          CustomsDeclarationStatus.DRAFT,
          'NONEXISTENT' as CustomsDeclarationStatus,
        ),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Exhaustive transition matrix
  // ---------------------------------------------------------------------------
  describe('exhaustive transition matrix', () => {
    const validPairs: [CustomsDeclarationStatus, CustomsDeclarationStatus][] = [
      // DRAFT -> 2
      [CustomsDeclarationStatus.DRAFT, CustomsDeclarationStatus.READY],
      [CustomsDeclarationStatus.DRAFT, CustomsDeclarationStatus.CANCELLED],
      // READY -> 3
      [CustomsDeclarationStatus.READY, CustomsDeclarationStatus.SUBMITTED],
      [CustomsDeclarationStatus.READY, CustomsDeclarationStatus.DRAFT],
      [CustomsDeclarationStatus.READY, CustomsDeclarationStatus.CANCELLED],
      // SUBMITTED -> 3
      [CustomsDeclarationStatus.SUBMITTED, CustomsDeclarationStatus.CHANNEL_ASSIGNED],
      [CustomsDeclarationStatus.SUBMITTED, CustomsDeclarationStatus.REJECTED],
      [CustomsDeclarationStatus.SUBMITTED, CustomsDeclarationStatus.CANCELLED],
      // CHANNEL_ASSIGNED -> 2
      [CustomsDeclarationStatus.CHANNEL_ASSIGNED, CustomsDeclarationStatus.INSPECTING],
      [CustomsDeclarationStatus.CHANNEL_ASSIGNED, CustomsDeclarationStatus.CLEARED],
      // INSPECTING -> 2
      [CustomsDeclarationStatus.INSPECTING, CustomsDeclarationStatus.CLEARED],
      [CustomsDeclarationStatus.INSPECTING, CustomsDeclarationStatus.REJECTED],
      // REJECTED -> 1
      [CustomsDeclarationStatus.REJECTED, CustomsDeclarationStatus.DRAFT],
    ];

    const allStatuses = Object.values(CustomsDeclarationStatus);

    it('should have exactly 13 valid transitions in the entire FSM', () => {
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

// =============================================================================
// Standalone validateTransition function
// =============================================================================
describe('validateTransition (standalone function)', () => {
  describe('valid transitions', () => {
    it('should return true for DRAFT → READY', () => {
      expect(validateTransition('DRAFT', 'READY')).toBe(true);
    });

    it('should return true for DRAFT → CANCELLED', () => {
      expect(validateTransition('DRAFT', 'CANCELLED')).toBe(true);
    });

    it('should return true for READY → SUBMITTED', () => {
      expect(validateTransition('READY', 'SUBMITTED')).toBe(true);
    });

    it('should return true for READY → DRAFT', () => {
      expect(validateTransition('READY', 'DRAFT')).toBe(true);
    });

    it('should return true for READY → CANCELLED', () => {
      expect(validateTransition('READY', 'CANCELLED')).toBe(true);
    });

    it('should return true for SUBMITTED → CHANNEL_ASSIGNED', () => {
      expect(validateTransition('SUBMITTED', 'CHANNEL_ASSIGNED')).toBe(true);
    });

    it('should return true for SUBMITTED → REJECTED', () => {
      expect(validateTransition('SUBMITTED', 'REJECTED')).toBe(true);
    });

    it('should return true for SUBMITTED → CANCELLED', () => {
      expect(validateTransition('SUBMITTED', 'CANCELLED')).toBe(true);
    });

    it('should return true for CHANNEL_ASSIGNED → INSPECTING', () => {
      expect(validateTransition('CHANNEL_ASSIGNED', 'INSPECTING')).toBe(true);
    });

    it('should return true for CHANNEL_ASSIGNED → CLEARED', () => {
      expect(validateTransition('CHANNEL_ASSIGNED', 'CLEARED')).toBe(true);
    });

    it('should return true for INSPECTING → CLEARED', () => {
      expect(validateTransition('INSPECTING', 'CLEARED')).toBe(true);
    });

    it('should return true for INSPECTING → REJECTED', () => {
      expect(validateTransition('INSPECTING', 'REJECTED')).toBe(true);
    });

    it('should return true for REJECTED → DRAFT', () => {
      expect(validateTransition('REJECTED', 'DRAFT')).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('should return false for CLEARED → anything (terminal)', () => {
      expect(validateTransition('CLEARED', 'DRAFT')).toBe(false);
      expect(validateTransition('CLEARED', 'READY')).toBe(false);
      expect(validateTransition('CLEARED', 'CANCELLED')).toBe(false);
    });

    it('should return false for CANCELLED → anything (terminal)', () => {
      expect(validateTransition('CANCELLED', 'DRAFT')).toBe(false);
      expect(validateTransition('CANCELLED', 'READY')).toBe(false);
      expect(validateTransition('CANCELLED', 'CLEARED')).toBe(false);
    });

    it('should return false for skipping states DRAFT → SUBMITTED', () => {
      expect(validateTransition('DRAFT', 'SUBMITTED')).toBe(false);
    });

    it('should return false for backward jump SUBMITTED → READY', () => {
      expect(validateTransition('SUBMITTED', 'READY')).toBe(false);
    });

    it('should return false for self-transition DRAFT → DRAFT', () => {
      expect(validateTransition('DRAFT', 'DRAFT')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for unknown "from" status', () => {
      expect(validateTransition('UNKNOWN_STATUS', 'READY')).toBe(false);
    });

    it('should return false for unknown "to" status', () => {
      expect(validateTransition('DRAFT', 'UNKNOWN_STATUS')).toBe(false);
    });

    it('should return false for both unknown statuses', () => {
      expect(validateTransition('FOO', 'BAR')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(validateTransition('', '')).toBe(false);
    });

    it('should return false for empty "from" string', () => {
      expect(validateTransition('', 'READY')).toBe(false);
    });

    it('should be consistent with the class-based machine for all valid transitions', () => {
      const machine = new CustomsStatusMachine();
      const allStatuses = Object.values(CustomsDeclarationStatus);

      for (const from of allStatuses) {
        for (const to of allStatuses) {
          expect(validateTransition(from, to)).toBe(machine.validateTransition(from, to));
        }
      }
    });
  });
});
