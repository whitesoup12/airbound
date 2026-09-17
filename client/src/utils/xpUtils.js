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

export function formatLandingRating(fpm, rating) {
  let resolvedRating = rating;
  if (!resolvedRating && fpm != null && !isNaN(fpm)) {
    const abs = Math.abs(Math.round(fpm));
    if (abs === 0) resolvedRating = 'Unrecorded';
    else if (abs <= 160) resolvedRating = 'Butter';
    else if (abs <= 320) resolvedRating = 'Good';
    else if (abs <= 500) resolvedRating = 'Firm';
    else if (abs <= 750) resolvedRating = 'Hard';
    else resolvedRating = 'Severe';
  }

  if (resolvedRating === 'Unrecorded') {
    return {
      label: 'Unrecorded',
      fullLabel: 'Unrecorded Landing',
      color: 'text-slate-400',
      badgeColor: 'bg-slate-800/60 border-slate-700 text-slate-400',
      icon: '⚪',
      bonusXp: 0
    };
  }

  if (resolvedRating === 'Butter') {
    return {
      label: 'Butter',
      fullLabel: 'Butter / Greaser Landing',
      color: 'text-emerald-400',
      badgeColor: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
      icon: '🧈',
      bonusXp: 100
    };
  } else if (resolvedRating === 'Good') {
    return {
      label: 'Clean',
      fullLabel: 'Clean Landing',
      color: 'text-cyan-400',
      badgeColor: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
      icon: '✈️',
      bonusXp: 50
    };
  } else if (resolvedRating === 'Firm') {
    return {
      label: 'Firm',
      fullLabel: 'Firm Landing',
      color: 'text-amber-400',
      badgeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
      icon: '⚡',
      bonusXp: 0
    };
  } else if (resolvedRating === 'Hard') {
    return {
      label: 'Hard',
      fullLabel: 'Hard Landing',
      color: 'text-orange-400',
      badgeColor: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
      icon: '⚠️',
      bonusXp: -50
    };
  } else if (resolvedRating === 'Severe') {
    return {
      label: 'Severe',
      fullLabel: 'Severe Impact Landing',
      color: 'text-rose-400',
      badgeColor: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
      icon: '💥',
      bonusXp: -100
    };
  }

  return {
    label: 'Normal',
    fullLabel: 'Normal Landing',
    color: 'text-slate-300',
    badgeColor: 'bg-slate-800 border-slate-700 text-slate-300',
    icon: '🛬',
    bonusXp: 0
  };
}

export default {
  PILOT_RANKS,
  getPilotRank,
  formatLandingRating
};
