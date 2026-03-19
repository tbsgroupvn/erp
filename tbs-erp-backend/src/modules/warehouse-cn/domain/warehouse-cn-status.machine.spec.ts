import { BadRequestException } from '@nestjs/common';
import { WarehouseCNStatus } from '@prisma/client';
import { WarehouseCNStatusMachine } from './warehouse-cn-status.machine';

describe('WarehouseCNStatusMachine', () => {
  let machine: WarehouseCNStatusMachine;

  beforeEach(() => {
    machine = new WarehouseCNStatusMachine();
  });

  // ── All states for iteration helpers ──────────────────────────────
  const ALL_STATES: WarehouseCNStatus[] = [
    WarehouseCNStatus.RECEIVED,
    WarehouseCNStatus.CHECKED,
    WarehouseCNStatus.PACKED,
    WarehouseCNStatus.SHIPPED,
  ];

  const PIPELINE: WarehouseCNStatus[] = [
    WarehouseCNStatus.RECEIVED,
    WarehouseCNStatus.CHECKED,
    WarehouseCNStatus.PACKED,
    WarehouseCNStatus.SHIPPED,
  ];

  // ── Happy path ────────────────────────────────────────────────────
  describe('happy path (linear pipeline)', () => {
    it('should allow RECEIVED -> CHECKED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.RECEIVED, WarehouseCNStatus.CHECKED)).toBe(true);
    });

    it('should allow CHECKED -> PACKED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.CHECKED, WarehouseCNStatus.PACKED)).toBe(true);
    });

    it('should allow PACKED -> SHIPPED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.PACKED, WarehouseCNStatus.SHIPPED)).toBe(true);
    });

    it('should complete full pipeline RECEIVED -> CHECKED -> PACKED -> SHIPPED', () => {
      for (let i = 0; i < PIPELINE.length - 1; i++) {
        expect(machine.validateTransition(PIPELINE[i], PIPELINE[i + 1])).toBe(true);
      }
    });
  });

  // ── Terminal state ────────────────────────────────────────────────
  describe('terminal state', () => {
    it('should mark SHIPPED as terminal', () => {
      expect(machine.isTerminal(WarehouseCNStatus.SHIPPED)).toBe(true);
    });

    it('should not mark non-terminal states as terminal', () => {
      const nonTerminal = [WarehouseCNStatus.RECEIVED, WarehouseCNStatus.CHECKED, WarehouseCNStatus.PACKED];
      for (const status of nonTerminal) {
        expect(machine.isTerminal(status)).toBe(false);
      }
    });

    it('should not allow any transition from SHIPPED', () => {
      for (const target of ALL_STATES) {
        expect(machine.validateTransition(WarehouseCNStatus.SHIPPED, target)).toBe(false);
      }
    });

    it('should return empty array for getNextStatuses(SHIPPED)', () => {
      expect(machine.getNextStatuses(WarehouseCNStatus.SHIPPED)).toEqual([]);
    });
  });

  // ── Invalid backward transitions ─────────────────────────────────
  describe('invalid backward transitions', () => {
    it('should reject CHECKED -> RECEIVED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.CHECKED, WarehouseCNStatus.RECEIVED)).toBe(false);
    });

    it('should reject PACKED -> CHECKED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.PACKED, WarehouseCNStatus.CHECKED)).toBe(false);
    });

    it('should reject PACKED -> RECEIVED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.PACKED, WarehouseCNStatus.RECEIVED)).toBe(false);
    });

    it('should reject SHIPPED -> PACKED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.SHIPPED, WarehouseCNStatus.PACKED)).toBe(false);
    });

    it('should reject SHIPPED -> RECEIVED', () => {
      expect(machine.validateTransition(WarehouseCNStatus.SHIPPED, WarehouseCNStatus.RECEIVED)).toBe(false);
    });
  });

  // ── Invalid skip transitions ──────────────────────────────────────
  describe('invalid skip transitions', () => {
    it('should reject RECEIVED -> PACKED (skip CHECKED)', () => {
      expect(machine.validateTransition(WarehouseCNStatus.RECEIVED, WarehouseCNStatus.PACKED)).toBe(false);
    });

    it('should reject RECEIVED -> SHIPPED (skip two steps)', () => {
      expect(machine.validateTransition(WarehouseCNStatus.RECEIVED, WarehouseCNStatus.SHIPPED)).toBe(false);
    });

    it('should reject CHECKED -> SHIPPED (skip PACKED)', () => {
      expect(machine.validateTransition(WarehouseCNStatus.CHECKED, WarehouseCNStatus.SHIPPED)).toBe(false);
    });
  });

  // ── Self-transitions ──────────────────────────────────────────────
  describe('self-transitions', () => {
    it('should reject self-transition for every state', () => {
      for (const status of ALL_STATES) {
        expect(machine.validateTransition(status, status)).toBe(false);
      }
    });
  });

  // ── assertTransition ──────────────────────────────────────────────
  describe('assertTransition', () => {
    it('should not throw for valid transition RECEIVED -> CHECKED', () => {
      expect(() => {
        machine.assertTransition(WarehouseCNStatus.RECEIVED, WarehouseCNStatus.CHECKED);
      }).not.toThrow();
    });

    it('should throw BadRequestException for invalid transition RECEIVED -> SHIPPED', () => {
      expect(() => {
        machine.assertTransition(WarehouseCNStatus.RECEIVED, WarehouseCNStatus.SHIPPED);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for transition from terminal state', () => {
      expect(() => {
        machine.assertTransition(WarehouseCNStatus.SHIPPED, WarehouseCNStatus.RECEIVED);
      }).toThrow(BadRequestException);
    });

    it('should include status names in error message', () => {
      expect(() => {
        machine.assertTransition(WarehouseCNStatus.RECEIVED, WarehouseCNStatus.SHIPPED);
      }).toThrow(/RECEIVED.*SHIPPED/);
    });

    it('should include allowed transitions in error message', () => {
      expect(() => {
        machine.assertTransition(WarehouseCNStatus.RECEIVED, WarehouseCNStatus.SHIPPED);
      }).toThrow(/CHECKED/);
    });

    it('should mention "terminal state" when asserting from SHIPPED', () => {
      expect(() => {
        machine.assertTransition(WarehouseCNStatus.SHIPPED, WarehouseCNStatus.RECEIVED);
      }).toThrow(/terminal state/);
    });
  });

  // ── getNextStatuses ───────────────────────────────────────────────
  describe('getNextStatuses', () => {
    it('should return [CHECKED] for RECEIVED', () => {
      expect(machine.getNextStatuses(WarehouseCNStatus.RECEIVED)).toEqual([WarehouseCNStatus.CHECKED]);
    });

    it('should return [PACKED] for CHECKED', () => {
      expect(machine.getNextStatuses(WarehouseCNStatus.CHECKED)).toEqual([WarehouseCNStatus.PACKED]);
    });

    it('should return [SHIPPED] for PACKED', () => {
      expect(machine.getNextStatuses(WarehouseCNStatus.PACKED)).toEqual([WarehouseCNStatus.SHIPPED]);
    });

    it('should return [] for SHIPPED', () => {
      expect(machine.getNextStatuses(WarehouseCNStatus.SHIPPED)).toEqual([]);
    });

    it('should return exactly one next status for each non-terminal state', () => {
      const nonTerminal = [WarehouseCNStatus.RECEIVED, WarehouseCNStatus.CHECKED, WarehouseCNStatus.PACKED];
      for (const status of nonTerminal) {
        expect(machine.getNextStatuses(status)).toHaveLength(1);
      }
    });
  });

  // ── Exhaustive transition matrix ─────────────────────────────────
  describe('exhaustive transition matrix', () => {
    const validPairs: [WarehouseCNStatus, WarehouseCNStatus][] = [
      [WarehouseCNStatus.RECEIVED, WarehouseCNStatus.CHECKED],
      [WarehouseCNStatus.CHECKED, WarehouseCNStatus.PACKED],
      [WarehouseCNStatus.PACKED, WarehouseCNStatus.SHIPPED],
    ];

    const allStatuses = Object.values(WarehouseCNStatus);

    it('should have exactly 3 valid transitions in the entire FSM', () => {
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
