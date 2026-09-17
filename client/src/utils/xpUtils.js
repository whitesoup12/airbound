/**
 * Client-Side XP & Pilot Progression Utility
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

export function resolveAircraftClass(params = {}) {
  const { category = '', aircraftName = '', approachKts = null, landingClass = '' } = params;

  if (landingClass && LANDING_CLASS_CONFIGS[landingClass]) {
    return landingClass;
  }

  const name = (aircraftName || '').toLowerCase();
  const cat = (category || '').toLowerCase();

  // 1. Heavy widebody detection
  if (
    /747|777|787|a350|a380|a340|dc-?10|md-?11|an-?124|an-?225|c-5|c-17|galaxy|globemaster/i.test(name) ||
    (approachKts !== null && approachKts >= 155 && (cat === 'airliner' || cat === 'jet'))
  ) {
    return 'heavy';
  }

  // 2. Airliners & Mid-size Business Jets
  if (
    cat === 'airliner' ||
    cat === 'jet' ||
    /airbus|a319|a320|a321|boeing|737|727|717|crj|erj|embraer|citation|longitude|cj4|phenom|learjet|challenger|global/i.test(name)
  ) {
    return 'airliner';
  }

  // 3. Turboprops & Twin-Engine Props
  if (
    cat === 'turboprop' ||
    /da62|da42|twin|baron|seneca|seminole|king\s?air|tbm|caravan|pc-?12|atr|dash|dhc-?8|q400|beechcraft\s?99|c90/i.test(name)
  ) {
    return 'turboprop';
  }

  // 4. Approach Speed Threshold fallback
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

export function formatLandingRating(fpm, rating, options = {}) {
  let resolvedRating = rating;
  const opts = typeof options === 'string' ? { category: options } : (options || {});
  const resolvedClass = resolveAircraftClass(opts);
  const cfg = LANDING_CLASS_CONFIGS[resolvedClass] || LANDING_CLASS_CONFIGS.turboprop;

  if (!resolvedRating && fpm != null && !isNaN(fpm)) {
    const abs = Math.abs(Math.round(fpm));
    if (abs === 0) resolvedRating = 'Unrecorded';
    else if (abs <= cfg.butterMax) resolvedRating = 'Butter';
    else if (abs <= cfg.cleanMax) resolvedRating = 'Good';
    else if (abs <= cfg.firmMax) resolvedRating = 'Firm';
    else if (abs <= cfg.hardMax) resolvedRating = 'Hard';
    else resolvedRating = 'Severe';
  }

  if (resolvedRating === 'Unrecorded') {
    return {
      label: 'Unrecorded',
      fullLabel: 'Unrecorded Landing',
      color: 'text-slate-400',
      badgeColor: 'bg-slate-800/60 border-slate-700 text-slate-400',
      icon: '⚪',
      bonusXp: 0,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  }

  if (resolvedRating === 'Butter') {
    return {
      label: 'Butter',
      fullLabel: 'Butter / Greaser Landing',
      color: 'text-emerald-400',
      badgeColor: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
      icon: '🧈',
      bonusXp: 100,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else if (resolvedRating === 'Good') {
    return {
      label: 'Clean',
      fullLabel: 'Clean Landing',
      color: 'text-cyan-400',
      badgeColor: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
      icon: '✈️',
      bonusXp: 50,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else if (resolvedRating === 'Firm') {
    return {
      label: 'Firm',
      fullLabel: 'Firm Landing',
      color: 'text-amber-400',
      badgeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
      icon: '⚡',
      bonusXp: 0,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else if (resolvedRating === 'Hard') {
    return {
      label: 'Hard',
      fullLabel: 'Hard Landing',
      color: 'text-orange-400',
      badgeColor: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
      icon: '⚠️',
      bonusXp: -50,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  } else if (resolvedRating === 'Severe') {
    return {
      label: 'Severe',
      fullLabel: 'Severe Impact Landing',
      color: 'text-rose-400',
      badgeColor: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
      icon: '💥',
      bonusXp: -100,
      aircraftClass: cfg.id,
      aircraftClassLabel: cfg.label
    };
  }

  return {
    label: 'Normal',
    fullLabel: 'Normal Landing',
    color: 'text-slate-300',
    badgeColor: 'bg-slate-800 border-slate-700 text-slate-300',
    icon: '🛬',
    bonusXp: 0,
    aircraftClass: cfg.id,
    aircraftClassLabel: cfg.label
  };
}

export default {
  PILOT_RANKS,
  LANDING_CLASS_CONFIGS,
  resolveAircraftClass,
  getPilotRank,
  formatLandingRating
};
