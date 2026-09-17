/**
 * Pilot XP & Career Progression Service
 * Handles seniority ranks, landing quality rating, flight experience calculation,
 * and contract payout seniority multipliers.
 */

export const PILOT_RANKS = [
  { level: 1, title: 'Junior Aviator', minXp: 0, maxXp: 9999, bonusPercent: 0 },
  { level: 2, title: 'Staff Aviator', minXp: 10000, maxXp: 24999, bonusPercent: 3 },
  { level: 3, title: 'Senior Aviator', minXp: 25000, maxXp: 49999, bonusPercent: 6 },
  { level: 4, title: 'Flight Officer', minXp: 50000, maxXp: 89999, bonusPercent: 10 },
  { level: 5, title: 'Staff Captain', minXp: 90000, maxXp: 149999, bonusPercent: 15 },
  { level: 6, title: 'Fleet Captain', minXp: 150000, maxXp: 249999, bonusPercent: 20 },
  { level: 7, title: 'Senior Captain', minXp: 250000, maxXp: 399999, bonusPercent: 26 },
  { level: 8, title: 'Command Captain', minXp: 400000, maxXp: 649999, bonusPercent: 32 },
  { level: 9, title: 'Chief Aviator', minXp: 650000, maxXp: 999999, bonusPercent: 38 },
  { level: 10, title: 'Master Aviator', minXp: 1000000, maxXp: Infinity, bonusPercent: 45 }
];

/**
 * Retrieves the pilot rank object, level, and progression details for a given XP amount.
 * @param {number} xp Total career experience points
 * @returns {object} Full rank metadata and progress percentages
 */
export function getPilotRank(xp = 0) {
  const currentXp = Math.max(0, Math.round(Number(xp) || 0));

  let rank = PILOT_RANKS[0];
  for (let i = PILOT_RANKS.length - 1; i >= 0; i--) {
    if (currentXp >= PILOT_RANKS[i].minXp) {
      rank = PILOT_RANKS[i];
      break;
    }
  }

  const nextRank = PILOT_RANKS.find((r) => r.level === rank.level + 1) || null;
  const prevLevelXp = rank.minXp;
  const nextLevelXp = nextRank ? nextRank.minXp : rank.minXp;

  let progressPercent = 100;
  let xpToNextLevel = 0;

  if (nextRank) {
    const range = nextLevelXp - prevLevelXp;
    const earnedInRange = currentXp - prevLevelXp;
    progressPercent = Math.min(100, Math.max(0, Math.round((earnedInRange / range) * 100)));
    xpToNextLevel = Math.max(0, nextLevelXp - currentXp);
  }

  const seniorityMultiplier = 1 + rank.bonusPercent / 100;

  return {
    level: rank.level,
    title: rank.title,
    currentXp,
    prevLevelXp,
    nextLevelXp: nextRank ? nextLevelXp : null,
    xpToNextLevel,
    progressPercent,
    bonusPercent: rank.bonusPercent,
    seniorityMultiplier,
    isMaxRank: !nextRank
  };
}

/**
 * Rates the landing touchdown vertical speed (FPM).
 * @param {number|null} touchdownFpm Touchdown vertical speed in feet per minute (usually negative)
 * @returns {object} { rating, label, xpBonus, color, absFpm }
 */
export function rateLandingTouchdown(touchdownFpm) {
  if (touchdownFpm == null || isNaN(touchdownFpm)) {
    return {
      rating: 'Good',
      label: 'Standard Landing',
      xpBonus: 0,
      color: 'cyan',
      absFpm: null
    };
  }

  const absFpm = Math.abs(Math.round(touchdownFpm));

  if (absFpm <= 160) {
    return {
      rating: 'Butter',
      label: 'Butter / Greaser',
      xpBonus: 0,
      color: 'emerald',
      absFpm
    };
  } else if (absFpm <= 320) {
    return {
      rating: 'Good',
      label: 'Clean Landing',
      xpBonus: 0,
      color: 'cyan',
      absFpm
    };
  } else if (absFpm <= 500) {
    return {
      rating: 'Firm',
      label: 'Firm Landing',
      xpBonus: 0,
      color: 'amber',
      absFpm
    };
  } else if (absFpm <= 750) {
    return {
      rating: 'Hard',
      label: 'Hard Landing',
      xpBonus: 0,
      color: 'orange',
      absFpm
    };
  } else {
    return {
      rating: 'Severe',
      label: 'Severe Hard Landing',
      xpBonus: 0,
      color: 'red',
      absFpm
    };
  }
}

/**
 * Calculates total experience points awarded for completing a flight contract.
 * @param {object} params
 * @param {number} params.distanceNm Flight distance in nautical miles
 * @param {boolean} [params.isUnvisited] Whether the destination was an unvisited airport
 * @param {number} [params.destRunwayFt] Destination runway length in feet
 * @param {number} [params.touchdownFpm] Touchdown vertical speed in feet per minute
 * @returns {object} Itemized XP breakdown
 */
export function calculateFlightXp(params = {}) {
  const {
    distanceNm = 0,
    isUnvisited = false,
    destRunwayFt = 5000,
    touchdownFpm = null
  } = params;

  const distanceXp = Math.max(1, Math.round(distanceNm));
  const landing = rateLandingTouchdown(touchdownFpm);
  const explorationXp = isUnvisited ? 100 : 0;
  const runwayChallengeXp = destRunwayFt < 4000 ? 75 : 0;
  const arrivalXp = 50; // Successful arrival and shutdown

  const totalXp = Math.max(
    10,
    distanceXp + explorationXp + runwayChallengeXp + arrivalXp
  );

  return {
    totalXp,
    distanceXp,
    landingRating: landing.rating,
    landingLabel: landing.label,
    landingXp: 0,
    explorationXp,
    runwayChallengeXp,
    arrivalXp
  };
}

/**
 * Retroactively calculates career XP for existing flight log entries.
 * @param {Array<object>} flightLog Array of historical flight entries
 * @returns {number} Total calculated career XP
 */
export function calculateRetroactiveXp(flightLog = []) {
  let totalXp = 0;
  const seenAirports = new Set();

  for (const entry of flightLog) {
    if (entry.xp_earned != null && !isNaN(entry.xp_earned) && entry.xp_earned > 0) {
      totalXp += entry.xp_earned;
      const dest = (entry.destination_icao || '').toUpperCase();
      if (dest) seenAirports.add(dest);
      continue;
    }

    const dist = Math.max(0, Math.round(entry.distance_nm || 0));
    const dest = (entry.destination_icao || '').toUpperCase();
    const isUnvisited = dest && !seenAirports.has(dest);
    if (dest) seenAirports.add(dest);

    const exploration = isUnvisited ? 100 : 0;
    const arrival = 50;

    totalXp += dist + exploration + arrival;
  }

  return Math.max(0, Math.round(totalXp));
}

export default {
  PILOT_RANKS,
  getPilotRank,
  rateLandingTouchdown,
  calculateFlightXp,
  calculateRetroactiveXp
};
