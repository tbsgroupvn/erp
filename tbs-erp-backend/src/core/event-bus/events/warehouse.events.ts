/**
 * Base class for all warehouse-related events.
 */
abstract class BaseWarehouseEvent {
  readonly timestamp: Date;

  constructor() {
    this.timestamp = new Date();
  }
}

/**
 * Emitted when a package is received at the China warehouse.
 */
export class PackageReceivedCNEvent extends BaseWarehouseEvent {
  static readonly EVENT_NAME = 'warehouse.package.received.cn';

  constructor(
    public readonly packageId: string,
    public readonly packageCode: string,
    public readonly orderId: string,
    public readonly trackingNumberCN: string | null,
    public readonly actualWeight: number | null,
    public readonly receivedBy: string,
  ) {
    super();
  }
}

/**
 * Emitted when a package is received at the Vietnam warehouse.
 */
export class PackageReceivedVNEvent extends BaseWarehouseEvent {
  static readonly EVENT_NAME = 'warehouse.package.received.vn';

  constructor(
    public readonly packageId: string,
    public readonly packageCode: string,
    public readonly orderId: string,
    public readonly containerId: string | null,
    public readonly actualWeight: number | null,
    public readonly receivedBy: string,
  ) {
    super();
  }
}

/**
 * Emitted when a package is shipped (leaves CN warehouse in a container).
 */
export class PackageShippedEvent extends BaseWarehouseEvent {
  static readonly EVENT_NAME = 'warehouse.package.shipped';

  constructor(
    public readonly packageId: string,
    public readonly packageCode: string,
    public readonly orderId: string,
    public readonly containerId: string,
    public readonly shippingRoute: string,
  ) {
    super();
  }
}
