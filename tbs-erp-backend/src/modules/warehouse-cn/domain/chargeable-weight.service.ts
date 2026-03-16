import { Injectable, Logger } from '@nestjs/common';
import { ShippingRoute } from '@prisma/client';

export interface ChargeableWeightResult {
  /** Actual weight in kg */
  actualWeight: number;
  /** Volumetric weight in kg, calculated from dimensions */
  volumetricWeight: number;
  /** The chargeable weight = MAX(actual, volumetric) */
  chargeableWeight: number;
  /** The CBM-to-kg factor used for volumetric calculation */
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
 *  - Volumetric weight (CBM × factor)
 *
 * CBM-to-kg factors by shipping route:
 *  - SEA:  1 CBM = 1000 kg (sea freight standard)
 *  - ROAD: 1 CBM = 333 kg (road freight standard)
 *  - AIR:  1 CBM = 167 kg (air freight standard)
 *
 * This is the industry standard formula used in freight forwarding.
 */
@Injectable()
export class ChargeableWeightService {
  private readonly logger = new Logger(ChargeableWeightService.name);

  /**
   * CBM-to-kg conversion factors by shipping route.
   * Factor = how many kg per 1 cubic meter (CBM).
   */
  private readonly CBM_FACTORS: Record<ShippingRoute, number> = {
    [ShippingRoute.SEA]: 1000,  // 1 CBM = 1000 kg
    [ShippingRoute.ROAD]: 333,  // 1 CBM = 333 kg
    [ShippingRoute.AIR]: 167,   // 1 CBM = 167 kg
  };

  /**
   * Calculates the chargeable weight for a package.
   *
   * @param actualWeight - Actual weight measured on a scale (kg)
   * @param length - Length in centimeters
   * @param width - Width in centimeters
   * @param height - Height in centimeters
   * @param route - Shipping route (determines CBM factor)
   * @returns Full calculation result with breakdown
   */
  calculateChargeableWeight(
    actualWeight: number,
    length: number,
    width: number,
    height: number,
    route: ShippingRoute,
  ): ChargeableWeightResult {
    const cbmFactor = this.CBM_FACTORS[route];

    // Volumetric weight formula: CBM × factor
    // where CBM = L(cm) × W(cm) × H(cm) / 1,000,000
    const cbm = (length * width * height) / 1_000_000;
    const volumetricWeight = cbm * cbmFactor;

    // Round to 2 decimal places
    const roundedVolumetric = Math.round(volumetricWeight * 100) / 100;

    // Chargeable weight is the greater of actual vs volumetric
    const chargeableWeight = Math.max(actualWeight, roundedVolumetric);

    const isVolumetric = roundedVolumetric > actualWeight;

    this.logger.debug(
      `Chargeable weight calculation: actual=${actualWeight}kg, ` +
        `volumetric=${roundedVolumetric}kg (${length}x${width}x${height}cm, CBM=${cbm.toFixed(4)}, factor=${cbmFactor}), ` +
        `chargeable=${chargeableWeight}kg [${isVolumetric ? 'VOLUMETRIC' : 'ACTUAL'}], ` +
        `route=${route}`,
    );

    return {
      actualWeight,
      volumetricWeight: roundedVolumetric,
      chargeableWeight,
      volumetricDivisor: cbmFactor,
      route,
      isVolumetric,
    };
  }

  /**
   * Gets the CBM-to-kg factor for a given shipping route.
   */
  getDivisor(route: ShippingRoute): number {
    return this.CBM_FACTORS[route];
  }
}
