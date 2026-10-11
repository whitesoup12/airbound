import Airport from '../models/Airport.js';

/**
 * Normalizes an airport code to full standard 4-character ICAO format if a 3-character US alias was used.
 * (e.g. 'JLN' -> 'KJLN', 'LAX' -> 'KLAX', 'XNA' -> 'KXNA')
 */
export async function normalizeTo4CharIcao(code) {
  if (!code || typeof code !== 'string') return code;
  const upper = code.trim().toUpperCase();
  if (upper.length === 4) return upper;

  if (upper.length === 3) {
    const kCode = 'K' + upper;
    const exists = await Airport.findOne({ icao: kCode });
    if (exists) return kCode;
  }

  return upper;
}

/**
 * Synchronous best-effort guess for 3-character US airport codes
 */
export function guess4CharIcao(code) {
  if (!code || typeof code !== 'string') return code;
  const upper = code.trim().toUpperCase();
  if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) {
    return 'K' + upper;
  }
  return upper;
}

export default normalizeTo4CharIcao;

