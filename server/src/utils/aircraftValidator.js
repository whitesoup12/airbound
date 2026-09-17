/**
 * Aircraft Airframe Matching & Validation Engine
 * Validates whether the aircraft loaded in MSFS 2024 (via SimConnect TITLE and ATC MODEL SimVars)
 * matches the active aircraft designated for the accepted Airbound contract.
 */

export const AIRCRAFT_MATCH_RULES = {
  c172: {
    name: 'Cessna 172 Skyhawk',
    patterns: [/172/i, /skyhawk/i, /c172/i],
    models: [/c172/i]
  },
  xcub: {
    name: 'CubCrafters XCub',
    patterns: [/xcub/i, /cubcrafters/i, /cc19/i],
    models: [/xcub/i, /cc19/i]
  },
  da40ng: {
    name: 'Diamond DA40 NG',
    patterns: [/da[-_ ]?40/i, /diamond.*40/i, /da40ng/i],
    models: [/da40/i]
  },
  bonanza_g36: {
    name: 'Beechcraft Bonanza G36',
    patterns: [/bonanza/i, /g36/i, /be36/i],
    models: [/g36/i, /be36/i]
  },
  da62: {
    name: 'Diamond DA62',
    patterns: [/da[-_ ]?62/i, /diamond.*62/i, /da62/i],
    models: [/da62/i, /asobo-aircraft-da62/i]
  },
  c208b: {
    name: 'Cessna 208B Grand Caravan',
    patterns: [/208/i, /caravan/i, /c208/i],
    models: [/c208/i]
  },
  vision_sf50: {
    name: 'Cirrus Vision SF50',
    patterns: [/sf50/i, /vision.*jet/i, /cirrus.*vision/i],
    models: [/sf50/i]
  },
  dhc6: {
    name: 'De Havilland DHC-6 Twin Otter',
    patterns: [/dhc[-_ ]?6/i, /twin.*otter/i, /dhc6/i],
    models: [/dhc6/i]
  },
  tbm930: {
    name: 'Daher TBM 930',
    patterns: [/tbm[-_ ]?930/i, /tbm9/i, /daher.*tbm/i, /tbm/i],
    models: [/tbm9/i, /tbm/i]
  },
  pc12ngx: {
    name: 'Pilatus PC-12 NGX',
    patterns: [/pc[-_ ]?12/i, /pilatus/i],
    models: [/pc12/i]
  },
  kingair350: {
    name: 'Beechcraft King Air 350i',
    patterns: [/king[-_ ]?air/i, /b350/i, /350i/i],
    models: [/b350/i]
  },
  citation_cj4: {
    name: 'Cessna Citation CJ4',
    patterns: [/citation.*cj4/i, /cj4/i, /c25c/i],
    models: [/c25c/i, /cj4/i]
  },
  citation_long: {
    name: 'Cessna Citation Longitude',
    patterns: [/longitude/i, /c700/i, /citation.*long/i],
    models: [/c700/i]
  },
  a320: {
    name: 'Airbus A320neo',
    patterns: [/a320/i, /a20n/i, /airbus.*320/i],
    models: [/a320/i, /a20n/i]
  },
  b737_max8: {
    name: 'Boeing 737 MAX 8',
    patterns: [/737/i, /b737/i, /b38m/i, /max[-_ ]?8/i, /boeing.*737/i],
    models: [/b737/i, /b38m/i, /b738/i]
  }
};

/**
 * Validates if the sim aircraft matches the active aircraft
 * @param {object} activeAircraft Airbound active aircraft object
 * @param {object} telemetry Current telemetry object
 * @param {boolean} isMockMode True if running in simulated mode
 * @returns {object} { matches: boolean, simAircraftTitle: string, simAircraftModel: string, expectedAircraft: string, reason?: string }
 */
export function validateAircraftMatch(activeAircraft, telemetry = {}, isMockMode = false) {
  const expectedName = activeAircraft?.name || 'Cessna 172 Skyhawk';
  const expectedModelId = (activeAircraft?.model_id || 'c172').toLowerCase();

  // If in Mock Mode, automatically simulate a verified match
  if (isMockMode) {
    return {
      matches: true,
      simAircraftTitle: telemetry?.simAircraftTitle || expectedName,
      simAircraftModel: telemetry?.simAircraftModel || expectedModelId,
      expectedAircraft: expectedName,
      isMock: true
    };
  }

  const simTitle = (telemetry?.simAircraftTitle || '').trim();
  const simModel = (telemetry?.simAircraftModel || '').trim();

  // If MSFS hasn't sent title yet (e.g. connecting or on menu)
  if (!simTitle && !simModel) {
    return {
      matches: true,
      pending: true,
      simAircraftTitle: 'Detecting in MSFS...',
      simAircraftModel: '',
      expectedAircraft: expectedName
    };
  }

  // 1. Look up rule for expected model_id
  const rule = AIRCRAFT_MATCH_RULES[expectedModelId];

  if (rule) {
    // Check TITLE regexes
    const titleMatches = rule.patterns.some((pattern) => pattern.test(simTitle));
    if (titleMatches) {
      return {
        matches: true,
        simAircraftTitle: simTitle,
        simAircraftModel: simModel,
        expectedAircraft: expectedName
      };
    }

    // Check ATC MODEL regexes
    if (simModel && rule.models) {
      const modelMatches = rule.models.some((pattern) => pattern.test(simModel));
      if (modelMatches) {
        return {
          matches: true,
          simAircraftTitle: simTitle,
          simAircraftModel: simModel,
          expectedAircraft: expectedName
        };
      }
    }
  }

  // 2. Fallback fuzzy token matching: check if distinct keywords in the aircraft name appear in simTitle
  const cleanTokens = expectedName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !['textron', 'aviation', 'aircraft', 'de', 'havilland', 'daher', 'the', 'super'].includes(t));

  const simTitleLower = simTitle.toLowerCase();
  const tokenMatch = cleanTokens.some((token) => simTitleLower.includes(token));

  if (tokenMatch) {
    return {
      matches: true,
      simAircraftTitle: simTitle,
      simAircraftModel: simModel,
      expectedAircraft: expectedName
    };
  }

  // Mismatch detected
  return {
    matches: false,
    simAircraftTitle: simTitle || 'Unknown Airframe',
    simAircraftModel: simModel,
    expectedAircraft: expectedName,
    reason: `Simulated airframe "${simTitle || simModel}" does not match contract requirement "${expectedName}".`
  };
}

export default validateAircraftMatch;

