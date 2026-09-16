const API_BASE = '/api';

export async function fetchPilot() {
  const res = await fetch(`${API_BASE}/pilot`);
  if (!res.ok) throw new Error('Failed to fetch pilot');
  return res.json();
}

export async function resetPilot() {
  const res = await fetch(`${API_BASE}/pilot/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset pilot');
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
  return res.json();
}
