import { BadRequestException } from '@nestjs/common';
import { BaseStatusMachine } from './base-status-machine';

// ---------------------------------------------------------------------------
// Test FSM: a minimal 3-state machine used to exercise the abstract base class
// ---------------------------------------------------------------------------

enum TestStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

const TEST_TRANSITIONS: Record<string, TestStatus[]> = {
  [TestStatus.DRAFT]: [TestStatus.ACTIVE],
  [TestStatus.ACTIVE]: [TestStatus.CLOSED],
  [TestStatus.CLOSED]: [], // terminal — no outgoing edges
};

const TEST_TERMINAL: TestStatus[] = [TestStatus.CLOSED];

class TestStatusMachine extends BaseStatusMachine<TestStatus> {
  constructor() {
    super(TEST_TRANSITIONS, TEST_TERMINAL);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseStatusMachine', () => {
  let machine: TestStatusMachine;

  beforeEach(() => {
    machine = new TestStatusMachine();
  });

  // -----------------------------------------------------------------------
  // validateTransition
  // -----------------------------------------------------------------------
  describe('validateTransition', () => {
    it('should return true for a valid forward transition (DRAFT -> ACTIVE)', () => {
      expect(machine.validateTransition(TestStatus.DRAFT, TestStatus.ACTIVE)).toBe(true);
    });

    it('should return true for a valid forward transition (ACTIVE -> CLOSED)', () => {
      expect(machine.validateTransition(TestStatus.ACTIVE, TestStatus.CLOSED)).toBe(true);
    });

    it('should return false for an invalid transition (DRAFT -> CLOSED)', () => {
      expect(machine.validateTransition(TestStatus.DRAFT, TestStatus.CLOSED)).toBe(false);
    });

    it('should return false for a reverse transition (ACTIVE -> DRAFT)', () => {
      expect(machine.validateTransition(TestStatus.ACTIVE, TestStatus.DRAFT)).toBe(false);
    });

    it('should return false when the "from" status is unknown', () => {
      expect(machine.validateTransition('NONEXISTENT' as TestStatus, TestStatus.ACTIVE)).toBe(
        false,
      );
    });

    it('should return false when the "to" status is unknown', () => {
      expect(machine.validateTransition(TestStatus.DRAFT, 'NONEXISTENT' as TestStatus)).toBe(
        false,
      );
    });

    it('should return false when both statuses are unknown', () => {
      expect(
        machine.validateTransition('FOO' as TestStatus, 'BAR' as TestStatus),
      ).toBe(false);
    });

    it('should return false from a terminal status (CLOSED has no outgoing transitions)', () => {
      expect(machine.validateTransition(TestStatus.CLOSED, TestStatus.DRAFT)).toBe(false);
      expect(machine.validateTransition(TestStatus.CLOSED, TestStatus.ACTIVE)).toBe(false);
      expect(machine.validateTransition(TestStatus.CLOSED, TestStatus.CLOSED)).toBe(false);
    });

    it('should return false for a self-transition when not explicitly allowed', () => {
      expect(machine.validateTransition(TestStatus.DRAFT, TestStatus.DRAFT)).toBe(false);
      expect(machine.validateTransition(TestStatus.ACTIVE, TestStatus.ACTIVE)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // assertTransition
  // -----------------------------------------------------------------------
  describe('assertTransition', () => {
    it('should not throw for a valid transition', () => {
      expect(() => machine.assertTransition(TestStatus.DRAFT, TestStatus.ACTIVE)).not.toThrow();
    });

    it('should not throw for another valid transition', () => {
      expect(() => machine.assertTransition(TestStatus.ACTIVE, TestStatus.CLOSED)).not.toThrow();
    });

    it('should throw BadRequestException for an invalid transition', () => {
      expect(() => machine.assertTransition(TestStatus.DRAFT, TestStatus.CLOSED)).toThrow(
        BadRequestException,
      );
    });

    it('should include from status in the error message', () => {
      expect(() => machine.assertTransition(TestStatus.DRAFT, TestStatus.CLOSED)).toThrow(
        /DRAFT/,
      );
    });

    it('should include to status in the error message', () => {
      expect(() => machine.assertTransition(TestStatus.DRAFT, TestStatus.CLOSED)).toThrow(
        /CLOSED/,
      );
    });

    it('should include the allowed transitions list in the error message', () => {
      // DRAFT can only go to ACTIVE, so the error message should contain "ACTIVE"
      expect(() => machine.assertTransition(TestStatus.DRAFT, TestStatus.CLOSED)).toThrow(
        /ACTIVE/,
      );
    });

    it('should show "none (terminal state)" for transitions from a terminal status', () => {
      expect(() => machine.assertTransition(TestStatus.CLOSED, TestStatus.DRAFT)).toThrow(
        /none \(terminal state\)/,
      );
    });

    it('should show "none (terminal state)" for unknown from status with no transitions', () => {
      expect(() =>
        machine.assertTransition('UNKNOWN' as TestStatus, TestStatus.ACTIVE),
      ).toThrow(/none \(terminal state\)/);
    });

    it('should throw with a complete, readable error message', () => {
      try {
        machine.assertTransition(TestStatus.ACTIVE, TestStatus.DRAFT);
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const message = (error as BadRequestException).message;
        expect(message).toContain('Invalid status transition from ACTIVE to DRAFT');
        expect(message).toContain('Allowed transitions: CLOSED');
      }
    });
  });

  // -----------------------------------------------------------------------
  // getNextStatuses
  // -----------------------------------------------------------------------
  describe('getNextStatuses', () => {
    it('should return the correct list for a non-terminal status with one target', () => {
      expect(machine.getNextStatuses(TestStatus.DRAFT)).toEqual([TestStatus.ACTIVE]);
    });

    it('should return the correct list for another non-terminal status', () => {
      expect(machine.getNextStatuses(TestStatus.ACTIVE)).toEqual([TestStatus.CLOSED]);
    });

    it('should return an empty array for a terminal status', () => {
      expect(machine.getNextStatuses(TestStatus.CLOSED)).toEqual([]);
    });

    it('should return an empty array for an unknown status', () => {
      expect(machine.getNextStatuses('NONEXISTENT' as TestStatus)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // isTerminal
  // -----------------------------------------------------------------------
  describe('isTerminal', () => {
    it('should return true for a terminal status', () => {
      expect(machine.isTerminal(TestStatus.CLOSED)).toBe(true);
    });

    it('should return false for a non-terminal status (DRAFT)', () => {
      expect(machine.isTerminal(TestStatus.DRAFT)).toBe(false);
    });

    it('should return false for a non-terminal status (ACTIVE)', () => {
      expect(machine.isTerminal(TestStatus.ACTIVE)).toBe(false);
    });

    it('should return false for an unknown status', () => {
      expect(machine.isTerminal('NONEXISTENT' as TestStatus)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases with a richer FSM (multiple outgoing edges)
  // -----------------------------------------------------------------------
  describe('multi-target FSM', () => {
    enum RichStatus {
      OPEN = 'OPEN',
      IN_PROGRESS = 'IN_PROGRESS',
      ON_HOLD = 'ON_HOLD',
      DONE = 'DONE',
      CANCELLED = 'CANCELLED',
    }

    class RichStatusMachine extends BaseStatusMachine<RichStatus> {
      constructor() {
        super(
          {
            [RichStatus.OPEN]: [RichStatus.IN_PROGRESS, RichStatus.CANCELLED],
            [RichStatus.IN_PROGRESS]: [RichStatus.ON_HOLD, RichStatus.DONE, RichStatus.CANCELLED],
            [RichStatus.ON_HOLD]: [RichStatus.IN_PROGRESS, RichStatus.CANCELLED],
            [RichStatus.DONE]: [],
            [RichStatus.CANCELLED]: [],
          },
          [RichStatus.DONE, RichStatus.CANCELLED],
        );
      }
    }

    let rich: RichStatusMachine;

    beforeEach(() => {
      rich = new RichStatusMachine();
    });

    it('should return multiple next statuses when available', () => {
      const next = rich.getNextStatuses(RichStatus.IN_PROGRESS);
      expect(next).toHaveLength(3);
      expect(next).toContain(RichStatus.ON_HOLD);
      expect(next).toContain(RichStatus.DONE);
      expect(next).toContain(RichStatus.CANCELLED);
    });

    it('should validate all valid transitions from a multi-target status', () => {
      expect(rich.validateTransition(RichStatus.IN_PROGRESS, RichStatus.ON_HOLD)).toBe(true);
      expect(rich.validateTransition(RichStatus.IN_PROGRESS, RichStatus.DONE)).toBe(true);
      expect(rich.validateTransition(RichStatus.IN_PROGRESS, RichStatus.CANCELLED)).toBe(true);
    });

    it('should reject transitions not in the allowed list', () => {
      expect(rich.validateTransition(RichStatus.IN_PROGRESS, RichStatus.OPEN)).toBe(false);
    });

    it('should identify multiple terminal statuses', () => {
      expect(rich.isTerminal(RichStatus.DONE)).toBe(true);
      expect(rich.isTerminal(RichStatus.CANCELLED)).toBe(true);
      expect(rich.isTerminal(RichStatus.OPEN)).toBe(false);
    });

    it('should include all allowed targets in error message for multi-target status', () => {
      // IN_PROGRESS cannot go to OPEN; error should list ON_HOLD, DONE, CANCELLED
      try {
        rich.assertTransition(RichStatus.IN_PROGRESS, RichStatus.OPEN);
        fail('Expected BadRequestException');
      } catch (error) {
        const message = (error as BadRequestException).message;
        expect(message).toContain('ON_HOLD');
        expect(message).toContain('DONE');
        expect(message).toContain('CANCELLED');
      }
    });
  });
});
