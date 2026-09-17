import {
  PILOT_RANKS,
  getPilotRank,
  rateLandingTouchdown,
  calculateFlightXp,
  calculateRetroactiveXp
} from '../src/services/xpService.js';

console.log('--- TESTING PILOT XP & CAREER PROGRESSION SYSTEM ---');

// 1. Test Rank Ladder
console.log('1. Testing Rank Ladder thresholds and seniority bonuses...');
const l1 = getPilotRank(0);
if (l1.level !== 1 || l1.title !== 'Junior Aviator' || l1.bonusPercent !== 0 || l1.seniorityMultiplier !== 1.0) {
  throw new Error(`Level 1 mismatch: ${JSON.stringify(l1)}`);
}

const l3 = getPilotRank(35000);
if (l3.level !== 3 || l3.title !== 'Senior Aviator' || l3.bonusPercent !== 6 || l3.seniorityMultiplier !== 1.06) {
  throw new Error(`Level 3 mismatch: ${JSON.stringify(l3)}`);
}
console.log(`✓ 35,000 XP correctly resolves to Level ${l3.level}: ${l3.title} (+${l3.bonusPercent}% seniority bonus, ${l3.progressPercent}% to L4)`);

const l10 = getPilotRank(1500000);
if (l10.level !== 10 || l10.title !== 'Master Aviator' || l10.bonusPercent !== 45 || !l10.isMaxRank) {
  throw new Error(`Level 10 mismatch: ${JSON.stringify(l10)}`);
}
console.log(`✓ 1,500,000 XP correctly resolves to Level ${l10.level}: ${l10.title} (+${l10.bonusPercent}% bonus, Max Rank)`);

// 2. Test Landing Touchdown Ratings
console.log('2. Testing Landing Touchdown Ratings...');
const butter = rateLandingTouchdown(-120);
if (butter.rating !== 'Butter' || butter.xpBonus !== 100) {
  throw new Error(`Butter landing mismatch: ${JSON.stringify(butter)}`);
}
console.log(`✓ -120 FPM rated as ${butter.label} (+${butter.xpBonus} XP)`);

const clean = rateLandingTouchdown(-240);
if (clean.rating !== 'Good' || clean.xpBonus !== 50) {
  throw new Error(`Clean landing mismatch: ${JSON.stringify(clean)}`);
}
console.log(`✓ -240 FPM rated as ${clean.label} (+${clean.xpBonus} XP)`);

const firm = rateLandingTouchdown(-450);
if (firm.rating !== 'Firm' || firm.xpBonus !== 25) {
  throw new Error(`Firm landing mismatch: ${JSON.stringify(firm)}`);
}
console.log(`✓ -450 FPM rated as ${firm.label} (+${firm.xpBonus} XP)`);

const hard = rateLandingTouchdown(-650);
if (hard.rating !== 'Hard' || hard.xpBonus !== 0) {
  throw new Error(`Hard landing mismatch: ${JSON.stringify(hard)}`);
}
console.log(`✓ -650 FPM rated as ${hard.label} (+${hard.xpBonus} XP)`);

const severe = rateLandingTouchdown(-900);
if (severe.rating !== 'Severe' || severe.xpBonus !== -25) {
  throw new Error(`Severe landing mismatch: ${JSON.stringify(severe)}`);
}
console.log(`✓ -900 FPM rated as ${severe.label} (${severe.xpBonus} XP)`);

// 3. Test Flight XP Calculation
console.log('3. Testing Flight XP Calculation Breakdown...');
const flightXp = calculateFlightXp({
  distanceNm: 150,
  touchdownFpm: -130,
  isUnvisited: true,
  destRunwayFt: 3500
});

if (flightXp.totalXp !== 150 + 100 + 100 + 75 + 50) { // 475 XP
  throw new Error(`Flight XP breakdown calculation mismatch: ${JSON.stringify(flightXp)}`);
}
console.log(`✓ 150 NM flight with Butter Landing (-130 FPM), Discovery, Short Runway & Arrival awarded ${flightXp.totalXp} XP.`);

// 4. Test Retroactive XP Calculation for User Career
console.log('4. Testing Retroactive XP Calculation...');
const mockFlightLog = [
  { distance_nm: 100, destination_icao: 'KSFO', is_external: false, xp_earned: null },
  { distance_nm: 250, destination_icao: 'KSFO', is_external: true, xp_earned: null },
  { distance_nm: 50, destination_icao: 'KLAX', is_external: false, xp_earned: 120 }
];
const retroXp = calculateRetroactiveXp(mockFlightLog);
// Flight 1: 100 dist + 50 (clean landing) + 100 (unvisited KSFO) + 50 arrival = 300
// Flight 2: 250 dist + 50 (clean landing) + 0 (already seen KSFO) + 50 arrival = 350
// Flight 3: recorded xp_earned = 120
// Expected total = 300 + 350 + 120 = 770
if (retroXp !== 770) {
  throw new Error(`Retroactive XP mismatch: expected 770, got ${retroXp}`);
}
console.log(`✓ Retroactive XP calculation accurately summed past career flights: ${retroXp} XP.`);

console.log('✅ ALL PILOT XP TESTS PASSED SUCCESSFULLY!');
