import { Injectable } from '@nestjs/common';
import { WarehouseVNStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Warehouse VN (Vietnam) Status Finite State Machine.
 *
 * Manages Vietnam warehouse package lifecycle transitions.
 * Key rules:
 *  - RECEIVED can move to SORTED
 *  - SORTED can move to READY
 *  - READY can move to DELIVERED
 *  - DELIVERED is a terminal state
 */
@Injectable()
export class WarehouseVNStatusMachine extends BaseStatusMachine<WarehouseVNStatus> {
  constructor() {
    super(
      {
        [WarehouseVNStatus.RECEIVED]: [WarehouseVNStatus.SORTED],
        [WarehouseVNStatus.SORTED]: [WarehouseVNStatus.READY],
        [WarehouseVNStatus.READY]: [WarehouseVNStatus.DELIVERED],
        [WarehouseVNStatus.DELIVERED]: [],
      },
      [WarehouseVNStatus.DELIVERED],
    );
  }
}
