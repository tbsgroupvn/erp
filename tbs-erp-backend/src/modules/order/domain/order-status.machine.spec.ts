import { BadRequestException } from '@nestjs/common';
import { OrderStatus, ServiceType } from '@prisma/client';
import { OrderStatusMachine } from './order-status.machine';
import {
  ORDER_LIFECYCLE,
  NON_CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
  RETURN_REQUESTABLE_STATUSES,
} from '@common/constants';

describe('OrderStatusMachine', () => {
  let fsm: OrderStatusMachine;

  beforeEach(() => {
    fsm = new OrderStatusMachine();
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-001: Happy path lifecycle
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-001: Happy path lifecycle transitions', () => {
    const lifecyclePairs: [OrderStatus, OrderStatus][] = [];
    for (let i = 0; i < ORDER_LIFECYCLE.length - 1; i++) {
      lifecyclePairs.push([ORDER_LIFECYCLE[i], ORDER_LIFECYCLE[i + 1]]);
    }

    it.each(lifecyclePairs)(
      'should allow forward transition from %s to %s',
      (from, to) => {
        expect(fsm.validateTransition(from, to)).toBe(true);
      },
    );

    it('should cover all 12 consecutive lifecycle transitions', () => {
      // 13 statuses = 12 consecutive pairs
      expect(lifecyclePairs).toHaveLength(12);
    });

    it('should allow the full lifecycle without throwing', () => {
      for (const [from, to] of lifecyclePairs) {
        expect(() => fsm.assertTransition(from, to)).not.toThrow();
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-002: MHH deposit gate
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-002: MHH deposit gate', () => {
    it('should block QUOTATION -> SOURCING for MHH service type', () => {
      expect(
        fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.MHH),
      ).toBe(false);
    });

    it('should allow QUOTATION -> SOURCING for VCT service type', () => {
      expect(
        fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.VCT),
      ).toBe(true);
    });

    it('should allow QUOTATION -> SOURCING for UTXNK service type', () => {
      expect(
        fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.UTXNK),
      ).toBe(true);
    });

    it('should allow QUOTATION -> SOURCING for LCLCN service type', () => {
      expect(
        fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.LCLCN),
      ).toBe(true);
    });

    it('should allow QUOTATION -> SOURCING when no serviceType is provided', () => {
      expect(
        fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING),
      ).toBe(true);
    });

    it('should allow QUOTATION -> PENDING_DEPOSIT for MHH (the required path)', () => {
      expect(
        fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.PENDING_DEPOSIT, ServiceType.MHH),
      ).toBe(true);
    });

    it('should allow PENDING_DEPOSIT -> SOURCING for MHH (after deposit)', () => {
      expect(
        fsm.validateTransition(OrderStatus.PENDING_DEPOSIT, OrderStatus.SOURCING, ServiceType.MHH),
      ).toBe(true);
    });

    it('should throw BadRequestException for MHH QUOTATION -> SOURCING via assertTransition', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.MHH),
      ).toThrow(BadRequestException);
    });

    it('should include service type in error message for MHH assertion', () => {
      try {
        fsm.assertTransition(OrderStatus.QUOTATION, OrderStatus.SOURCING, ServiceType.MHH);
        fail('Expected BadRequestException to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('MHH');
        expect(err.message).toContain('QUOTATION');
        expect(err.message).toContain('SOURCING');
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-003: Terminal blocking
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-003: Terminal statuses cannot transition', () => {
    const allStatuses = Object.values(OrderStatus);

    it('should not allow any transition from COMPLETED except COMPLETED -> SETTLEMENT (reopen)', () => {
      for (const target of allStatuses) {
        if (target === OrderStatus.SETTLEMENT) {
          expect(fsm.validateTransition(OrderStatus.COMPLETED, target)).toBe(true);
        } else {
          expect(fsm.validateTransition(OrderStatus.COMPLETED, target)).toBe(false);
        }
      }
    });

    it('should not allow any transition from CANCELLED', () => {
      for (const target of allStatuses) {
        expect(fsm.validateTransition(OrderStatus.CANCELLED, target)).toBe(false);
      }
    });

    it('should have COMPLETED with only SETTLEMENT as valid target (reopen by BGD)', () => {
      expect(fsm.getNextStatuses(OrderStatus.COMPLETED)).toEqual([OrderStatus.SETTLEMENT]);
    });

    it('should have CANCELLED in the transition map with empty targets', () => {
      expect(fsm.getNextStatuses(OrderStatus.CANCELLED)).toEqual([]);
    });

    it('should throw when asserting transition from COMPLETED', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.COMPLETED, OrderStatus.CONSULTING),
      ).toThrow(BadRequestException);
    });

    it('should throw when asserting transition from CANCELLED', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.CANCELLED, OrderStatus.CONSULTING),
      ).toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-004: ON_HOLD escape hatch
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-004: ON_HOLD escape hatch', () => {
    it('should allow ON_HOLD to return to every lifecycle status', () => {
      for (const target of ORDER_LIFECYCLE) {
        expect(fsm.validateTransition(OrderStatus.ON_HOLD, target)).toBe(true);
      }
    });

    it('should allow ON_HOLD -> CANCELLED', () => {
      expect(fsm.validateTransition(OrderStatus.ON_HOLD, OrderStatus.CANCELLED)).toBe(true);
    });

    it('should allow ON_HOLD -> ISSUE', () => {
      expect(fsm.validateTransition(OrderStatus.ON_HOLD, OrderStatus.ISSUE)).toBe(true);
    });

    it('should NOT allow ON_HOLD -> RETURNED (not in ON_HOLD targets)', () => {
      expect(fsm.validateTransition(OrderStatus.ON_HOLD, OrderStatus.RETURNED)).toBe(false);
    });

    it('should NOT allow ON_HOLD -> ON_HOLD (self-transition)', () => {
      expect(fsm.validateTransition(OrderStatus.ON_HOLD, OrderStatus.ON_HOLD)).toBe(false);
    });

    it('should return all lifecycle + CANCELLED + ISSUE from getNextStatuses', () => {
      const nextStatuses = fsm.getNextStatuses(OrderStatus.ON_HOLD);
      expect(nextStatuses).toEqual(expect.arrayContaining([
        ...ORDER_LIFECYCLE,
        OrderStatus.CANCELLED,
        OrderStatus.ISSUE,
      ]));
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-005: ISSUE escape hatch
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-005: ISSUE escape hatch', () => {
    it('should allow ISSUE to return to every lifecycle status', () => {
      for (const target of ORDER_LIFECYCLE) {
        expect(fsm.validateTransition(OrderStatus.ISSUE, target)).toBe(true);
      }
    });

    it('should allow ISSUE -> ON_HOLD', () => {
      expect(fsm.validateTransition(OrderStatus.ISSUE, OrderStatus.ON_HOLD)).toBe(true);
    });

    it('should allow ISSUE -> CANCELLED', () => {
      expect(fsm.validateTransition(OrderStatus.ISSUE, OrderStatus.CANCELLED)).toBe(true);
    });

    it('should NOT allow ISSUE -> RETURNED (not in ISSUE targets)', () => {
      expect(fsm.validateTransition(OrderStatus.ISSUE, OrderStatus.RETURNED)).toBe(false);
    });

    it('should NOT allow ISSUE -> ISSUE (self-transition)', () => {
      expect(fsm.validateTransition(OrderStatus.ISSUE, OrderStatus.ISSUE)).toBe(false);
    });

    it('should return all lifecycle + ON_HOLD + CANCELLED from getNextStatuses', () => {
      const nextStatuses = fsm.getNextStatuses(OrderStatus.ISSUE);
      expect(nextStatuses).toEqual(expect.arrayContaining([
        ...ORDER_LIFECYCLE,
        OrderStatus.ON_HOLD,
        OrderStatus.CANCELLED,
      ]));
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-006: Invalid transitions
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-006: Invalid transitions (backward jumps & skips)', () => {
    it('should reject CONSULTING -> COMPLETED (skip entire lifecycle)', () => {
      expect(fsm.validateTransition(OrderStatus.CONSULTING, OrderStatus.COMPLETED)).toBe(false);
    });

    it('should reject SOURCING -> CONSULTING (backward jump)', () => {
      expect(fsm.validateTransition(OrderStatus.SOURCING, OrderStatus.CONSULTING)).toBe(false);
    });

    it('should reject WAREHOUSE_CN -> QUOTATION (backward jump)', () => {
      expect(fsm.validateTransition(OrderStatus.WAREHOUSE_CN, OrderStatus.QUOTATION)).toBe(false);
    });

    it('should reject DELIVERING -> SOURCING (backward jump)', () => {
      expect(fsm.validateTransition(OrderStatus.DELIVERING, OrderStatus.SOURCING)).toBe(false);
    });

    it('should reject CONSULTING -> WAREHOUSE_CN (skip forward)', () => {
      expect(fsm.validateTransition(OrderStatus.CONSULTING, OrderStatus.WAREHOUSE_CN)).toBe(false);
    });

    it('should reject QUOTATION -> IN_TRANSIT (skip forward)', () => {
      expect(fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.IN_TRANSIT)).toBe(false);
    });

    it('should reject IN_TRANSIT -> COMPLETED (skip forward)', () => {
      expect(fsm.validateTransition(OrderStatus.IN_TRANSIT, OrderStatus.COMPLETED)).toBe(false);
    });

    it('should reject SETTLEMENT -> CONSULTING (backward to start)', () => {
      expect(fsm.validateTransition(OrderStatus.SETTLEMENT, OrderStatus.CONSULTING)).toBe(false);
    });

    it('should reject self-transition for lifecycle statuses', () => {
      expect(fsm.validateTransition(OrderStatus.CONSULTING, OrderStatus.CONSULTING)).toBe(false);
      expect(fsm.validateTransition(OrderStatus.SOURCING, OrderStatus.SOURCING)).toBe(false);
      expect(fsm.validateTransition(OrderStatus.IN_TRANSIT, OrderStatus.IN_TRANSIT)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-007: canCancel
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-007: canCancel', () => {
    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.CONSULTING,
      OrderStatus.QUOTATION,
      OrderStatus.PENDING_DEPOSIT,
      OrderStatus.SOURCING,
      OrderStatus.WAREHOUSE_CN,
      OrderStatus.PACKING,
      OrderStatus.CONSOLIDATION,
    ];

    it.each(cancellableStatuses)(
      'should return true for early-stage status %s',
      (status) => {
        expect(fsm.canCancel(status)).toBe(true);
      },
    );

    it.each(NON_CANCELLABLE_STATUSES)(
      'should return false for non-cancellable status %s',
      (status) => {
        expect(fsm.canCancel(status)).toBe(false);
      },
    );

    it('should return true for ON_HOLD (not in non-cancellable list)', () => {
      expect(fsm.canCancel(OrderStatus.ON_HOLD)).toBe(true);
    });

    it('should return true for ISSUE (not in non-cancellable list)', () => {
      expect(fsm.canCancel(OrderStatus.ISSUE)).toBe(true);
    });

    it('should return true for RETURNED (not in non-cancellable list)', () => {
      expect(fsm.canCancel(OrderStatus.RETURNED)).toBe(true);
    });

    it('should return false for CANCELLED (already cancelled)', () => {
      expect(fsm.canCancel(OrderStatus.CANCELLED)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-008: RETURNED access
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-008: RETURNED access', () => {
    it('should allow IN_TRANSIT -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.IN_TRANSIT, OrderStatus.RETURNED)).toBe(true);
    });

    it('should allow CUSTOMS -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.CUSTOMS, OrderStatus.RETURNED)).toBe(true);
    });

    it('should allow WAREHOUSE_VN -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.WAREHOUSE_VN, OrderStatus.RETURNED)).toBe(true);
    });

    it('should allow DELIVERING -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.DELIVERING, OrderStatus.RETURNED)).toBe(true);
    });

    it('should allow SETTLEMENT -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.SETTLEMENT, OrderStatus.RETURNED)).toBe(true);
    });

    it('should NOT allow CONSULTING -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.CONSULTING, OrderStatus.RETURNED)).toBe(false);
    });

    it('should NOT allow QUOTATION -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.QUOTATION, OrderStatus.RETURNED)).toBe(false);
    });

    it('should NOT allow SOURCING -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.SOURCING, OrderStatus.RETURNED)).toBe(false);
    });

    it('should NOT allow WAREHOUSE_CN -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.WAREHOUSE_CN, OrderStatus.RETURNED)).toBe(false);
    });

    it('should NOT allow PACKING -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.PACKING, OrderStatus.RETURNED)).toBe(false);
    });

    it('should NOT allow CONSOLIDATION -> RETURNED', () => {
      expect(fsm.validateTransition(OrderStatus.CONSOLIDATION, OrderStatus.RETURNED)).toBe(false);
    });

    it('should have no transitions from RETURNED (dead end)', () => {
      expect(fsm.getNextStatuses(OrderStatus.RETURNED)).toEqual([]);
    });

    it('should block all transitions FROM RETURNED even though it is not in TERMINAL_STATUSES', () => {
      // RETURNED has empty targets in TRANSITION_MAP so isValidTransition returns false,
      // but it is NOT in TERMINAL_STATUSES — the empty map alone blocks it.
      const allStatuses = Object.values(OrderStatus);
      for (const target of allStatuses) {
        expect(fsm.validateTransition(OrderStatus.RETURNED, target)).toBe(false);
      }
    });

    it('should match RETURN_REQUESTABLE_STATUSES constant', () => {
      for (const status of RETURN_REQUESTABLE_STATUSES) {
        expect(fsm.validateTransition(status, OrderStatus.RETURNED)).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-009: assertTransition throws BadRequestException
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-009: assertTransition throws BadRequestException', () => {
    it('should throw BadRequestException for invalid forward skip', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.CONSULTING, OrderStatus.COMPLETED),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for backward jump', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.SOURCING, OrderStatus.CONSULTING),
      ).toThrow(BadRequestException);
    });

    it('should throw with descriptive message containing from and to statuses', () => {
      try {
        fsm.assertTransition(OrderStatus.CONSULTING, OrderStatus.COMPLETED);
        fail('Expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('CONSULTING');
        expect(err.message).toContain('COMPLETED');
      }
    });

    it('should not throw for a valid transition', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.CONSULTING, OrderStatus.QUOTATION),
      ).not.toThrow();
    });

    it('should NOT throw for COMPLETED -> SETTLEMENT (reopen by BGD)', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.COMPLETED, OrderStatus.SETTLEMENT),
      ).not.toThrow();
    });

    it('should throw for COMPLETED -> CONSULTING (terminal blocks non-SETTLEMENT)', () => {
      expect(() =>
        fsm.assertTransition(OrderStatus.COMPLETED, OrderStatus.CONSULTING),
      ).toThrow(BadRequestException);
    });

    it('should include serviceType in error message when provided', () => {
      try {
        fsm.assertTransition(
          OrderStatus.CONSULTING,
          OrderStatus.COMPLETED,
          ServiceType.VCT,
        );
        fail('Expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('VCT');
      }
    });

    it('should NOT include serviceType in error message when not provided', () => {
      try {
        fsm.assertTransition(OrderStatus.CONSULTING, OrderStatus.COMPLETED);
        fail('Expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        // Should not contain "for service type"
        expect(err.message).not.toContain('for service type');
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-010: getNextStatuses with MHH
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-010: getNextStatuses with MHH service type', () => {
    it('should filter SOURCING from QUOTATION targets for MHH', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION, ServiceType.MHH);
      expect(targets).not.toContain(OrderStatus.SOURCING);
    });

    it('should still include PENDING_DEPOSIT in QUOTATION targets for MHH', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION, ServiceType.MHH);
      expect(targets).toContain(OrderStatus.PENDING_DEPOSIT);
    });

    it('should still include ON_HOLD in QUOTATION targets for MHH', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION, ServiceType.MHH);
      expect(targets).toContain(OrderStatus.ON_HOLD);
    });

    it('should still include CANCELLED in QUOTATION targets for MHH', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION, ServiceType.MHH);
      expect(targets).toContain(OrderStatus.CANCELLED);
    });

    it('should still include ISSUE in QUOTATION targets for MHH', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION, ServiceType.MHH);
      expect(targets).toContain(OrderStatus.ISSUE);
    });

    it('should not affect other statuses for MHH (e.g., CONSULTING)', () => {
      const withMHH = fsm.getNextStatuses(OrderStatus.CONSULTING, ServiceType.MHH);
      const withoutServiceType = fsm.getNextStatuses(OrderStatus.CONSULTING);
      expect(withMHH).toEqual(withoutServiceType);
    });

    it('should not affect PENDING_DEPOSIT targets for MHH', () => {
      const targets = fsm.getNextStatuses(OrderStatus.PENDING_DEPOSIT, ServiceType.MHH);
      expect(targets).toContain(OrderStatus.SOURCING);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-011: getNextStatuses without serviceType
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-011: getNextStatuses without serviceType', () => {
    it('should include SOURCING in QUOTATION targets when no serviceType', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION);
      expect(targets).toContain(OrderStatus.SOURCING);
    });

    it('should include PENDING_DEPOSIT in QUOTATION targets when no serviceType', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION);
      expect(targets).toContain(OrderStatus.PENDING_DEPOSIT);
    });

    it('should return correct targets for CONSULTING', () => {
      const targets = fsm.getNextStatuses(OrderStatus.CONSULTING);
      expect(targets).toEqual(expect.arrayContaining([
        OrderStatus.QUOTATION,
        OrderStatus.ON_HOLD,
        OrderStatus.CANCELLED,
        OrderStatus.ISSUE,
      ]));
      expect(targets).toHaveLength(4);
    });

    it('should return correct targets for IN_TRANSIT', () => {
      const targets = fsm.getNextStatuses(OrderStatus.IN_TRANSIT);
      expect(targets).toEqual(expect.arrayContaining([
        OrderStatus.CUSTOMS,
        OrderStatus.ON_HOLD,
        OrderStatus.ISSUE,
        OrderStatus.RETURNED,
      ]));
      expect(targets).toHaveLength(4);
    });

    it('should return [SETTLEMENT] for COMPLETED (reopen)', () => {
      expect(fsm.getNextStatuses(OrderStatus.COMPLETED)).toEqual([OrderStatus.SETTLEMENT]);
    });

    it('should return empty array for CANCELLED', () => {
      expect(fsm.getNextStatuses(OrderStatus.CANCELLED)).toEqual([]);
    });

    it('should return empty array for RETURNED', () => {
      expect(fsm.getNextStatuses(OrderStatus.RETURNED)).toEqual([]);
    });

    it('should include SOURCING in QUOTATION targets for VCT', () => {
      const targets = fsm.getNextStatuses(OrderStatus.QUOTATION, ServiceType.VCT);
      expect(targets).toContain(OrderStatus.SOURCING);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-ORD-012: isTerminal
  // ─────────────────────────────────────────────────────────
  describe('TC-ORD-012: isTerminal', () => {
    it('should return true for COMPLETED', () => {
      expect(fsm.isTerminal(OrderStatus.COMPLETED)).toBe(true);
    });

    it('should return true for CANCELLED', () => {
      expect(fsm.isTerminal(OrderStatus.CANCELLED)).toBe(true);
    });

    it('should return false for CONSULTING', () => {
      expect(fsm.isTerminal(OrderStatus.CONSULTING)).toBe(false);
    });

    it('should return false for RETURNED (dead end but not terminal)', () => {
      // RETURNED has no outgoing transitions but is NOT in TERMINAL_STATUSES.
      // This is intentional: RETURNED is a special status, not terminal.
      expect(fsm.isTerminal(OrderStatus.RETURNED)).toBe(false);
    });

    it('should return false for ON_HOLD', () => {
      expect(fsm.isTerminal(OrderStatus.ON_HOLD)).toBe(false);
    });

    it('should return false for ISSUE', () => {
      expect(fsm.isTerminal(OrderStatus.ISSUE)).toBe(false);
    });

    it('should return false for all lifecycle statuses except COMPLETED', () => {
      const nonTerminalLifecycle = ORDER_LIFECYCLE.filter(
        (s) => s !== OrderStatus.COMPLETED,
      );
      for (const status of nonTerminalLifecycle) {
        expect(fsm.isTerminal(status)).toBe(false);
      }
    });

    it('should match TERMINAL_STATUSES constant exactly', () => {
      const allStatuses = Object.values(OrderStatus);
      const terminalFromFsm = allStatuses.filter((s) => fsm.isTerminal(s));
      expect(terminalFromFsm.sort()).toEqual([...TERMINAL_STATUSES].sort());
    });
  });

  // ─────────────────────────────────────────────────────────
  // Additional: Every lifecycle status can go to ON_HOLD
  // ─────────────────────────────────────────────────────────
  describe('Every non-terminal lifecycle status can go to ON_HOLD', () => {
    const nonTerminalLifecycle = ORDER_LIFECYCLE.filter(
      (s) => !TERMINAL_STATUSES.includes(s),
    );

    it.each(nonTerminalLifecycle)(
      'should allow %s -> ON_HOLD',
      (status) => {
        expect(fsm.validateTransition(status, OrderStatus.ON_HOLD)).toBe(true);
      },
    );
  });

  // ─────────────────────────────────────────────────────────
  // Additional: Every non-terminal lifecycle status can go to ISSUE
  // ─────────────────────────────────────────────────────────
  describe('Every non-terminal lifecycle status can go to ISSUE', () => {
    const nonTerminalLifecycle = ORDER_LIFECYCLE.filter(
      (s) => !TERMINAL_STATUSES.includes(s),
    );

    it.each(nonTerminalLifecycle)(
      'should allow %s -> ISSUE',
      (status) => {
        expect(fsm.validateTransition(status, OrderStatus.ISSUE)).toBe(true);
      },
    );
  });

  // ─────────────────────────────────────────────────────────
  // Additional: IN_TRANSIT cannot be cancelled (but CAN go ON_HOLD)
  // ─────────────────────────────────────────────────────────
  describe('IN_TRANSIT onwards: no direct CANCELLED transition', () => {
    const postTransitStatuses = [
      OrderStatus.IN_TRANSIT,
      OrderStatus.CUSTOMS,
      OrderStatus.WAREHOUSE_VN,
      OrderStatus.DELIVERING,
      OrderStatus.SETTLEMENT,
    ];

    it.each(postTransitStatuses)(
      'should reject %s -> CANCELLED',
      (status) => {
        expect(fsm.validateTransition(status, OrderStatus.CANCELLED)).toBe(false);
      },
    );
  });

  // ─────────────────────────────────────────────────────────
  // Additional: Pre-transit statuses CAN transition to CANCELLED
  // ─────────────────────────────────────────────────────────
  describe('Pre-transit statuses allow direct CANCELLED transition', () => {
    const preCancellableStatuses = [
      OrderStatus.CONSULTING,
      OrderStatus.QUOTATION,
      OrderStatus.PENDING_DEPOSIT,
      OrderStatus.SOURCING,
      OrderStatus.WAREHOUSE_CN,
      OrderStatus.PACKING,
      OrderStatus.CONSOLIDATION,
    ];

    it.each(preCancellableStatuses)(
      'should allow %s -> CANCELLED',
      (status) => {
        expect(fsm.validateTransition(status, OrderStatus.CANCELLED)).toBe(true);
      },
    );
  });

  // ─────────────────────────────────────────────────────────
  // Additional: SETTLEMENT is the gateway to COMPLETED
  // ─────────────────────────────────────────────────────────
  describe('SETTLEMENT is the only gateway to COMPLETED', () => {
    it('should allow SETTLEMENT -> COMPLETED', () => {
      expect(fsm.validateTransition(OrderStatus.SETTLEMENT, OrderStatus.COMPLETED)).toBe(true);
    });

    it('should reject DELIVERING -> COMPLETED (must go through SETTLEMENT)', () => {
      expect(fsm.validateTransition(OrderStatus.DELIVERING, OrderStatus.COMPLETED)).toBe(false);
    });

    it('should reject WAREHOUSE_VN -> COMPLETED', () => {
      expect(fsm.validateTransition(OrderStatus.WAREHOUSE_VN, OrderStatus.COMPLETED)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Exhaustive transition matrix (no serviceType)
  // ─────────────────────────────────────────────────────────
  describe('exhaustive transition matrix (no serviceType)', () => {
    const validPairs: [OrderStatus, OrderStatus][] = [
      // CONSULTING -> 4
      [OrderStatus.CONSULTING, OrderStatus.QUOTATION],
      [OrderStatus.CONSULTING, OrderStatus.ON_HOLD],
      [OrderStatus.CONSULTING, OrderStatus.CANCELLED],
      [OrderStatus.CONSULTING, OrderStatus.ISSUE],
      // QUOTATION -> 5
      [OrderStatus.QUOTATION, OrderStatus.PENDING_DEPOSIT],
      [OrderStatus.QUOTATION, OrderStatus.SOURCING],
      [OrderStatus.QUOTATION, OrderStatus.ON_HOLD],
      [OrderStatus.QUOTATION, OrderStatus.CANCELLED],
      [OrderStatus.QUOTATION, OrderStatus.ISSUE],
      // PENDING_DEPOSIT -> 4
      [OrderStatus.PENDING_DEPOSIT, OrderStatus.SOURCING],
      [OrderStatus.PENDING_DEPOSIT, OrderStatus.ON_HOLD],
      [OrderStatus.PENDING_DEPOSIT, OrderStatus.CANCELLED],
      [OrderStatus.PENDING_DEPOSIT, OrderStatus.ISSUE],
      // SOURCING -> 4
      [OrderStatus.SOURCING, OrderStatus.WAREHOUSE_CN],
      [OrderStatus.SOURCING, OrderStatus.ON_HOLD],
      [OrderStatus.SOURCING, OrderStatus.CANCELLED],
      [OrderStatus.SOURCING, OrderStatus.ISSUE],
      // WAREHOUSE_CN -> 4
      [OrderStatus.WAREHOUSE_CN, OrderStatus.PACKING],
      [OrderStatus.WAREHOUSE_CN, OrderStatus.ON_HOLD],
      [OrderStatus.WAREHOUSE_CN, OrderStatus.CANCELLED],
      [OrderStatus.WAREHOUSE_CN, OrderStatus.ISSUE],
      // PACKING -> 4
      [OrderStatus.PACKING, OrderStatus.CONSOLIDATION],
      [OrderStatus.PACKING, OrderStatus.ON_HOLD],
      [OrderStatus.PACKING, OrderStatus.CANCELLED],
      [OrderStatus.PACKING, OrderStatus.ISSUE],
      // CONSOLIDATION -> 4
      [OrderStatus.CONSOLIDATION, OrderStatus.IN_TRANSIT],
      [OrderStatus.CONSOLIDATION, OrderStatus.ON_HOLD],
      [OrderStatus.CONSOLIDATION, OrderStatus.CANCELLED],
      [OrderStatus.CONSOLIDATION, OrderStatus.ISSUE],
      // IN_TRANSIT -> 4
      [OrderStatus.IN_TRANSIT, OrderStatus.CUSTOMS],
      [OrderStatus.IN_TRANSIT, OrderStatus.ON_HOLD],
      [OrderStatus.IN_TRANSIT, OrderStatus.ISSUE],
      [OrderStatus.IN_TRANSIT, OrderStatus.RETURNED],
      // CUSTOMS -> 4
      [OrderStatus.CUSTOMS, OrderStatus.WAREHOUSE_VN],
      [OrderStatus.CUSTOMS, OrderStatus.ON_HOLD],
      [OrderStatus.CUSTOMS, OrderStatus.ISSUE],
      [OrderStatus.CUSTOMS, OrderStatus.RETURNED],
      // WAREHOUSE_VN -> 4
      [OrderStatus.WAREHOUSE_VN, OrderStatus.DELIVERING],
      [OrderStatus.WAREHOUSE_VN, OrderStatus.ON_HOLD],
      [OrderStatus.WAREHOUSE_VN, OrderStatus.ISSUE],
      [OrderStatus.WAREHOUSE_VN, OrderStatus.RETURNED],
      // DELIVERING -> 4
      [OrderStatus.DELIVERING, OrderStatus.SETTLEMENT],
      [OrderStatus.DELIVERING, OrderStatus.ON_HOLD],
      [OrderStatus.DELIVERING, OrderStatus.ISSUE],
      [OrderStatus.DELIVERING, OrderStatus.RETURNED],
      // SETTLEMENT -> 4
      [OrderStatus.SETTLEMENT, OrderStatus.COMPLETED],
      [OrderStatus.SETTLEMENT, OrderStatus.ON_HOLD],
      [OrderStatus.SETTLEMENT, OrderStatus.ISSUE],
      [OrderStatus.SETTLEMENT, OrderStatus.RETURNED],
      // COMPLETED -> 1 (terminal exception: reopen to SETTLEMENT)
      [OrderStatus.COMPLETED, OrderStatus.SETTLEMENT],
      // CANCELLED -> 0 (terminal, no exceptions)
      // RETURNED -> 0 (dead end, no outgoing)
      // ON_HOLD -> 15 (all 13 lifecycle + CANCELLED + ISSUE)
      [OrderStatus.ON_HOLD, OrderStatus.CONSULTING],
      [OrderStatus.ON_HOLD, OrderStatus.QUOTATION],
      [OrderStatus.ON_HOLD, OrderStatus.PENDING_DEPOSIT],
      [OrderStatus.ON_HOLD, OrderStatus.SOURCING],
      [OrderStatus.ON_HOLD, OrderStatus.WAREHOUSE_CN],
      [OrderStatus.ON_HOLD, OrderStatus.PACKING],
      [OrderStatus.ON_HOLD, OrderStatus.CONSOLIDATION],
      [OrderStatus.ON_HOLD, OrderStatus.IN_TRANSIT],
      [OrderStatus.ON_HOLD, OrderStatus.CUSTOMS],
      [OrderStatus.ON_HOLD, OrderStatus.WAREHOUSE_VN],
      [OrderStatus.ON_HOLD, OrderStatus.DELIVERING],
      [OrderStatus.ON_HOLD, OrderStatus.SETTLEMENT],
      [OrderStatus.ON_HOLD, OrderStatus.COMPLETED],
      [OrderStatus.ON_HOLD, OrderStatus.CANCELLED],
      [OrderStatus.ON_HOLD, OrderStatus.ISSUE],
      // ISSUE -> 15 (all 13 lifecycle + ON_HOLD + CANCELLED)
      [OrderStatus.ISSUE, OrderStatus.CONSULTING],
      [OrderStatus.ISSUE, OrderStatus.QUOTATION],
      [OrderStatus.ISSUE, OrderStatus.PENDING_DEPOSIT],
      [OrderStatus.ISSUE, OrderStatus.SOURCING],
      [OrderStatus.ISSUE, OrderStatus.WAREHOUSE_CN],
      [OrderStatus.ISSUE, OrderStatus.PACKING],
      [OrderStatus.ISSUE, OrderStatus.CONSOLIDATION],
      [OrderStatus.ISSUE, OrderStatus.IN_TRANSIT],
      [OrderStatus.ISSUE, OrderStatus.CUSTOMS],
      [OrderStatus.ISSUE, OrderStatus.WAREHOUSE_VN],
      [OrderStatus.ISSUE, OrderStatus.DELIVERING],
      [OrderStatus.ISSUE, OrderStatus.SETTLEMENT],
      [OrderStatus.ISSUE, OrderStatus.COMPLETED],
      [OrderStatus.ISSUE, OrderStatus.ON_HOLD],
      [OrderStatus.ISSUE, OrderStatus.CANCELLED],
    ];

    const allStatuses = Object.values(OrderStatus);

    it('should have exactly 80 valid transitions in the entire FSM (no serviceType)', () => {
      let validCount = 0;
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          if (fsm.validateTransition(from, to)) {
            validCount++;
          }
        }
      }
      expect(validCount).toBe(validPairs.length);
    });

    it('should throw for every invalid transition (no serviceType)', () => {
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          if (!fsm.validateTransition(from, to)) {
            expect(() => fsm.assertTransition(from, to)).toThrow(BadRequestException);
          }
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // Exhaustive transition matrix (MHH serviceType)
  // ─────────────────────────────────────────────────────────
  describe('exhaustive transition matrix (MHH serviceType)', () => {
    const allStatuses = Object.values(OrderStatus);

    it('should have exactly 79 valid transitions for MHH (1 fewer than default)', () => {
      let validCount = 0;
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          if (fsm.validateTransition(from, to, ServiceType.MHH)) {
            validCount++;
          }
        }
      }
      // MHH blocks QUOTATION->SOURCING, so 80 - 1 = 79
      expect(validCount).toBe(79);
    });

    it('should confirm QUOTATION->SOURCING is the only difference from default', () => {
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          const defaultResult = fsm.validateTransition(from, to);
          const mhhResult = fsm.validateTransition(from, to, ServiceType.MHH);
          if (defaultResult !== mhhResult) {
            // The only difference should be QUOTATION->SOURCING
            expect(from).toBe(OrderStatus.QUOTATION);
            expect(to).toBe(OrderStatus.SOURCING);
            expect(defaultResult).toBe(true);
            expect(mhhResult).toBe(false);
          }
        }
      }
    });

    it('should throw for every invalid MHH transition', () => {
      for (const from of allStatuses) {
        for (const to of allStatuses) {
          if (!fsm.validateTransition(from, to, ServiceType.MHH)) {
            expect(() => fsm.assertTransition(from, to, ServiceType.MHH)).toThrow(BadRequestException);
          }
        }
      }
    });
  });
});
