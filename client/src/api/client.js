const API_BASE = '/api';

/**
 * Robust fetch wrapper that gracefully parses JSON and handles empty or non-JSON error bodies
 */
async function safeFetchJson(url, options = {}, defaultError = 'Request failed') {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Body is not valid JSON (e.g. empty or proxy error)
    }
  }

  if (!res.ok) {
    const errorMsg =
      data?.error ||
      (text && text.length < 250 && !text.includes('<!DOCTYPE') ? text : null) ||
      `${defaultError} (HTTP ${res.status})`;
    throw new Error(errorMsg);
  }

  return data ?? {};
}

export async function fetchPilot() {
  return safeFetchJson(`${API_BASE}/pilot`, {}, 'Failed to fetch pilot');
}

export async function resetPilot(data = {}) {
  return safeFetchJson(
    `${API_BASE}/pilot/reset`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    },
    'Failed to reset pilot'
  );
}

export async function importMsfsLogbookApi() {
  return safeFetchJson(
    `${API_BASE}/pilot/import-msfs`,
    { method: 'POST' },
    'Failed to import MSFS logbook'
  );
}

export async function fetchJobs(icao) {
  const url = icao ? `${API_BASE}/jobs?icao=${icao}` : `${API_BASE}/jobs`;
  return safeFetchJson(url, {}, 'Failed to fetch jobs');
}

export async function refreshJobs(icao, minRunwayFt = 3000) {
  return safeFetchJson(
    `${API_BASE}/jobs/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao, minRunwayFt })
    },
    'Failed to refresh jobs'
  );
}

export async function acceptJob(jobId) {
  return safeFetchJson(
    `${API_BASE}/jobs/${jobId}/accept`,
    { method: 'POST' },
    'Failed to accept job'
  );
}

export async function cancelJob(jobId) {
  return safeFetchJson(
    `${API_BASE}/jobs/${jobId}/cancel`,
    { method: 'POST' },
    'Failed to cancel job'
  );
}

export async function fetchAirports(query = '') {
  return safeFetchJson(
    `${API_BASE}/airports?q=${encodeURIComponent(query)}`,
    {},
    'Failed to fetch airports'
  );
}

// Simulator Control API
export async function stepFlightPhase(phase) {
  return safeFetchJson(
    `${API_BASE}/simulator/step-phase`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase })
    },
    'Failed to step flight phase'
  );
}

export async function startMockFlight(speedMultiplier = 1.0) {
  return safeFetchJson(
    `${API_BASE}/simulator/start-mock-flight`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speedMultiplier })
    },
    'Failed to start mock flight'
  );
}

export async function stopMockFlight() {
  return safeFetchJson(
    `${API_BASE}/simulator/stop-mock-flight`,
    { method: 'POST' },
    'Failed to stop mock flight'
  );
}

export async function teleportToAirport(icao) {
  return safeFetchJson(
    `${API_BASE}/simulator/teleport`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao })
    },
    'Failed to teleport to airport'
  );
}

export async function updateBaseAirport(icao) {
  return safeFetchJson(
    `${API_BASE}/pilot/base-airport`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao })
    },
    'Failed to update base airport'
  );
}

// Fleet & Dealership API
export async function fetchAircraftCatalog() {
  return safeFetchJson(`${API_BASE}/fleet/catalog`, {}, 'Failed to fetch aircraft catalog');
}

export async function fetchHangar() {
  return safeFetchJson(`${API_BASE}/fleet/hangar`, {}, 'Failed to fetch hangar fleet');
}

export async function buyAircraft(modelId, tailNumber = '') {
  return safeFetchJson(
    `${API_BASE}/fleet/buy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, tailNumber })
    },
    'Failed to purchase aircraft'
  );
}

export async function rentAircraft(modelId) {
  return safeFetchJson(
    `${API_BASE}/fleet/rent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId })
    },
    'Failed to rent aircraft'
  );
}

export async function selectActiveAircraft(modelId, tailNumber = '') {
  return safeFetchJson(
    `${API_BASE}/fleet/select`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, tailNumber })
    },
    'Failed to select active aircraft'
  );
}

export async function sellAircraft(tailNumber) {
  return safeFetchJson(
    `${API_BASE}/fleet/sell`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tailNumber })
    },
    'Failed to sell aircraft'
  );
}

export async function returnAircraft(tailNumber) {
  return safeFetchJson(
    `${API_BASE}/fleet/return`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tailNumber })
    },
    'Failed to return leased aircraft'
  );
}

export async function startFreeFlight({ destination_icao = null, deduct_fees = false } = {}) {
  return safeFetchJson(
    `${API_BASE}/free-flight/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination_icao, deduct_fees })
    },
    'Failed to commence Free Flight'
  );
}

export async function cancelFreeFlight() {
  return safeFetchJson(
    `${API_BASE}/free-flight/cancel`,
    { method: 'POST' },
    'Failed to cancel Free Flight'
  );
}






