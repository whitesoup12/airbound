export const FUEL_PRICES = {
  '100LL': 6.40, // $6.40 per gallon for AvGas 100LL
  'Jet-A': 5.60  // $5.60 per gallon for Jet-A
};

/**
 * Calculates landing and ramp handling fee based on destination runway length
 * @param {number} runwayFt Longest runway length in feet
 * @returns {number} Landing fee in USD
 */
export function calculateLandingFee(runwayFt = 5000) {
  if (runwayFt >= 9500) {
    return 350; // Major commercial hub (e.g. KLAX, KJFK, EGLL)
  } else if (runwayFt >= 5000) {
    return 120; // Regional / medium commercial airfield (e.g. KXNA, KCRQ)
  } else {
    return 35; // Small untowered / general aviation strip
  }
}

/**
 * Calculates fuel burned and fuel expense for a flight
 * @param {number} durationSeconds Total flight duration in seconds
 * @param {number} fuelBurnGph Fuel burn rate in gallons per hour
 * @param {string} fuelType '100LL' or 'Jet-A'
 * @returns {{ gallons: number, cost: number, pricePerGal: number }}
 */
export function calculateFuelExpense(durationSeconds, fuelBurnGph = 9.0, fuelType = '100LL') {
  // Minimum 5 minutes (300 sec) burn to account for taxi, runup, and climb
  const durationHours = Math.max(0.08, durationSeconds / 3600);
  const gallons = Math.round(durationHours * fuelBurnGph * 10) / 10;
  const pricePerGal = FUEL_PRICES[fuelType] || 6.40;
  const cost = Math.round(gallons * pricePerGal * 100) / 100;

  return {
    gallons,
    cost,
    pricePerGal
  };
}

/**
 * Computes full flight financial settlement
 * @param {object} params
 * @param {number} params.grossPayout Payout agreed in contract
 * @param {number} params.durationSeconds Total flight duration
 * @param {number} params.fuelBurnGph Aircraft fuel burn rate
 * @param {string} params.fuelType Aircraft fuel type ('100LL' | 'Jet-A')
 * @param {number} params.destRunwayFt Destination runway length
 * @param {string} params.aircraftName Aircraft model name
 */
export function computeFlightSettlement(params) {
  const {
    grossPayout,
    durationSeconds,
    fuelBurnGph = 9.0,
    fuelType = '100LL',
    destRunwayFt = 5000,
    aircraftName = 'Cessna 172 Skyhawk'
  } = params;

  const fuel = calculateFuelExpense(durationSeconds, fuelBurnGph, fuelType);
  const landingFee = calculateLandingFee(destRunwayFt);
  const totalExpenses = Math.round((fuel.cost + landingFee) * 100) / 100;
  const netPayout = Math.max(0, Math.round(grossPayout - totalExpenses));

  return {
    aircraftName,
    grossPayout,
    fuelGallons: fuel.gallons,
    fuelCost: fuel.cost,
    fuelType,
    pricePerGal: fuel.pricePerGal,
    landingFee,
    totalExpenses,
    netPayout
  };
}

/**
 * Calculates aircraft resale value considering initial dealer margin and flight hours depreciation
 * @param {number} purchasePrice Original purchase price in USD
 * @param {number} flightHours Total flight hours logged on this aircraft
 * @returns {{
 *   purchasePrice: number,
 *   resaleValue: number,
 *   totalDepreciation: number,
 *   totalDepreciationPercent: number,
 *   baseDepreciationPercent: number,
 *   hourlyDepreciationPercent: number,
 *   salvageFloorReached: boolean
 * }}
 */
export function calculateAircraftResaleValue(purchasePrice, flightHours = 0) {
  const BASE_DEPRECIATION_PERCENT = 15; // 15% dealer margin / initial depreciation
  const HOURLY_DEPRECIATION_RATE = 0.5; // 0.5% per flight hour logged
  const MIN_SALVAGE_PERCENT = 20; // 20% minimum salvage/scrap residual value floor

  const hourlyDepreciationPercent = Math.round(Math.max(0, flightHours) * HOURLY_DEPRECIATION_RATE * 10) / 10;
  let totalDepreciationPercent = Math.round((BASE_DEPRECIATION_PERCENT + hourlyDepreciationPercent) * 10) / 10;

  const maxDepreciationPercent = 100 - MIN_SALVAGE_PERCENT; // 80% maximum depreciation
  const salvageFloorReached = totalDepreciationPercent >= maxDepreciationPercent;

  if (salvageFloorReached) {
    totalDepreciationPercent = maxDepreciationPercent;
  }

  const resalePercent = 100 - totalDepreciationPercent;
  const resaleValue = Math.round(purchasePrice * (resalePercent / 100));
  const totalDepreciation = purchasePrice - resaleValue;

  return {
    purchasePrice,
    resaleValue,
    totalDepreciation,
    totalDepreciationPercent,
    baseDepreciationPercent: BASE_DEPRECIATION_PERCENT,
    hourlyDepreciationPercent,
    salvageFloorReached
  };
}


