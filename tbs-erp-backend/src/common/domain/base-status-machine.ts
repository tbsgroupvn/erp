import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/exceptions/error-codes';

/**
 * Abstract base class for all Status Finite State Machines.
 *
 * Eliminates DRY violations across 9 FSM implementations by providing
 * common transition validation, assertion, and query methods.
 *
 * Subclasses only need to supply:
 *  - A transition map (Record<TStatus, TStatus[]>)
 *  - A list of terminal statuses
 *  - Any domain-specific methods unique to that FSM
 *
 * @template TStatus - The status enum type (must extend string)
 */
export abstract class BaseStatusMachine<TStatus extends string> {
  constructor(
    protected readonly transitions: Record<string, TStatus[]>,
    protected readonly terminalStatuses: TStatus[],
  ) {}

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current status
   * @param to - Target status
   * @returns true if the transition is valid
   */
  validateTransition(from: TStatus, to: TStatus): boolean {
    const allowed = this.transitions[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Validates and throws if the transition is invalid.
   * Used by services to enforce transitions.
   *
   * @param from - Current status
   * @param to - Target status
   * @throws DomainException if the transition is not allowed
   */
  assertTransition(from: TStatus, to: TStatus): void {
    if (!this.validateTransition(from, to)) {
      const allowed = this.getNextStatuses(from);
      throw new DomainException(
        ErrorCode.VALIDATION_ERROR,
        `Invalid status transition from ${from} to ${to}. ` +
          `Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: TStatus): TStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: TStatus): boolean {
    return this.terminalStatuses.includes(status);
  }
}
