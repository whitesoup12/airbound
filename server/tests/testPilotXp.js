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

// 2. Test Landing Touchdown Ratings & Adaptive Aircraft Sizing
console.log('2. Testing Landing Touchdown Ratings & Adaptive Aircraft Sizing...');

// 2a. Light GA (Cessna 172: ideal ≤ 90 FPM)
const c172Butter = rateLandingTouchdown(-85, { category: 'single_prop', aircraftName: 'Cessna 172 Skyhawk' });
if (c172Butter.rating !== 'Butter' || c172Butter.aircraftClass !== 'light') {
  throw new Error(`C172 Butter mismatch: ${JSON.stringify(c172Butter)}`);
}
const c172Clean = rateLandingTouchdown(-150, { category: 'single_prop', aircraftName: 'Cessna 172 Skyhawk' });
if (c172Clean.rating !== 'Good' || c172Clean.aircraftClass !== 'light') {
  throw new Error(`C172 Clean mismatch: ${JSON.stringify(c172Clean)}`);
}
console.log(`✓ Light GA (C172): -85 FPM is Butter (+100 XP), -150 FPM is Clean (+50 XP).`);

// 2b. Twin / Turboprop (Diamond DA62 & King Air: ideal ≤ 135 FPM)
const da62Butter = rateLandingTouchdown(-129, { category: 'twin_prop', aircraftName: 'Diamond DA62' });
if (da62Butter.rating !== 'Butter' || da62Butter.aircraftClass !== 'turboprop') {
  throw new Error(`DA62 Butter mismatch: ${JSON.stringify(da62Butter)}`);
}
console.log(`✓ Twin/Turboprop (DA62): -129 FPM correctly rated as Butter (+100 XP) [${da62Butter.aircraftClassLabel}].`);

// 2c. Airliner (Boeing 737 / Airbus A320: ideal ≤ 180 FPM)
const a320Butter = rateLandingTouchdown(-170, { category: 'airliner', aircraftName: 'Airbus A320neo' });
if (a320Butter.rating !== 'Butter' || a320Butter.aircraftClass !== 'airliner') {
  throw new Error(`A320 Butter mismatch: ${JSON.stringify(a320Butter)}`);
}
const a320Clean = rateLandingTouchdown(-250, { category: 'airliner', aircraftName: 'Airbus A320neo' });
if (a320Clean.rating !== 'Good' || a320Clean.aircraftClass !== 'airliner') {
  throw new Error(`A320 Clean mismatch: ${JSON.stringify(a320Clean)}`);
}
console.log(`✓ Airliner (A320): -170 FPM is Butter (+100 XP), -250 FPM is Clean (+50 XP).`);

// 2c-2. Personal / Business Jet (Cirrus Vision SF50: ideal ≤ 180 FPM)
const sf50Butter = rateLandingTouchdown(-130, { aircraftName: 'Cirrus Vision SF50', approachKts: 105 });
if (sf50Butter.rating !== 'Butter' || sf50Butter.aircraftClass !== 'airliner' || sf50Butter.aircraftClassLabel !== 'Airliner / Jet') {
  throw new Error(`SF50 Butter mismatch: ${JSON.stringify(sf50Butter)}`);
}
console.log(`✓ Jet (Cirrus Vision SF50): -130 FPM correctly rated as Butter (+100 XP) [${sf50Butter.aircraftClassLabel}].`);

// 2d. Heavy Widebody (Boeing 747-8: ideal ≤ 240 FPM)
const b747Butter = rateLandingTouchdown(-220, { category: 'airliner', aircraftName: 'Boeing 747-8 Intercontinental' });
if (b747Butter.rating !== 'Butter' || b747Butter.aircraftClass !== 'heavy') {
  throw new Error(`B747 Butter mismatch: ${JSON.stringify(b747Butter)}`);
}
console.log(`✓ Heavy Widebody (B747): -220 FPM correctly rated as Butter (+100 XP) [${b747Butter.aircraftClassLabel}].`);

// 2e. Approach Speed fallback (< 75 kts -> Light, 155+ kts -> Heavy)
const speedLight = rateLandingTouchdown(-80, { approachKts: 62 });
if (speedLight.aircraftClass !== 'light' || speedLight.rating !== 'Butter') {
  throw new Error(`Approach speed Light fallback mismatch: ${JSON.stringify(speedLight)}`);
}
const speedHeavy = rateLandingTouchdown(-230, { approachKts: 160 });
if (speedHeavy.aircraftClass !== 'heavy' || speedHeavy.rating !== 'Butter') {
  throw new Error(`Approach speed Heavy fallback mismatch: ${JSON.stringify(speedHeavy)}`);
}
console.log(`✓ Approach speed detection: 62 kts resolves to Light, 160 kts resolves to Heavy.`);

// 2f. Unrecorded & 0 FPM telemetry handling
const unrecorded = rateLandingTouchdown(null);
if (unrecorded.xpBonus !== 0) {
  throw new Error(`Unrecorded landing should award 0 XP: ${JSON.stringify(unrecorded)}`);
}
console.log(`✓ Unrecorded / null touchdown data correctly defaults to 0 XP.`);

const zeroFpm = rateLandingTouchdown(0);
if (zeroFpm.rating !== 'Unrecorded' || zeroFpm.xpBonus !== 0) {
  throw new Error(`0 FPM landing should be unrecorded with 0 XP: ${JSON.stringify(zeroFpm)}`);
}
console.log(`✓ 0 FPM uncaptured touchdown data correctly defaults to Unrecorded with 0 XP.`);

// 3. Test Flight XP Calculation
console.log('3. Testing Flight XP Calculation Breakdown...');
const flightXp = calculateFlightXp({
  distanceNm: 150,
  touchdownFpm: -130,
  isUnvisited: true,
  destRunwayFt: 3500
});

if (flightXp.totalXp !== 150 + 100 + 100 + 75 + 50) { // 475 XP (100 Butter landing XP)
  throw new Error(`Flight XP breakdown calculation mismatch: ${JSON.stringify(flightXp)}`);
}
if (flightXp.landingXp !== 100) {
  throw new Error(`Expected landingXp to be 100, got ${flightXp.landingXp}`);
}
console.log(`✓ 150 NM flight with Butter Landing (-130 FPM), Discovery, Short Runway & Arrival awarded ${flightXp.totalXp} XP.`);

// 4. Test Retroactive XP Calculation for User Career
console.log('4. Testing Retroactive XP Calculation...');
const mockFlightLog = [
  { distance_nm: 100, destination_icao: 'KSFO', is_external: false, xp_earned: null }, // unrecorded landing -> 0 XP
  { distance_nm: 250, destination_icao: 'KSFO', is_external: true, xp_earned: null },  // unrecorded landing -> 0 XP
  { distance_nm: 50, destination_icao: 'KLAX', is_external: false, xp_earned: 120 }
];
const retroXp = calculateRetroactiveXp(mockFlightLog);
// Flight 1: 100 dist + 0 (uncaptured landing) + 100 (unvisited KSFO) + 50 arrival = 250
// Flight 2: 250 dist + 0 (uncaptured landing) + 0 (already seen KSFO) + 50 arrival = 300
// Flight 3: recorded xp_earned = 120
// Expected total = 250 + 300 + 120 = 670
if (retroXp !== 670) {
  throw new Error(`Retroactive XP mismatch: expected 670, got ${retroXp}`);
}
console.log(`✓ Retroactive XP calculation accurately sums past career flights with 0 landing XP for uncaptured landings: ${retroXp} XP.`);

// Test retroactive with captured touchdown_fpm
const mockWithTouchdown = [
  { distance_nm: 100, destination_icao: 'KSFO', is_external: false, xp_earned: null, touchdown_fpm: -120 } // Butter -> +100
];
const retroWithTouchdown = calculateRetroactiveXp(mockWithTouchdown);
// 100 dist + 100 landing + 100 unvisited + 50 arrival = 350
if (retroWithTouchdown !== 350) {
  throw new Error(`Captured landing retroactive mismatch: expected 350, got ${retroWithTouchdown}`);
}
console.log(`✓ Retroactive calculation awards landing XP (+100) when touchdown telemetry is actually captured.`);

console.log('✅ ALL PILOT XP TESTS PASSED SUCCESSFULLY!');
