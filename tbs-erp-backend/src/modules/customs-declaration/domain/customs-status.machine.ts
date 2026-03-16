import { Injectable } from '@nestjs/common';
import { CustomsDeclarationStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Customs Declaration Status Finite State Machine.
 *
 * Manages customs declaration lifecycle transitions.
 * Key rules:
 *  - DRAFT can move to READY or CANCELLED
 *  - READY can move to SUBMITTED, back to DRAFT, or CANCELLED
 *  - SUBMITTED can be CHANNEL_ASSIGNED, REJECTED, or CANCELLED
 *  - CHANNEL_ASSIGNED can move to INSPECTING (YELLOW/RED) or CLEARED (GREEN)
 *  - INSPECTING can be CLEARED or REJECTED
 *  - CLEARED and CANCELLED are terminal states
 *  - REJECTED can be revised back to DRAFT
 */
@Injectable()
export class CustomsStatusMachine extends BaseStatusMachine<CustomsDeclarationStatus> {
  constructor() {
    super(
      {
        DRAFT: [CustomsDeclarationStatus.READY, CustomsDeclarationStatus.CANCELLED],
        READY: [
          CustomsDeclarationStatus.SUBMITTED,
          CustomsDeclarationStatus.DRAFT,
          CustomsDeclarationStatus.CANCELLED,
        ],
        SUBMITTED: [
          CustomsDeclarationStatus.CHANNEL_ASSIGNED,
          CustomsDeclarationStatus.REJECTED,
          CustomsDeclarationStatus.CANCELLED,
        ],
        CHANNEL_ASSIGNED: [CustomsDeclarationStatus.INSPECTING, CustomsDeclarationStatus.CLEARED],
        INSPECTING: [CustomsDeclarationStatus.CLEARED, CustomsDeclarationStatus.REJECTED],
        CLEARED: [],
        REJECTED: [CustomsDeclarationStatus.DRAFT],
        CANCELLED: [],
      },
      [CustomsDeclarationStatus.CLEARED, CustomsDeclarationStatus.CANCELLED],
    );
  }
}

/**
 * Standalone validation function for use outside of DI context.
 *
 * @param from - Current status string
 * @param to - Target status string
 * @returns true if the transition is valid
 */
export function validateTransition(from: string, to: string): boolean {
  const transitionMap: Record<string, string[]> = {
    DRAFT: ['READY', 'CANCELLED'],
    READY: ['SUBMITTED', 'DRAFT', 'CANCELLED'],
    SUBMITTED: ['CHANNEL_ASSIGNED', 'REJECTED', 'CANCELLED'],
    CHANNEL_ASSIGNED: ['INSPECTING', 'CLEARED'],
    INSPECTING: ['CLEARED', 'REJECTED'],
    CLEARED: [],
    REJECTED: ['DRAFT'],
    CANCELLED: [],
  };

  const allowed = transitionMap[from];
  if (!allowed) {
    return false;
  }

  return allowed.includes(to);
}
