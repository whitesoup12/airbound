const API_BASE = '/api';

export async function fetchPilot() {
  const res = await fetch(`${API_BASE}/pilot`);
  if (!res.ok) throw new Error('Failed to fetch pilot');
  return res.json();
}

export async function resetPilot(data = {}) {
  const res = await fetch(`${API_BASE}/pilot/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset pilot');
  }
  return res.json();
}

export async function importMsfsLogbookApi() {
  const res = await fetch(`${API_BASE}/pilot/import-msfs`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to import MSFS logbook');
  }
  return res.json();
}

export async function fetchJobs(icao) {
  const url = icao ? `${API_BASE}/jobs?icao=${icao}` : `${API_BASE}/jobs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}

export async function refreshJobs(icao, minRunwayFt = 3000) {
  const res = await fetch(`${API_BASE}/jobs/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ icao, minRunwayFt })
  });
  if (!res.ok) throw new Error('Failed to refresh jobs');
  return res.json();
}

export async function acceptJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/accept`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to accept job');
  }
  return res.json();
}

export async function cancelJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel job');
  return res.json();
}

export async function fetchAirports(query = '') {
  const res = await fetch(`${API_BASE}/airports?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to fetch airports');
  return res.json();
}

// Simulator Control API
export async function stepFlightPhase(phase) {
  const res = await fetch(`${API_BASE}/simulator/step-phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to step flight phase');
  }
  return res.json();
}

export async function startMockFlight(speedMultiplier = 1.0) {
  const res = await fetch(`${API_BASE}/simulator/start-mock-flight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speedMultiplier })
  });
  return res.json();
}

export async function stopMockFlight() {
  const res = await fetch(`${API_BASE}/simulator/stop-mock-flight`, { method: 'POST' });
  return res.json();
}

export async function teleportToAirport(icao) {
  const res = await fetch(`${API_BASE}/simulator/teleport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ icao })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to teleport to airport');
  }
  return res.json();
}

export async function updateBaseAirport(icao) {
  const res = await fetch(`${API_BASE}/pilot/base-airport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ icao })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to update base airport');
  }
  return res.json();
}

// Fleet & Dealership API
export async function fetchAircraftCatalog() {
  const res = await fetch(`${API_BASE}/fleet/catalog`);
  if (!res.ok) throw new Error('Failed to fetch aircraft catalog');
  return res.json();
}

export async function fetchHangar() {
  const res = await fetch(`${API_BASE}/fleet/hangar`);
  if (!res.ok) throw new Error('Failed to fetch hangar fleet');
  return res.json();
}

export async function buyAircraft(modelId, tailNumber = '') {
  const res = await fetch(`${API_BASE}/fleet/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, tailNumber })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to purchase aircraft');
  }
  return res.json();
}

export async function rentAircraft(modelId) {
  const res = await fetch(`${API_BASE}/fleet/rent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to rent aircraft');
  }
  return res.json();
}

export async function selectActiveAircraft(modelId, tailNumber = '') {
  const res = await fetch(`${API_BASE}/fleet/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, tailNumber })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to select active aircraft');
  }
  return res.json();
}

export async function sellAircraft(tailNumber) {
  const res = await fetch(`${API_BASE}/fleet/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tailNumber })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to sell aircraft');
  }
  return res.json();
}

export async function returnAircraft(tailNumber) {
  const res = await fetch(`${API_BASE}/fleet/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tailNumber })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to return leased aircraft');
  }
  return res.json();
}




