import { Injectable, Logger } from '@nestjs/common';
import { ShippingRoute } from '@prisma/client';

export interface ChargeableWeightResult {
  /** Actual weight in kg */
  actualWeight: number;
  /** Volumetric weight in kg, calculated from dimensions */
  volumetricWeight: number;
  /** The chargeable weight = MAX(actual, volumetric) */
  chargeableWeight: number;
  /** The divisor used for volumetric calculation */
  volumetricDivisor: number;
  /** The shipping route used for calculation */
  route: ShippingRoute;
  /** Whether volumetric weight was used (i.e., exceeded actual) */
  isVolumetric: boolean;
}

/**
 * Chargeable Weight Calculation Service.
 *
 * Calculates the chargeable weight for a package based on its physical
 * dimensions and actual weight. The chargeable weight is the greater of:
 *  - Actual weight (scale measurement)
 *  - Volumetric weight (L x W x H / divisor)
 *
 * Volumetric divisors by shipping route:
 *  - SEA:  6000 (cubic cm to kg)
 *  - ROAD: 5000
 *  - AIR:  5000
 *
 * This is the industry standard formula used in freight forwarding.
 */
@Injectable()
export class ChargeableWeightService {
  private readonly logger = new Logger(ChargeableWeightService.name);

  /**
   * Volumetric weight divisors by shipping route.
   * Divisor represents how many cubic centimeters equal 1 kg.
   */
  private readonly VOLUMETRIC_DIVISORS: Record<ShippingRoute, number> = {
    [ShippingRoute.SEA]: 6000,
    [ShippingRoute.ROAD]: 5000,
    [ShippingRoute.AIR]: 5000,
  };

  /**
   * Calculates the chargeable weight for a package.
   *
   * @param actualWeight - Actual weight measured on a scale (kg)
   * @param length - Length in centimeters
   * @param width - Width in centimeters
   * @param height - Height in centimeters
   * @param route - Shipping route (determines volumetric divisor)
   * @returns Full calculation result with breakdown
   */
  calculateChargeableWeight(
    actualWeight: number,
    length: number,
    width: number,
    height: number,
    route: ShippingRoute,
  ): ChargeableWeightResult {
    const divisor = this.VOLUMETRIC_DIVISORS[route];

    // Volumetric weight formula: L(cm) x W(cm) x H(cm) / divisor
    const volumetricWeight = (length * width * height) / divisor;

    // Round to 2 decimal places
    const roundedVolumetric =
      Math.round(volumetricWeight * 100) / 100;

    // Chargeable weight is the greater of actual vs volumetric
    const chargeableWeight = Math.max(actualWeight, roundedVolumetric);

    const isVolumetric = roundedVolumetric > actualWeight;

    this.logger.debug(
      `Chargeable weight calculation: actual=${actualWeight}kg, ` +
        `volumetric=${roundedVolumetric}kg (${length}x${width}x${height}cm / ${divisor}), ` +
        `chargeable=${chargeableWeight}kg [${isVolumetric ? 'VOLUMETRIC' : 'ACTUAL'}], ` +
        `route=${route}`,
    );

    return {
      actualWeight,
      volumetricWeight: roundedVolumetric,
      chargeableWeight,
      volumetricDivisor: divisor,
      route,
      isVolumetric,
    };
  }

  /**
   * Gets the volumetric divisor for a given shipping route.
   */
  getDivisor(route: ShippingRoute): number {
    return this.VOLUMETRIC_DIVISORS[route];
  }
}
