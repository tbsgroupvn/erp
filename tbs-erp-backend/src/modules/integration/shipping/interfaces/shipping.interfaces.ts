/**
 * Result from tracking a shipment with an external carrier.
 */
export interface TrackingResult {
  /** Carrier name */
  carrier: string;
  /** Tracking number */
  trackingNumber: string;
  /** Current shipment status */
  status:
    | 'PENDING'
    | 'PICKED_UP'
    | 'IN_TRANSIT'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'RETURNED'
    | 'EXCEPTION';
  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;
  /** Actual delivery date (if delivered) */
  actualDeliveryDate?: Date;
  /** Signed by (if delivered) */
  signedBy?: string;
  /** Current location description */
  currentLocation?: string;
  /** Tracking events in chronological order */
  events: TrackingEvent[];
  /** Origin address */
  origin?: string;
  /** Destination address */
  destination?: string;
  /** Weight in KG */
  weightKg?: number;
  /** Last updated from carrier */
  lastUpdated: Date;
}

/**
 * A single tracking event from a carrier.
 */
export interface TrackingEvent {
  /** Event timestamp */
  timestamp: Date;
  /** Event status description */
  status: string;
  /** Location of the event */
  location: string;
  /** Detailed description */
  description: string;
}

/**
 * Shipping rate quote from a carrier.
 */
export interface ShippingRate {
  /** Carrier name */
  carrier: string;
  /** Service type (express, standard, economy) */
  serviceType: string;
  /** Service name */
  serviceName: string;
  /** Base rate */
  baseRate: number;
  /** Fuel surcharge */
  fuelSurcharge: number;
  /** Other surcharges */
  otherSurcharges: number;
  /** Total rate */
  totalRate: number;
  /** Currency */
  currency: string;
  /** Estimated transit days */
  estimatedTransitDays: number;
  /** Estimated delivery date */
  estimatedDeliveryDate: Date;
  /** Whether insurance is included */
  insuranceIncluded: boolean;
  /** Maximum declared value for insurance */
  maxDeclaredValue?: number;
  /** Rate validity (quote expiry) */
  validUntil: Date;
}

/**
 * Result of booking a pickup with a carrier.
 */
export interface PickupResult {
  /** Pickup confirmation number */
  confirmationNumber: string;
  /** Carrier name */
  carrier: string;
  /** Scheduled pickup date */
  scheduledDate: Date;
  /** Pickup time window */
  timeWindow: { from: string; to: string };
  /** Status */
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  /** Pickup location address */
  pickupAddress: string;
  /** Special instructions acknowledged */
  specialInstructions?: string;
  /** Estimated number of packages */
  estimatedPackages: number;
}

/**
 * Information about a supported shipping carrier.
 */
export interface CarrierInfo {
  /** Carrier code (e.g., GHTK, GHN, VIETTEL_POST, J&T) */
  code: string;
  /** Carrier full name */
  name: string;
  /** Whether real-time tracking is available */
  trackingAvailable: boolean;
  /** Whether rate quotes are available */
  rateQuoteAvailable: boolean;
  /** Whether pickup booking is available */
  pickupBookingAvailable: boolean;
  /** Whether webhook callbacks are supported */
  webhookSupported: boolean;
  /** Coverage areas */
  coverageAreas: string[];
  /** Service types offered */
  serviceTypes: string[];
  /** Carrier logo URL */
  logoUrl?: string;
}
