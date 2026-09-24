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

export const LANDING_CLASS_CONFIGS = {
  light: {
    id: 'light',
    label: 'Light GA',
    butterMax: 90,
    cleanMax: 200,
    firmMax: 350,
    hardMax: 500
  },
  turboprop: {
    id: 'turboprop',
    label: 'Twin / Turboprop',
    butterMax: 135,
    cleanMax: 250,
    firmMax: 400,
    hardMax: 550
  },
  airliner: {
    id: 'airliner',
    label: 'Airliner / Jet',
    butterMax: 180,
    cleanMax: 300,
    firmMax: 450,
    hardMax: 600
  },
  heavy: {
    id: 'heavy',
    label: 'Heavy Widebody',
    butterMax: 240,
    cleanMax: 360,
    firmMax: 500,
    hardMax: 650
  }
};

/**
 * Resolves aircraft landing evaluation class from category, model name, and/or approach airspeed.
 * @param {object} params
 * @param {string} [params.category] 'single_prop' | 'turboprop' | 'jet' | 'airliner'
 * @param {string} [params.aircraftName] Aircraft name or title (e.g. 'Diamond DA62', 'Boeing 747-8')
 * @param {number} [params.approachKts] Measured approach airspeed (knots)
 * @param {string} [params.landingClass] Explicit class override
 * @returns {string} 'light' | 'turboprop' | 'airliner' | 'heavy'
 */
export function resolveAircraftClass(params = {}) {
  const { category = '', aircraftName = '', approachKts = null, landingClass = '' } = params;

  if (landingClass) {
    const norm = (landingClass + '').toLowerCase().trim();
    for (const [key, cfg] of Object.entries(LANDING_CLASS_CONFIGS)) {
      if (key.toLowerCase() === norm || cfg.id.toLowerCase() === norm || cfg.label.toLowerCase() === norm) {
        return key;
      }
    }
  }

  const name = (aircraftName || '').toLowerCase();
  const cat = (category || '').toLowerCase();

  // 1. Heavy widebody detection (B747, B777, B787, A350, A380, An-124, DC-10, MD-11, etc.)
  if (
    /747|777|787|a350|a380|a340|dc-?10|md-?11|an-?124|an-?225|c-5|c-17|galaxy|globemaster/i.test(name) ||
    (approachKts !== null && approachKts >= 155 && (cat === 'airliner' || cat === 'jet'))
  ) {
    return 'heavy';
  }

  // 2. Airliners & Business / Personal Jets (Cirrus Vision SF50, Citation, Phenom, HondaJet, A320, B737, etc.)
  if (
    cat === 'airliner' ||
    cat === 'jet' ||
    /airbus|a319|a320|a321|boeing|737|727|717|crj|erj|embraer|citation|longitude|cj4|phenom|learjet|challenger|global|vision|sf50|cirrus.*jet|hondajet|hawker|falcon|gulfstream|premier|mustang|eclipse|\bjet\b/i.test(name)
  ) {
    return 'airliner';
  }

  // 3. Turboprops & Twin-Engine Props (DA62, DA42, King Air, TBM, Caravan, PC-12, Baron, Seneca)
  if (
    cat === 'turboprop' ||
    cat === 'twin_prop' ||
    /da62|da42|twin|baron|seneca|seminole|king\s?air|tbm|caravan|pc-?12|atr|dash|dhc-?8|q400|beechcraft\s?99|c90/i.test(name)
  ) {
    return 'turboprop';
  }

  // 4. Approach Speed Threshold fallback if available
  if (approachKts != null && !isNaN(approachKts) && approachKts > 0) {
    if (approachKts < 75) return 'light';
    if (approachKts <= 115) return 'turboprop';
    if (approachKts <= 155) return 'airliner';
    return 'heavy';
  }

  // 5. Default single-engine pistons to Light GA
  if (cat === 'single_prop') {
    return 'light';
  }

  return 'turboprop';
}

/**
 * Rates the landing touchdown vertical speed (FPM) adaptively based on aircraft size/speed.
 * @param {number|null} touchdownFpm Touchdown vertical speed in feet per minute (usually negative)
 * @param {object|string} [options] Aircraft category, name, or { category, aircraftName, approachKts, landingClass }
 * @returns {object} { rating, label, xpBonus, color, absFpm, aircraftClass, aircraftClassLabel }
 */
export function rateLandingTouchdown(touchdownFpm, options = {}) {
  if (touchdownFpm == null || isNaN(touchdownFpm)) {
    return {
      rating: 'Unrecorded',
      label: 'Unrecorded Landing',
      xpBonus: 0,
      color: 'slate',
      absFpm: null,
      aircraftClass: 'turboprop',
      aircraftClassLabel: 'Standard'
    };
  }

  const absFpm = Math.abs(Math.round(touchdownFpm));

  if (absFpm === 0) {
    return {
      rating: 'Unrecorded',
      label: 'Unrecorded Landing',
      xpBonus: 0,
      color: 'slate',
      absFpm: null,
      aircraftClass: 'turboprop',
      aircraftClassLabel: 'Standard'
    };
  }

  // Support passing category string directly or options object
  const resolvedOpts = typeof options === 'string'
    ? { category: options }
    : (options || {});

  const resolvedClass = resolveAircraftClass(resolvedOpts);
  const cfg = LANDING_CLASS_CONFIGS[resolvedClass] || LANDING_CLASS_CONFIGS.turboprop;

  if (absFpm <= cfg.butterMax) {
    return {
      rating: 'Butter',
      label: 'Butter / Greaser',
      xpBonus: 100,
      color: 'emerald',
      absFpm,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else if (absFpm <= cfg.cleanMax) {
    return {
      rating: 'Good',
      label: 'Clean Landing',
      xpBonus: 50,
      color: 'cyan',
      absFpm,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else if (absFpm <= cfg.firmMax) {
    return {
      rating: 'Firm',
      label: 'Firm Landing',
      xpBonus: 0,
      color: 'amber',
      absFpm,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else if (absFpm <= cfg.hardMax) {
    return {
      rating: 'Hard',
      label: 'Hard Landing',
      xpBonus: -50,
      color: 'orange',
      absFpm,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else {
    return {
      rating: 'Severe',
      label: 'Severe Hard Landing',
      xpBonus: -100,
      color: 'red',
      absFpm,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
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
    touchdownFpm = null,
    category = '',
    aircraftName = '',
    approachKts = null,
    landingClass = ''
  } = params;

  const distanceXp = Math.max(1, Math.round(distanceNm));
  const landing = rateLandingTouchdown(touchdownFpm, {
    category,
    aircraftName,
    approachKts,
    landingClass
  });
  const explorationXp = isUnvisited ? 100 : 0;
  const runwayChallengeXp = destRunwayFt < 4000 ? 75 : 0;
  const arrivalXp = 50; // Successful arrival and shutdown

  const totalXp = Math.max(
    10,
    distanceXp + landing.xpBonus + explorationXp + runwayChallengeXp + arrivalXp
  );

  return {
    totalXp,
    distanceXp,
    landingRating: landing.rating,
    landingLabel: landing.label,
    landingXp: landing.xpBonus,
    aircraftClass: landing.aircraftClass,
    aircraftClassLabel: landing.aircraftClassLabel,
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

    // Only award landing XP if touchdown data was actually captured; otherwise 0 XP
    let landingXp = 0;
    if (entry.touchdown_fpm != null && !isNaN(entry.touchdown_fpm)) {
      const landing = rateLandingTouchdown(entry.touchdown_fpm, {
        category: entry.category,
        aircraftName: entry.aircraft_name,
        approachKts: entry.approach_speed_kts,
        landingClass: entry.landing_class
      });
      landingXp = landing.xpBonus;
    }

    const exploration = isUnvisited ? 100 : 0;
    const arrival = 50;

    totalXp += dist + landingXp + exploration + arrival;
  }

  return Math.max(0, Math.round(totalXp));
}

export default {
  PILOT_RANKS,
  LANDING_CLASS_CONFIGS,
  resolveAircraftClass,
  getPilotRank,
  rateLandingTouchdown,
  calculateFlightXp,
  calculateRetroactiveXp
};
