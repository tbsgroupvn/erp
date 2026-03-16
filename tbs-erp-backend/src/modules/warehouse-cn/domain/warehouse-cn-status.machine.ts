import { Injectable } from '@nestjs/common';
import { WarehouseCNStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Warehouse CN (China) Status Finite State Machine.
 *
 * Manages China warehouse package lifecycle transitions.
 * Key rules:
 *  - RECEIVED can move to CHECKED
 *  - CHECKED can move to PACKED
 *  - PACKED can move to SHIPPED
 *  - SHIPPED is a terminal state
 */
@Injectable()
export class WarehouseCNStatusMachine extends BaseStatusMachine<WarehouseCNStatus> {
  constructor() {
    super(
      {
        [WarehouseCNStatus.RECEIVED]: [WarehouseCNStatus.CHECKED],
        [WarehouseCNStatus.CHECKED]: [WarehouseCNStatus.PACKED],
        [WarehouseCNStatus.PACKED]: [WarehouseCNStatus.SHIPPED],
        [WarehouseCNStatus.SHIPPED]: [],
      },
      [WarehouseCNStatus.SHIPPED],
    );
  }
}
