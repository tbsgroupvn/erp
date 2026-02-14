import { BadRequestException } from '@nestjs/common';
import { ShippingRoute } from '@prisma/client';

/**
 * Volumetric weight divisors by shipping route.
 * These divisors convert dimensional measurements (cm) to a weight equivalent (kg).
 */
const VOLUMETRIC_DIVISORS: Record<ShippingRoute, number> = {
  [ShippingRoute.SEA]: 6000,
  [ShippingRoute.ROAD]: 5000,
  [ShippingRoute.AIR]: 5000,
};

export interface ChargeableWeightResult {
  /** Volumetric weight (kg) = (L * W * H) / divisor */
  volumetricWeight: number;

  /** Chargeable weight (kg) = MAX(actualWeight, volumetricWeight) */
  chargeableWeight: number;

  /** The divisor used for volumetric calculation */
  divisor: number;

  /** The shipping route used */
  route: ShippingRoute;
}

/**
 * Calculates the chargeable weight for a shipment.
 *
 * The chargeable weight is the greater of:
 * - The actual (gross) weight of the goods
 * - The volumetric weight calculated from the package dimensions
 *
 * Volumetric weight formula: (Length x Width x Height) / Divisor
 * Divisors:
 * - SEA (ocean freight): 6000
 * - ROAD (ground transport): 5000
 * - AIR (air freight): 5000
 *
 * All dimensions should be in centimeters (cm).
 * All weights are in kilograms (kg).
 *
 * @param actualWeight - Actual weight in kg
 * @param length - Length in cm
 * @param width - Width in cm
 * @param height - Height in cm
 * @param route - Shipping route (SEA, ROAD, AIR)
 * @returns ChargeableWeightResult with volumetric and chargeable weights
 *
 * @example
 * const result = calculateChargeableWeight(15, 60, 40, 50, ShippingRoute.SEA);
 * // result.volumetricWeight = (60 * 40 * 50) / 6000 = 20
 * // result.chargeableWeight = MAX(15, 20) = 20
 */
export function calculateChargeableWeight(
  actualWeight: number,
  length: number,
  width: number,
  height: number,
  route: ShippingRoute,
): ChargeableWeightResult {
  if (actualWeight < 0 || length < 0 || width < 0 || height < 0) {
    throw new BadRequestException(
      'All weight and dimension values must be non-negative numbers.',
    );
  }

  const divisor = VOLUMETRIC_DIVISORS[route];
  const volumetricWeight = (length * width * height) / divisor;

  // Round to 2 decimal places
  const roundedVolumetric = Math.round(volumetricWeight * 100) / 100;
  const chargeableWeight = Math.max(actualWeight, roundedVolumetric);

  return {
    volumetricWeight: roundedVolumetric,
    chargeableWeight: Math.round(chargeableWeight * 100) / 100,
    divisor,
    route,
  };
}

/**
 * Calculates the total chargeable weight for multiple packages.
 *
 * @param packages - Array of packages with weight and dimensions
 * @param route - Shipping route
 * @returns Total chargeable weight result with aggregated values
 */
export function calculateTotalChargeableWeight(
  packages: Array<{
    actualWeight: number;
    length: number;
    width: number;
    height: number;
  }>,
  route: ShippingRoute,
): {
  totalActualWeight: number;
  totalVolumetricWeight: number;
  totalChargeableWeight: number;
  packageResults: ChargeableWeightResult[];
} {
  const packageResults = packages.map((pkg) =>
    calculateChargeableWeight(
      pkg.actualWeight,
      pkg.length,
      pkg.width,
      pkg.height,
      route,
    ),
  );

  const totalActualWeight = packages.reduce(
    (sum, pkg) => sum + pkg.actualWeight,
    0,
  );
  const totalVolumetricWeight = packageResults.reduce(
    (sum, r) => sum + r.volumetricWeight,
    0,
  );
  const totalChargeableWeight = Math.max(
    totalActualWeight,
    totalVolumetricWeight,
  );

  return {
    totalActualWeight: Math.round(totalActualWeight * 100) / 100,
    totalVolumetricWeight: Math.round(totalVolumetricWeight * 100) / 100,
    totalChargeableWeight: Math.round(totalChargeableWeight * 100) / 100,
    packageResults,
  };
}
