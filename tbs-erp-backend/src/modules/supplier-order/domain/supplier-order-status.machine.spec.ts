import { BadRequestException } from '@nestjs/common';
import { SupplierOrderStatus } from '@prisma/client';
import { SupplierOrderStatusMachine } from './supplier-order-status.machine';

describe('SupplierOrderStatusMachine', () => {
  let machine: SupplierOrderStatusMachine;

  beforeEach(() => {
    machine = new SupplierOrderStatusMachine();
  });

  // ── Constants ─────────────────────────────────────────────────────
  const S = SupplierOrderStatus;

  const ALL_STATES: SupplierOrderStatus[] = [
    S.DRAFT,
    S.QUOTED,
    S.ORDERED,
    S.CONFIRMED,
    S.PARTIALLY_SHIPPED,
    S.SHIPPED_CN,
    S.RECEIVED_CN,
    S.RETURN_IN_PROGRESS,
    S.REFUNDED,
    S.CANCELLED,
    S.ISSUE,
  ];

  const TERMINAL_STATES: SupplierOrderStatus[] = [S.REFUNDED, S.CANCELLED];

  const NON_TERMINAL_STATES = ALL_STATES.filter((s) => !TERMINAL_STATES.includes(s));

  // ── Happy path: full lifecycle ────────────────────────────────────
  describe('happy path (full lifecycle)', () => {
    it('should allow DRAFT -> QUOTED -> ORDERED -> CONFIRMED -> SHIPPED_CN -> RECEIVED_CN', () => {
      const path = [S.DRAFT, S.QUOTED, S.ORDERED, S.CONFIRMED, S.SHIPPED_CN, S.RECEIVED_CN];
      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it('should allow fast track: DRAFT -> ORDERED (skip QUOTED)', () => {
      expect(machine.validateTransition(S.DRAFT, S.ORDERED)).toBe(true);
    });

    it('should allow partial shipping: CONFIRMED -> PARTIALLY_SHIPPED -> SHIPPED_CN', () => {
      expect(machine.validateTransition(S.CONFIRMED, S.PARTIALLY_SHIPPED)).toBe(true);
      expect(machine.validateTransition(S.PARTIALLY_SHIPPED, S.SHIPPED_CN)).toBe(true);
    });

    it('should allow direct receive from partial: PARTIALLY_SHIPPED -> RECEIVED_CN', () => {
      expect(machine.validateTransition(S.PARTIALLY_SHIPPED, S.RECEIVED_CN)).toBe(true);
    });

    it('should allow direct ship: CONFIRMED -> SHIPPED_CN (skip PARTIALLY_SHIPPED)', () => {
      expect(machine.validateTransition(S.CONFIRMED, S.SHIPPED_CN)).toBe(true);
    });
  });

  // ── Return/refund flow ────────────────────────────────────────────
  describe('return and refund flow', () => {
    it('should allow RECEIVED_CN -> RETURN_IN_PROGRESS', () => {
      expect(machine.validateTransition(S.RECEIVED_CN, S.RETURN_IN_PROGRESS)).toBe(true);
    });

    it('should allow RETURN_IN_PROGRESS -> REFUNDED', () => {
      expect(machine.validateTransition(S.RETURN_IN_PROGRESS, S.REFUNDED)).toBe(true);
    });

    it('should complete full return flow: RECEIVED_CN -> RETURN_IN_PROGRESS -> REFUNDED', () => {
      expect(machine.validateTransition(S.RECEIVED_CN, S.RETURN_IN_PROGRESS)).toBe(true);
      expect(machine.validateTransition(S.RETURN_IN_PROGRESS, S.REFUNDED)).toBe(true);
    });
  });

  // ── ISSUE escape hatch ────────────────────────────────────────────
  describe('ISSUE escape hatch', () => {
    it('should allow ORDERED -> ISSUE', () => {
      expect(machine.validateTransition(S.ORDERED, S.ISSUE)).toBe(true);
    });

    it('should allow CONFIRMED -> ISSUE', () => {
      expect(machine.validateTransition(S.CONFIRMED, S.ISSUE)).toBe(true);
    });

    it('should allow PARTIALLY_SHIPPED -> ISSUE', () => {
      expect(machine.validateTransition(S.PARTIALLY_SHIPPED, S.ISSUE)).toBe(true);
    });

    it('should allow SHIPPED_CN -> ISSUE', () => {
      expect(machine.validateTransition(S.SHIPPED_CN, S.ISSUE)).toBe(true);
    });

    it('should allow RECEIVED_CN -> ISSUE', () => {
      expect(machine.validateTransition(S.RECEIVED_CN, S.ISSUE)).toBe(true);
    });

    it('should allow RETURN_IN_PROGRESS -> ISSUE', () => {
      expect(machine.validateTransition(S.RETURN_IN_PROGRESS, S.ISSUE)).toBe(true);
    });

    it('should NOT allow DRAFT -> ISSUE', () => {
      expect(machine.validateTransition(S.DRAFT, S.ISSUE)).toBe(false);
    });

    it('should NOT allow QUOTED -> ISSUE', () => {
      expect(machine.validateTransition(S.QUOTED, S.ISSUE)).toBe(false);
    });

    it('should allow retry from ISSUE: ISSUE -> ORDERED', () => {
      expect(machine.validateTransition(S.ISSUE, S.ORDERED)).toBe(true);
    });

    it('should allow retry from ISSUE: ISSUE -> CONFIRMED', () => {
      expect(machine.validateTransition(S.ISSUE, S.CONFIRMED)).toBe(true);
    });

    it('should allow ISSUE -> RETURN_IN_PROGRESS', () => {
      expect(machine.validateTransition(S.ISSUE, S.RETURN_IN_PROGRESS)).toBe(true);
    });

    it('should allow ISSUE -> CANCELLED', () => {
      expect(machine.validateTransition(S.ISSUE, S.CANCELLED)).toBe(true);
    });

    it('should NOT allow ISSUE -> DRAFT', () => {
      expect(machine.validateTransition(S.ISSUE, S.DRAFT)).toBe(false);
    });

    it('should NOT allow ISSUE -> QUOTED', () => {
      expect(machine.validateTransition(S.ISSUE, S.QUOTED)).toBe(false);
    });

    it('should NOT allow ISSUE -> SHIPPED_CN', () => {
      expect(machine.validateTransition(S.ISSUE, S.SHIPPED_CN)).toBe(false);
    });
  });

  // ── Cancellation rules ────────────────────────────────────────────
  describe('cancellation rules', () => {
    it('should allow cancellation from DRAFT', () => {
      expect(machine.validateTransition(S.DRAFT, S.CANCELLED)).toBe(true);
    });

    it('should allow cancellation from QUOTED', () => {
      expect(machine.validateTransition(S.QUOTED, S.CANCELLED)).toBe(true);
    });

    it('should allow cancellation from ORDERED', () => {
      expect(machine.validateTransition(S.ORDERED, S.CANCELLED)).toBe(true);
    });

    it('should allow cancellation from CONFIRMED', () => {
      expect(machine.validateTransition(S.CONFIRMED, S.CANCELLED)).toBe(true);
    });

    it('should allow cancellation from ISSUE', () => {
      expect(machine.validateTransition(S.ISSUE, S.CANCELLED)).toBe(true);
    });

    it('should NOT allow cancellation from PARTIALLY_SHIPPED', () => {
      expect(machine.validateTransition(S.PARTIALLY_SHIPPED, S.CANCELLED)).toBe(false);
    });

    it('should NOT allow cancellation from SHIPPED_CN', () => {
      expect(machine.validateTransition(S.SHIPPED_CN, S.CANCELLED)).toBe(false);
    });

    it('should NOT allow cancellation from RECEIVED_CN', () => {
      expect(machine.validateTransition(S.RECEIVED_CN, S.CANCELLED)).toBe(false);
    });

    it('should NOT allow cancellation from RETURN_IN_PROGRESS', () => {
      expect(machine.validateTransition(S.RETURN_IN_PROGRESS, S.CANCELLED)).toBe(false);
    });
  });

  // ── Terminal states ───────────────────────────────────────────────
  describe('terminal states', () => {
    it('should mark REFUNDED as terminal', () => {
      expect(machine.isTerminal(S.REFUNDED)).toBe(true);
    });

    it('should mark CANCELLED as terminal', () => {
      expect(machine.isTerminal(S.CANCELLED)).toBe(true);
    });

    it('should not mark non-terminal states as terminal', () => {
      for (const status of NON_TERMINAL_STATES) {
        expect(machine.isTerminal(status)).toBe(false);
      }
    });

    it('should not allow any transition from REFUNDED', () => {
      for (const target of ALL_STATES) {
        expect(machine.validateTransition(S.REFUNDED, target)).toBe(false);
      }
    });

    it('should not allow any transition from CANCELLED', () => {
      for (const target of ALL_STATES) {
        expect(machine.validateTransition(S.CANCELLED, target)).toBe(false);
      }
    });

    it('should return empty array for getNextStatuses(REFUNDED)', () => {
      expect(machine.getNextStatuses(S.REFUNDED)).toEqual([]);
    });

    it('should return empty array for getNextStatuses(CANCELLED)', () => {
      expect(machine.getNextStatuses(S.CANCELLED)).toEqual([]);
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

  // ── Invalid transitions ───────────────────────────────────────────
  describe('invalid transitions', () => {
    it('should reject QUOTED -> CONFIRMED (must go through ORDERED)', () => {
      expect(machine.validateTransition(S.QUOTED, S.CONFIRMED)).toBe(false);
    });

    it('should reject QUOTED -> SHIPPED_CN (skip multiple steps)', () => {
      expect(machine.validateTransition(S.QUOTED, S.SHIPPED_CN)).toBe(false);
    });

    it('should reject ORDERED -> SHIPPED_CN (must be CONFIRMED first)', () => {
      expect(machine.validateTransition(S.ORDERED, S.SHIPPED_CN)).toBe(false);
    });

    it('should reject ORDERED -> PARTIALLY_SHIPPED (must be CONFIRMED first)', () => {
      expect(machine.validateTransition(S.ORDERED, S.PARTIALLY_SHIPPED)).toBe(false);
    });

    it('should reject backward CONFIRMED -> QUOTED', () => {
      expect(machine.validateTransition(S.CONFIRMED, S.QUOTED)).toBe(false);
    });

    it('should reject backward CONFIRMED -> DRAFT', () => {
      expect(machine.validateTransition(S.CONFIRMED, S.DRAFT)).toBe(false);
    });

    it('should reject backward SHIPPED_CN -> CONFIRMED', () => {
      expect(machine.validateTransition(S.SHIPPED_CN, S.CONFIRMED)).toBe(false);
    });

    it('should reject RECEIVED_CN -> REFUNDED (must go through RETURN_IN_PROGRESS)', () => {
      expect(machine.validateTransition(S.RECEIVED_CN, S.REFUNDED)).toBe(false);
    });

    it('should reject DRAFT -> CONFIRMED (skip QUOTED/ORDERED)', () => {
      expect(machine.validateTransition(S.DRAFT, S.CONFIRMED)).toBe(false);
    });

    it('should reject DRAFT -> SHIPPED_CN', () => {
      expect(machine.validateTransition(S.DRAFT, S.SHIPPED_CN)).toBe(false);
    });

    it('should reject DRAFT -> RECEIVED_CN', () => {
      expect(machine.validateTransition(S.DRAFT, S.RECEIVED_CN)).toBe(false);
    });

    it('should reject DRAFT -> REFUNDED', () => {
      expect(machine.validateTransition(S.DRAFT, S.REFUNDED)).toBe(false);
    });
  });

  // ── assertTransition ──────────────────────────────────────────────
  describe('assertTransition', () => {
    it('should not throw for valid transition DRAFT -> QUOTED', () => {
      expect(() => machine.assertTransition(S.DRAFT, S.QUOTED)).not.toThrow();
    });

    it('should not throw for valid transition DRAFT -> ORDERED (fast track)', () => {
      expect(() => machine.assertTransition(S.DRAFT, S.ORDERED)).not.toThrow();
    });

    it('should not throw for valid transition ISSUE -> CANCELLED', () => {
      expect(() => machine.assertTransition(S.ISSUE, S.CANCELLED)).not.toThrow();
    });

    it('should throw BadRequestException for DRAFT -> CONFIRMED', () => {
      expect(() => machine.assertTransition(S.DRAFT, S.CONFIRMED)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for CANCELLED -> DRAFT', () => {
      expect(() => machine.assertTransition(S.CANCELLED, S.DRAFT)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for REFUNDED -> ORDERED', () => {
      expect(() => machine.assertTransition(S.REFUNDED, S.ORDERED)).toThrow(BadRequestException);
    });

    it('should include from and to status in error message', () => {
      expect(() => machine.assertTransition(S.DRAFT, S.SHIPPED_CN)).toThrow(/DRAFT.*SHIPPED_CN/);
    });

    it('should include allowed transitions in error message', () => {
      expect(() => machine.assertTransition(S.DRAFT, S.SHIPPED_CN)).toThrow(/QUOTED/);
    });

    it('should mention "terminal state" when asserting from CANCELLED', () => {
      expect(() => machine.assertTransition(S.CANCELLED, S.DRAFT)).toThrow(/terminal state/);
    });

    it('should mention "terminal state" when asserting from REFUNDED', () => {
      expect(() => machine.assertTransition(S.REFUNDED, S.DRAFT)).toThrow(/terminal state/);
    });
  });

  // ── getNextStatuses ───────────────────────────────────────────────
  describe('getNextStatuses', () => {
    it('should return [QUOTED, ORDERED, CANCELLED] for DRAFT', () => {
      expect(machine.getNextStatuses(S.DRAFT)).toEqual(
        expect.arrayContaining([S.QUOTED, S.ORDERED, S.CANCELLED]),
      );
      expect(machine.getNextStatuses(S.DRAFT)).toHaveLength(3);
    });

    it('should return [ORDERED, CANCELLED] for QUOTED', () => {
      expect(machine.getNextStatuses(S.QUOTED)).toEqual(
        expect.arrayContaining([S.ORDERED, S.CANCELLED]),
      );
      expect(machine.getNextStatuses(S.QUOTED)).toHaveLength(2);
    });

    it('should return [CONFIRMED, CANCELLED, ISSUE] for ORDERED', () => {
      expect(machine.getNextStatuses(S.ORDERED)).toEqual(
        expect.arrayContaining([S.CONFIRMED, S.CANCELLED, S.ISSUE]),
      );
      expect(machine.getNextStatuses(S.ORDERED)).toHaveLength(3);
    });

    it('should return [PARTIALLY_SHIPPED, SHIPPED_CN, CANCELLED, ISSUE] for CONFIRMED', () => {
      expect(machine.getNextStatuses(S.CONFIRMED)).toEqual(
        expect.arrayContaining([S.PARTIALLY_SHIPPED, S.SHIPPED_CN, S.CANCELLED, S.ISSUE]),
      );
      expect(machine.getNextStatuses(S.CONFIRMED)).toHaveLength(4);
    });

    it('should return [SHIPPED_CN, RECEIVED_CN, ISSUE] for PARTIALLY_SHIPPED', () => {
      expect(machine.getNextStatuses(S.PARTIALLY_SHIPPED)).toEqual(
        expect.arrayContaining([S.SHIPPED_CN, S.RECEIVED_CN, S.ISSUE]),
      );
      expect(machine.getNextStatuses(S.PARTIALLY_SHIPPED)).toHaveLength(3);
    });

    it('should return [RECEIVED_CN, ISSUE] for SHIPPED_CN', () => {
      expect(machine.getNextStatuses(S.SHIPPED_CN)).toEqual(
        expect.arrayContaining([S.RECEIVED_CN, S.ISSUE]),
      );
      expect(machine.getNextStatuses(S.SHIPPED_CN)).toHaveLength(2);
    });

    it('should return [RETURN_IN_PROGRESS, ISSUE] for RECEIVED_CN', () => {
      expect(machine.getNextStatuses(S.RECEIVED_CN)).toEqual(
        expect.arrayContaining([S.RETURN_IN_PROGRESS, S.ISSUE]),
      );
      expect(machine.getNextStatuses(S.RECEIVED_CN)).toHaveLength(2);
    });

    it('should return [REFUNDED, ISSUE] for RETURN_IN_PROGRESS', () => {
      expect(machine.getNextStatuses(S.RETURN_IN_PROGRESS)).toEqual(
        expect.arrayContaining([S.REFUNDED, S.ISSUE]),
      );
      expect(machine.getNextStatuses(S.RETURN_IN_PROGRESS)).toHaveLength(2);
    });

    it('should return [ORDERED, CONFIRMED, RETURN_IN_PROGRESS, CANCELLED] for ISSUE', () => {
      expect(machine.getNextStatuses(S.ISSUE)).toEqual(
        expect.arrayContaining([S.ORDERED, S.CONFIRMED, S.RETURN_IN_PROGRESS, S.CANCELLED]),
      );
      expect(machine.getNextStatuses(S.ISSUE)).toHaveLength(4);
    });

    it('should return [] for REFUNDED', () => {
      expect(machine.getNextStatuses(S.REFUNDED)).toEqual([]);
    });

    it('should return [] for CANCELLED', () => {
      expect(machine.getNextStatuses(S.CANCELLED)).toEqual([]);
    });
  });

  // ── Complex scenarios ─────────────────────────────────────────────
  describe('complex scenarios', () => {
    it('should support full lifecycle with partial shipping', () => {
      const path = [S.DRAFT, S.QUOTED, S.ORDERED, S.CONFIRMED, S.PARTIALLY_SHIPPED, S.SHIPPED_CN, S.RECEIVED_CN];
      for (let i = 0; i < path.length - 1; i++) {
        expect(machine.validateTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it('should support issue-then-retry flow: ORDERED -> ISSUE -> CONFIRMED -> SHIPPED_CN', () => {
      expect(machine.validateTransition(S.ORDERED, S.ISSUE)).toBe(true);
      expect(machine.validateTransition(S.ISSUE, S.CONFIRMED)).toBe(true);
      expect(machine.validateTransition(S.CONFIRMED, S.SHIPPED_CN)).toBe(true);
    });

    it('should support issue-then-return flow: SHIPPED_CN -> ISSUE -> RETURN_IN_PROGRESS -> REFUNDED', () => {
      expect(machine.validateTransition(S.SHIPPED_CN, S.ISSUE)).toBe(true);
      expect(machine.validateTransition(S.ISSUE, S.RETURN_IN_PROGRESS)).toBe(true);
      expect(machine.validateTransition(S.RETURN_IN_PROGRESS, S.REFUNDED)).toBe(true);
    });

    it('should support early cancellation: DRAFT -> CANCELLED', () => {
      expect(machine.validateTransition(S.DRAFT, S.CANCELLED)).toBe(true);
      expect(machine.isTerminal(S.CANCELLED)).toBe(true);
    });

    it('should support cancellation after issue: CONFIRMED -> ISSUE -> CANCELLED', () => {
      expect(machine.validateTransition(S.CONFIRMED, S.ISSUE)).toBe(true);
      expect(machine.validateTransition(S.ISSUE, S.CANCELLED)).toBe(true);
    });

    it('should support multiple issue bounces: ORDERED -> ISSUE -> ORDERED -> ISSUE -> CANCELLED', () => {
      expect(machine.validateTransition(S.ORDERED, S.ISSUE)).toBe(true);
      expect(machine.validateTransition(S.ISSUE, S.ORDERED)).toBe(true);
      expect(machine.validateTransition(S.ORDERED, S.ISSUE)).toBe(true);
      expect(machine.validateTransition(S.ISSUE, S.CANCELLED)).toBe(true);
    });
  });

  // ── Exhaustive transition matrix ─────────────────────────────────
  describe('exhaustive transition matrix', () => {
    const validPairs: [SupplierOrderStatus, SupplierOrderStatus][] = [
      // DRAFT -> 3
      [S.DRAFT, S.QUOTED],
      [S.DRAFT, S.ORDERED],
      [S.DRAFT, S.CANCELLED],
      // QUOTED -> 2
      [S.QUOTED, S.ORDERED],
      [S.QUOTED, S.CANCELLED],
      // ORDERED -> 3
      [S.ORDERED, S.CONFIRMED],
      [S.ORDERED, S.CANCELLED],
      [S.ORDERED, S.ISSUE],
      // CONFIRMED -> 4
      [S.CONFIRMED, S.PARTIALLY_SHIPPED],
      [S.CONFIRMED, S.SHIPPED_CN],
      [S.CONFIRMED, S.CANCELLED],
      [S.CONFIRMED, S.ISSUE],
      // PARTIALLY_SHIPPED -> 3
      [S.PARTIALLY_SHIPPED, S.SHIPPED_CN],
      [S.PARTIALLY_SHIPPED, S.RECEIVED_CN],
      [S.PARTIALLY_SHIPPED, S.ISSUE],
      // SHIPPED_CN -> 2
      [S.SHIPPED_CN, S.RECEIVED_CN],
      [S.SHIPPED_CN, S.ISSUE],
      // RECEIVED_CN -> 2
      [S.RECEIVED_CN, S.RETURN_IN_PROGRESS],
      [S.RECEIVED_CN, S.ISSUE],
      // RETURN_IN_PROGRESS -> 2
      [S.RETURN_IN_PROGRESS, S.REFUNDED],
      [S.RETURN_IN_PROGRESS, S.ISSUE],
      // ISSUE -> 4
      [S.ISSUE, S.ORDERED],
      [S.ISSUE, S.CONFIRMED],
      [S.ISSUE, S.RETURN_IN_PROGRESS],
      [S.ISSUE, S.CANCELLED],
    ];

    const allStatuses = Object.values(SupplierOrderStatus);

    it('should have exactly 25 valid transitions in the entire FSM', () => {
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
