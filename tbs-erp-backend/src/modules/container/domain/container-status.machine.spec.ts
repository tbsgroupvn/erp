import { BadRequestException } from '@nestjs/common';
import { ContainerStatus } from '@prisma/client';
import { ContainerStatusMachine } from './container-status.machine';

describe('ContainerStatusMachine', () => {
  let machine: ContainerStatusMachine;

  beforeEach(() => {
    machine = new ContainerStatusMachine();
  });

  // ---------------------------------------------------------------------------
  // Happy-path: full lifecycle
  // ---------------------------------------------------------------------------
  describe('happy path — full lifecycle', () => {
    it('should allow the complete happy path PLANNING → LOADING → IN_TRANSIT → ARRIVED → CUSTOMS → COMPLETED', () => {
      const path: ContainerStatus[] = [
        ContainerStatus.PLANNING,
        ContainerStatus.LOADING,
        ContainerStatus.IN_TRANSIT,
        ContainerStatus.ARRIVED,
        ContainerStatus.CUSTOMS,
        ContainerStatus.COMPLETED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it('should not throw for any step of the happy path via assertTransition', () => {
      const path: ContainerStatus[] = [
        ContainerStatus.PLANNING,
        ContainerStatus.LOADING,
        ContainerStatus.IN_TRANSIT,
        ContainerStatus.ARRIVED,
        ContainerStatus.CUSTOMS,
        ContainerStatus.COMPLETED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(() => machine.assertTransition(path[i], path[i + 1])).not.toThrow();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // ON_HOLD_BORDER scenarios
  // ---------------------------------------------------------------------------
  describe('ON_HOLD_BORDER scenarios', () => {
    it('should allow IN_TRANSIT → ON_HOLD_BORDER', () => {
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.ON_HOLD_BORDER),
      ).toBe(true);
    });

    it('should allow ON_HOLD_BORDER → IN_TRANSIT (resume journey)', () => {
      expect(
        machine.validateTransition(ContainerStatus.ON_HOLD_BORDER, ContainerStatus.IN_TRANSIT),
      ).toBe(true);
    });

    it('should allow ON_HOLD_BORDER → ARRIVED (skip ahead after border hold)', () => {
      expect(
        machine.validateTransition(ContainerStatus.ON_HOLD_BORDER, ContainerStatus.ARRIVED),
      ).toBe(true);
    });

    it('should allow full cycle: IN_TRANSIT → ON_HOLD_BORDER → IN_TRANSIT → ARRIVED', () => {
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.ON_HOLD_BORDER),
      ).toBe(true);
      expect(
        machine.validateTransition(ContainerStatus.ON_HOLD_BORDER, ContainerStatus.IN_TRANSIT),
      ).toBe(true);
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.ARRIVED),
      ).toBe(true);
    });

    it('should allow skip-ahead cycle: IN_TRANSIT → ON_HOLD_BORDER → ARRIVED', () => {
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.ON_HOLD_BORDER),
      ).toBe(true);
      expect(
        machine.validateTransition(ContainerStatus.ON_HOLD_BORDER, ContainerStatus.ARRIVED),
      ).toBe(true);
    });

    it('should NOT allow ON_HOLD_BORDER → CUSTOMS (must go through ARRIVED first)', () => {
      expect(
        machine.validateTransition(ContainerStatus.ON_HOLD_BORDER, ContainerStatus.CUSTOMS),
      ).toBe(false);
    });

    it('should NOT allow ON_HOLD_BORDER → COMPLETED (must clear customs first)', () => {
      expect(
        machine.validateTransition(ContainerStatus.ON_HOLD_BORDER, ContainerStatus.COMPLETED),
      ).toBe(false);
    });

    it('should NOT allow ON_HOLD_BORDER → LOADING (backward invalid)', () => {
      expect(
        machine.validateTransition(ContainerStatus.ON_HOLD_BORDER, ContainerStatus.LOADING),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMS_HOLD scenarios
  // ---------------------------------------------------------------------------
  describe('CUSTOMS_HOLD scenarios', () => {
    it('should allow CUSTOMS → CUSTOMS_HOLD', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS, ContainerStatus.CUSTOMS_HOLD),
      ).toBe(true);
    });

    it('should allow CUSTOMS_HOLD → CUSTOMS (retry after hold)', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS_HOLD, ContainerStatus.CUSTOMS),
      ).toBe(true);
    });

    it('should allow CUSTOMS_HOLD → COMPLETED (direct complete after hold resolved)', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS_HOLD, ContainerStatus.COMPLETED),
      ).toBe(true);
    });

    it('should allow full retry cycle: CUSTOMS → CUSTOMS_HOLD → CUSTOMS → COMPLETED', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS, ContainerStatus.CUSTOMS_HOLD),
      ).toBe(true);
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS_HOLD, ContainerStatus.CUSTOMS),
      ).toBe(true);
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS, ContainerStatus.COMPLETED),
      ).toBe(true);
    });

    it('should allow direct complete cycle: CUSTOMS → CUSTOMS_HOLD → COMPLETED', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS, ContainerStatus.CUSTOMS_HOLD),
      ).toBe(true);
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS_HOLD, ContainerStatus.COMPLETED),
      ).toBe(true);
    });

    it('should NOT allow CUSTOMS_HOLD → ARRIVED (backward invalid)', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS_HOLD, ContainerStatus.ARRIVED),
      ).toBe(false);
    });

    it('should NOT allow CUSTOMS_HOLD → IN_TRANSIT (backward invalid)', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS_HOLD, ContainerStatus.IN_TRANSIT),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Terminal state
  // ---------------------------------------------------------------------------
  describe('terminal state — COMPLETED', () => {
    it('should mark COMPLETED as terminal', () => {
      expect(machine.isTerminal(ContainerStatus.COMPLETED)).toBe(true);
    });

    it('should NOT allow any transition from COMPLETED', () => {
      const allStatuses = Object.values(ContainerStatus);
      for (const target of allStatuses) {
        expect(machine.validateTransition(ContainerStatus.COMPLETED, target)).toBe(false);
      }
    });

    it('should return empty array from getNextStatuses(COMPLETED)', () => {
      expect(machine.getNextStatuses(ContainerStatus.COMPLETED)).toEqual([]);
    });

    it('should throw BadRequestException when assertTransition is called from COMPLETED', () => {
      expect(() =>
        machine.assertTransition(ContainerStatus.COMPLETED, ContainerStatus.PLANNING),
      ).toThrow(BadRequestException);
    });

    it('should include "none (terminal state)" in error message from COMPLETED', () => {
      try {
        machine.assertTransition(ContainerStatus.COMPLETED, ContainerStatus.PLANNING);
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
    const nonTerminal: ContainerStatus[] = [
      ContainerStatus.PLANNING,
      ContainerStatus.LOADING,
      ContainerStatus.IN_TRANSIT,
      ContainerStatus.ARRIVED,
      ContainerStatus.CUSTOMS,
      ContainerStatus.ON_HOLD_BORDER,
      ContainerStatus.CUSTOMS_HOLD,
    ];

    it.each(nonTerminal)('should return false for isTerminal(%s)', (status) => {
      expect(machine.isTerminal(status)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid transitions — no skipping states
  // ---------------------------------------------------------------------------
  describe('invalid transitions — no skipping states', () => {
    it('should NOT allow PLANNING → ARRIVED (skipping LOADING and IN_TRANSIT)', () => {
      expect(
        machine.validateTransition(ContainerStatus.PLANNING, ContainerStatus.ARRIVED),
      ).toBe(false);
    });

    it('should NOT allow PLANNING → IN_TRANSIT (skipping LOADING)', () => {
      expect(
        machine.validateTransition(ContainerStatus.PLANNING, ContainerStatus.IN_TRANSIT),
      ).toBe(false);
    });

    it('should NOT allow PLANNING → CUSTOMS', () => {
      expect(
        machine.validateTransition(ContainerStatus.PLANNING, ContainerStatus.CUSTOMS),
      ).toBe(false);
    });

    it('should NOT allow PLANNING → COMPLETED', () => {
      expect(
        machine.validateTransition(ContainerStatus.PLANNING, ContainerStatus.COMPLETED),
      ).toBe(false);
    });

    it('should NOT allow LOADING → CUSTOMS (skipping IN_TRANSIT and ARRIVED)', () => {
      expect(
        machine.validateTransition(ContainerStatus.LOADING, ContainerStatus.CUSTOMS),
      ).toBe(false);
    });

    it('should NOT allow LOADING → ARRIVED (skipping IN_TRANSIT)', () => {
      expect(
        machine.validateTransition(ContainerStatus.LOADING, ContainerStatus.ARRIVED),
      ).toBe(false);
    });

    it('should NOT allow LOADING → COMPLETED', () => {
      expect(
        machine.validateTransition(ContainerStatus.LOADING, ContainerStatus.COMPLETED),
      ).toBe(false);
    });

    it('should NOT allow IN_TRANSIT → CUSTOMS (skipping ARRIVED)', () => {
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.CUSTOMS),
      ).toBe(false);
    });

    it('should NOT allow IN_TRANSIT → COMPLETED (skipping ARRIVED and CUSTOMS)', () => {
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.COMPLETED),
      ).toBe(false);
    });

    it('should NOT allow ARRIVED → COMPLETED (skipping CUSTOMS)', () => {
      expect(
        machine.validateTransition(ContainerStatus.ARRIVED, ContainerStatus.COMPLETED),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid transitions — backward jumps
  // ---------------------------------------------------------------------------
  describe('invalid transitions — backward jumps', () => {
    it('should NOT allow LOADING → PLANNING', () => {
      expect(
        machine.validateTransition(ContainerStatus.LOADING, ContainerStatus.PLANNING),
      ).toBe(false);
    });

    it('should NOT allow IN_TRANSIT → LOADING', () => {
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.LOADING),
      ).toBe(false);
    });

    it('should NOT allow IN_TRANSIT → PLANNING', () => {
      expect(
        machine.validateTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.PLANNING),
      ).toBe(false);
    });

    it('should NOT allow ARRIVED → IN_TRANSIT', () => {
      expect(
        machine.validateTransition(ContainerStatus.ARRIVED, ContainerStatus.IN_TRANSIT),
      ).toBe(false);
    });

    it('should NOT allow ARRIVED → LOADING', () => {
      expect(
        machine.validateTransition(ContainerStatus.ARRIVED, ContainerStatus.LOADING),
      ).toBe(false);
    });

    it('should NOT allow CUSTOMS → ARRIVED', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS, ContainerStatus.ARRIVED),
      ).toBe(false);
    });

    it('should NOT allow CUSTOMS → IN_TRANSIT', () => {
      expect(
        machine.validateTransition(ContainerStatus.CUSTOMS, ContainerStatus.IN_TRANSIT),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Self-transitions are not allowed
  // ---------------------------------------------------------------------------
  describe('self-transitions are not allowed', () => {
    it.each(Object.values(ContainerStatus))(
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
    it('should return [LOADING] for PLANNING', () => {
      expect(machine.getNextStatuses(ContainerStatus.PLANNING)).toEqual([
        ContainerStatus.LOADING,
      ]);
    });

    it('should return [IN_TRANSIT] for LOADING', () => {
      expect(machine.getNextStatuses(ContainerStatus.LOADING)).toEqual([
        ContainerStatus.IN_TRANSIT,
      ]);
    });

    it('should return [ARRIVED, ON_HOLD_BORDER] for IN_TRANSIT', () => {
      expect(machine.getNextStatuses(ContainerStatus.IN_TRANSIT)).toEqual([
        ContainerStatus.ARRIVED,
        ContainerStatus.ON_HOLD_BORDER,
      ]);
    });

    it('should return [IN_TRANSIT, ARRIVED] for ON_HOLD_BORDER', () => {
      expect(machine.getNextStatuses(ContainerStatus.ON_HOLD_BORDER)).toEqual([
        ContainerStatus.IN_TRANSIT,
        ContainerStatus.ARRIVED,
      ]);
    });

    it('should return [CUSTOMS] for ARRIVED', () => {
      expect(machine.getNextStatuses(ContainerStatus.ARRIVED)).toEqual([
        ContainerStatus.CUSTOMS,
      ]);
    });

    it('should return [COMPLETED, CUSTOMS_HOLD] for CUSTOMS', () => {
      expect(machine.getNextStatuses(ContainerStatus.CUSTOMS)).toEqual([
        ContainerStatus.COMPLETED,
        ContainerStatus.CUSTOMS_HOLD,
      ]);
    });

    it('should return [CUSTOMS, COMPLETED] for CUSTOMS_HOLD', () => {
      expect(machine.getNextStatuses(ContainerStatus.CUSTOMS_HOLD)).toEqual([
        ContainerStatus.CUSTOMS,
        ContainerStatus.COMPLETED,
      ]);
    });

    it('should return [] for COMPLETED', () => {
      expect(machine.getNextStatuses(ContainerStatus.COMPLETED)).toEqual([]);
    });

    it('should return [] for an unknown status', () => {
      expect(machine.getNextStatuses('UNKNOWN' as ContainerStatus)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // assertTransition — error messages
  // ---------------------------------------------------------------------------
  describe('assertTransition error messages', () => {
    it('should throw with descriptive message including "from" and "to" statuses', () => {
      try {
        machine.assertTransition(ContainerStatus.PLANNING, ContainerStatus.COMPLETED);
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('PLANNING');
        expect(e.message).toContain('COMPLETED');
      }
    });

    it('should list allowed transitions in the error message', () => {
      try {
        machine.assertTransition(ContainerStatus.IN_TRANSIT, ContainerStatus.CUSTOMS);
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e.message).toContain('ARRIVED');
        expect(e.message).toContain('ON_HOLD_BORDER');
      }
    });

    it('should throw for backward transition ARRIVED → PLANNING', () => {
      expect(() =>
        machine.assertTransition(ContainerStatus.ARRIVED, ContainerStatus.PLANNING),
      ).toThrow(BadRequestException);
    });

    it('should NOT throw for valid transition CUSTOMS → COMPLETED', () => {
      expect(() =>
        machine.assertTransition(ContainerStatus.CUSTOMS, ContainerStatus.COMPLETED),
      ).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle multiple ON_HOLD_BORDER cycles gracefully', () => {
      // Simulate repeated border holds
      const transitions: [ContainerStatus, ContainerStatus][] = [
        [ContainerStatus.IN_TRANSIT, ContainerStatus.ON_HOLD_BORDER],
        [ContainerStatus.ON_HOLD_BORDER, ContainerStatus.IN_TRANSIT],
        [ContainerStatus.IN_TRANSIT, ContainerStatus.ON_HOLD_BORDER],
        [ContainerStatus.ON_HOLD_BORDER, ContainerStatus.IN_TRANSIT],
        [ContainerStatus.IN_TRANSIT, ContainerStatus.ARRIVED],
      ];

      for (const [from, to] of transitions) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });

    it('should handle multiple CUSTOMS_HOLD cycles gracefully', () => {
      // Simulate repeated customs holds
      const transitions: [ContainerStatus, ContainerStatus][] = [
        [ContainerStatus.CUSTOMS, ContainerStatus.CUSTOMS_HOLD],
        [ContainerStatus.CUSTOMS_HOLD, ContainerStatus.CUSTOMS],
        [ContainerStatus.CUSTOMS, ContainerStatus.CUSTOMS_HOLD],
        [ContainerStatus.CUSTOMS_HOLD, ContainerStatus.CUSTOMS],
        [ContainerStatus.CUSTOMS, ContainerStatus.COMPLETED],
      ];

      for (const [from, to] of transitions) {
        expect(machine.validateTransition(from, to)).toBe(true);
      }
    });

    it('should return false for validateTransition with unknown "from" status', () => {
      expect(machine.validateTransition('NONEXISTENT' as ContainerStatus, ContainerStatus.LOADING)).toBe(false);
    });

    it('should return false for validateTransition with unknown "to" status', () => {
      expect(machine.validateTransition(ContainerStatus.PLANNING, 'NONEXISTENT' as ContainerStatus)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Exhaustive transition matrix
  // ---------------------------------------------------------------------------
  describe('exhaustive transition matrix', () => {
    const validPairs: [ContainerStatus, ContainerStatus][] = [
      // PLANNING -> 1
      [ContainerStatus.PLANNING, ContainerStatus.LOADING],
      // LOADING -> 1
      [ContainerStatus.LOADING, ContainerStatus.IN_TRANSIT],
      // IN_TRANSIT -> 2
      [ContainerStatus.IN_TRANSIT, ContainerStatus.ARRIVED],
      [ContainerStatus.IN_TRANSIT, ContainerStatus.ON_HOLD_BORDER],
      // ON_HOLD_BORDER -> 2
      [ContainerStatus.ON_HOLD_BORDER, ContainerStatus.IN_TRANSIT],
      [ContainerStatus.ON_HOLD_BORDER, ContainerStatus.ARRIVED],
      // ARRIVED -> 1
      [ContainerStatus.ARRIVED, ContainerStatus.CUSTOMS],
      // CUSTOMS -> 2
      [ContainerStatus.CUSTOMS, ContainerStatus.COMPLETED],
      [ContainerStatus.CUSTOMS, ContainerStatus.CUSTOMS_HOLD],
      // CUSTOMS_HOLD -> 2
      [ContainerStatus.CUSTOMS_HOLD, ContainerStatus.CUSTOMS],
      [ContainerStatus.CUSTOMS_HOLD, ContainerStatus.COMPLETED],
      // COMPLETED -> 0 (terminal)
    ];

    const allStatuses = Object.values(ContainerStatus);

    it('should have exactly 11 valid transitions in the entire FSM', () => {
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
