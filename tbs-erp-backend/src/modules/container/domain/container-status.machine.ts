import { Injectable } from '@nestjs/common';
import { ContainerStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Container Status Finite State Machine.
 *
 * Manages container lifecycle transitions.
 * Key rules:
 *  - PLANNING can move to LOADING
 *  - LOADING can move to IN_TRANSIT
 *  - IN_TRANSIT can move to ARRIVED or ON_HOLD_BORDER
 *  - ON_HOLD_BORDER can resume to IN_TRANSIT or move to ARRIVED
 *  - ARRIVED can move to CUSTOMS
 *  - CUSTOMS can move to COMPLETED or CUSTOMS_HOLD (partial clearance)
 *  - CUSTOMS_HOLD can move back to CUSTOMS or to COMPLETED (all held resolved)
 *  - COMPLETED is a terminal state
 */
@Injectable()
export class ContainerStatusMachine extends BaseStatusMachine<ContainerStatus> {
  constructor() {
    super(
      {
        PLANNING: [ContainerStatus.LOADING],
        LOADING: [ContainerStatus.IN_TRANSIT],
        IN_TRANSIT: [ContainerStatus.ARRIVED, ContainerStatus.ON_HOLD_BORDER],
        ON_HOLD_BORDER: [ContainerStatus.IN_TRANSIT, ContainerStatus.ARRIVED],
        ARRIVED: [ContainerStatus.CUSTOMS],
        CUSTOMS: [ContainerStatus.COMPLETED, ContainerStatus.CUSTOMS_HOLD],
        CUSTOMS_HOLD: [ContainerStatus.CUSTOMS, ContainerStatus.COMPLETED],
        COMPLETED: [],
      },
      [ContainerStatus.COMPLETED],
    );
  }
}
