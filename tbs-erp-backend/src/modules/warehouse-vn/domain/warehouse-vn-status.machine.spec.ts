import { BadRequestException } from '@nestjs/common';
import { WarehouseVNStatus } from '@prisma/client';
import { WarehouseVNStatusMachine } from './warehouse-vn-status.machine';

describe('WarehouseVNStatusMachine', () => {
  let machine: WarehouseVNStatusMachine;

  beforeEach(() => {
    machine = new WarehouseVNStatusMachine();
  });

  // ── All states for iteration helpers ──────────────────────────────
  const ALL_STATES: WarehouseVNStatus[] = [
    WarehouseVNStatus.RECEIVED,
    WarehouseVNStatus.SORTED,
    WarehouseVNStatus.READY,
    WarehouseVNStatus.DELIVERED,
  ];

  const PIPELINE: WarehouseVNStatus[] = [
    WarehouseVNStatus.RECEIVED,
    WarehouseVNStatus.SORTED,
    WarehouseVNStatus.READY,
    WarehouseVNStatus.DELIVERED,
  ];

  // ── Happy path ────────────────────────────────────────────────────
  describe('happy path (linear pipeline)', () => {
    it('should allow RECEIVED -> SORTED', () => {
      expect(machine.validateTransition(WarehouseVNStatus.RECEIVED, WarehouseVNStatus.SORTED)).toBe(true);
    });

    it('should allow SORTED -> READY', () => {
      expect(machine.validateTransition(WarehouseVNStatus.SORTED, WarehouseVNStatus.READY)).toBe(true);
    });

    it('should allow READY -> DELIVERED', () => {
      expect(machine.validateTransition(WarehouseVNStatus.READY, WarehouseVNStatus.DELIVERED)).toBe(true);
    });

    it('should complete full pipeline RECEIVED -> SORTED -> READY -> DELIVERED', () => {
      for (let i = 0; i < PIPELINE.length - 1; i++) {
        expect(machine.validateTransition(PIPELINE[i], PIPELINE[i + 1])).toBe(true);
      }
    });
  });

  // ── Terminal state ────────────────────────────────────────────────
  describe('terminal state', () => {
    it('should mark DELIVERED as terminal', () => {
      expect(machine.isTerminal(WarehouseVNStatus.DELIVERED)).toBe(true);
    });

    it('should not mark non-terminal states as terminal', () => {
      const nonTerminal = [WarehouseVNStatus.RECEIVED, WarehouseVNStatus.SORTED, WarehouseVNStatus.READY];
      for (const status of nonTerminal) {
        expect(machine.isTerminal(status)).toBe(false);
      }
    });

    it('should not allow any transition from DELIVERED', () => {
      for (const target of ALL_STATES) {
        expect(machine.validateTransition(WarehouseVNStatus.DELIVERED, target)).toBe(false);
      }
    });

    it('should return empty array for getNextStatuses(DELIVERED)', () => {
      expect(machine.getNextStatuses(WarehouseVNStatus.DELIVERED)).toEqual([]);
    });
  });

  // ── Invalid backward transitions ─────────────────────────────────
  describe('invalid backward transitions', () => {
    it('should reject SORTED -> RECEIVED', () => {
      expect(machine.validateTransition(WarehouseVNStatus.SORTED, WarehouseVNStatus.RECEIVED)).toBe(false);
    });

    it('should reject READY -> SORTED', () => {
      expect(machine.validateTransition(WarehouseVNStatus.READY, WarehouseVNStatus.SORTED)).toBe(false);
    });

    it('should reject READY -> RECEIVED', () => {
      expect(machine.validateTransition(WarehouseVNStatus.READY, WarehouseVNStatus.RECEIVED)).toBe(false);
    });

    it('should reject DELIVERED -> READY', () => {
      expect(machine.validateTransition(WarehouseVNStatus.DELIVERED, WarehouseVNStatus.READY)).toBe(false);
    });

    it('should reject DELIVERED -> RECEIVED', () => {
      expect(machine.validateTransition(WarehouseVNStatus.DELIVERED, WarehouseVNStatus.RECEIVED)).toBe(false);
    });
  });

  // ── Invalid skip transitions ──────────────────────────────────────
  describe('invalid skip transitions', () => {
    it('should reject RECEIVED -> READY (skip SORTED)', () => {
      expect(machine.validateTransition(WarehouseVNStatus.RECEIVED, WarehouseVNStatus.READY)).toBe(false);
    });

    it('should reject RECEIVED -> DELIVERED (skip two steps)', () => {
      expect(machine.validateTransition(WarehouseVNStatus.RECEIVED, WarehouseVNStatus.DELIVERED)).toBe(false);
    });

    it('should reject SORTED -> DELIVERED (skip READY)', () => {
      expect(machine.validateTransition(WarehouseVNStatus.SORTED, WarehouseVNStatus.DELIVERED)).toBe(false);
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
    it('should not throw for valid transition RECEIVED -> SORTED', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.RECEIVED, WarehouseVNStatus.SORTED);
      }).not.toThrow();
    });

    it('should not throw for valid transition READY -> DELIVERED', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.READY, WarehouseVNStatus.DELIVERED);
      }).not.toThrow();
    });

    it('should throw BadRequestException for invalid transition RECEIVED -> DELIVERED', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.RECEIVED, WarehouseVNStatus.DELIVERED);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for backward transition SORTED -> RECEIVED', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.SORTED, WarehouseVNStatus.RECEIVED);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for transition from terminal state DELIVERED', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.DELIVERED, WarehouseVNStatus.RECEIVED);
      }).toThrow(BadRequestException);
    });

    it('should include status names in error message', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.RECEIVED, WarehouseVNStatus.DELIVERED);
      }).toThrow(/RECEIVED.*DELIVERED/);
    });

    it('should include allowed transitions in error message', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.RECEIVED, WarehouseVNStatus.DELIVERED);
      }).toThrow(/SORTED/);
    });

    it('should mention "terminal state" when asserting from DELIVERED', () => {
      expect(() => {
        machine.assertTransition(WarehouseVNStatus.DELIVERED, WarehouseVNStatus.RECEIVED);
      }).toThrow(/terminal state/);
    });
  });

  // ── getNextStatuses ───────────────────────────────────────────────
  describe('getNextStatuses', () => {
    it('should return [SORTED] for RECEIVED', () => {
      expect(machine.getNextStatuses(WarehouseVNStatus.RECEIVED)).toEqual([WarehouseVNStatus.SORTED]);
    });

    it('should return [READY] for SORTED', () => {
      expect(machine.getNextStatuses(WarehouseVNStatus.SORTED)).toEqual([WarehouseVNStatus.READY]);
    });

    it('should return [DELIVERED] for READY', () => {
      expect(machine.getNextStatuses(WarehouseVNStatus.READY)).toEqual([WarehouseVNStatus.DELIVERED]);
    });

    it('should return [] for DELIVERED', () => {
      expect(machine.getNextStatuses(WarehouseVNStatus.DELIVERED)).toEqual([]);
    });

    it('should return exactly one next status for each non-terminal state', () => {
      const nonTerminal = [WarehouseVNStatus.RECEIVED, WarehouseVNStatus.SORTED, WarehouseVNStatus.READY];
      for (const status of nonTerminal) {
        expect(machine.getNextStatuses(status)).toHaveLength(1);
      }
    });
  });
});
