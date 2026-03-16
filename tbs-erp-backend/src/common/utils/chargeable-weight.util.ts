import { BadRequestException } from '@nestjs/common';
import { ShippingRoute } from '@prisma/client';

/**
 * CBM-to-kg conversion factors by shipping route.
 * Factor = how many kg per 1 cubic meter (CBM).
 *
 * Formula: volumetric (kg) = CBM × factor
 * where CBM = L(cm) × W(cm) × H(cm) / 1,000,000
 */
const CBM_FACTORS: Record<ShippingRoute, number> = {
  [ShippingRoute.SEA]: 1000,  // 1 CBM = 1000 kg (sea freight standard)
  [ShippingRoute.ROAD]: 333,  // 1 CBM = 333 kg (road freight standard)
  [ShippingRoute.AIR]: 167,   // 1 CBM = 167 kg (air freight standard)
};

export interface ChargeableWeightResult {
  /** Volumetric weight (kg) = CBM × cbmFactor */
  volumetricWeight: number;

  /** Chargeable weight (kg) = MAX(actualWeight, volumetricWeight) */
  chargeableWeight: number;

  /** The CBM-to-kg factor used for volumetric calculation */
  cbmFactor: number;

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
 * Volumetric weight formula: CBM × factor
 * where CBM = L(cm) × W(cm) × H(cm) / 1,000,000
 *
 * CBM factors:
 * - SEA (ocean freight): 1 CBM = 1000 kg
 * - ROAD (ground transport): 1 CBM = 333 kg
 * - AIR (air freight): 1 CBM = 167 kg
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
 * const result = calculateChargeableWeight(20, 100, 80, 60, ShippingRoute.SEA);
 * // CBM = 100*80*60 / 1,000,000 = 0.48
 * // result.volumetricWeight = 0.48 * 1000 = 480
 * // result.chargeableWeight = MAX(20, 480) = 480
 */
export function calculateChargeableWeight(
  actualWeight: number,
  length: number,
  width: number,
  height: number,
  route: ShippingRoute,
): ChargeableWeightResult {
  if (actualWeight < 0 || length < 0 || width < 0 || height < 0) {
    throw new BadRequestException('All weight and dimension values must be non-negative numbers.');
  }

  const cbmFactor = CBM_FACTORS[route];
  const cbm = (length * width * height) / 1_000_000;
  const volumetricWeight = cbm * cbmFactor;

  // Round to 2 decimal places
  const roundedVolumetric = Math.round(volumetricWeight * 100) / 100;
  const chargeableWeight = Math.max(actualWeight, roundedVolumetric);

  return {
    volumetricWeight: roundedVolumetric,
    chargeableWeight: Math.round(chargeableWeight * 100) / 100,
    cbmFactor,
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
    calculateChargeableWeight(pkg.actualWeight, pkg.length, pkg.width, pkg.height, route),
  );

  const totalActualWeight = packages.reduce((sum, pkg) => sum + pkg.actualWeight, 0);
  const totalVolumetricWeight = packageResults.reduce((sum, r) => sum + r.volumetricWeight, 0);
  const totalChargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);

  return {
    totalActualWeight: Math.round(totalActualWeight * 100) / 100,
    totalVolumetricWeight: Math.round(totalVolumetricWeight * 100) / 100,
    totalChargeableWeight: Math.round(totalChargeableWeight * 100) / 100,
    packageResults,
  };
}
