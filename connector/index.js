import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const API_URL = (process.env.AIRBOUND_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
const PILOT_CALLSIGN = process.env.PILOT_CALLSIGN || 'James';
const IS_MOCK_ARG = process.argv.includes('--mock') || process.env.USE_MOCK === 'true';

// Haversine distance in nautical miles
function calculateDistanceNm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 3440.065; // Earth radius in NM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

class AirboundSimConnector {
  constructor() {
    this.apiUrl = API_URL;
    this.pilotCallsign = PILOT_CALLSIGN;
    this.passcode = (process.env.AIRBOUND_PASSCODE || process.env.PILOT_PASSCODE || '').trim();
    this.isMock = IS_MOCK_ARG;
    this.isConnected = false;
    this.appName = null;
    this.simHandle = null;
    this.reconnectTimer = null;

    // Flight state
    this.phase = 'STANDBY';
    this.activeFlight = null;
    this.activeJob = null;
    this.isFreeFlight = false;
    this.originAirport = null;
    this.destinationAirport = null;

    // Timing
    this.flightSeconds = 0;
    this.airborneSeconds = 0;
    this.lastTickTime = null;
    this.departedAt = null;
    this.touchdownAt = null;

    // Telemetry state
    this.telemetry = {
      latitude: 33.9425,
      longitude: -118.4081,
      altitude: 125,
      altAboveGround: 0,
      heading: 250,
      simOnGround: true,
      airspeedTrue: 0,
      groundSpeed: 0,
      parkingBrake: true,
      engineRunning: true,
      simAircraftTitle: 'Cessna 172 Skyhawk',
      simAircraftModel: 'C172',
      isPaused: false,
      verticalSpeed: 0,
      timestamp: Date.now()
    };

    // Flare buffer & touchdown
    this.airborneSamples = [];
    this.touchdownFpm = null;
    this.approachSpeedKts = null;
    this.previousSimOnGround = true;

    // Mock progress
    this.mockProgress = 0;
  }

  logBanner() {
    console.log('\x1b[36m===================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[36m    AIRBOUND • MSFS 2024 / 2020 CLOUD TELEMETRY CONNECTOR        \x1b[0m');
    console.log('\x1b[36m===================================================================\x1b[0m');
    console.log(`  \x1b[33mAirbound API:\x1b[0m  ${this.apiUrl}`);
    console.log(`  \x1b[33mPilot:\x1b[0m         ${this.pilotCallsign}`);
    console.log(`  \x1b[33mMode:\x1b[0m          ${this.isMock ? '\x1b[35mMOCK FLIGHT SIMULATION\x1b[0m' : 'LIVE SIMCONNECT'}`);
    console.log('\x1b[36m-------------------------------------------------------------------\x1b[0m\n');
  }

  async start() {
    this.logBanner();

    // 1. Verify API connectivity
    await this.testApiConnection();

    // 2. Connect to SimConnect or launch mock mode
    if (this.isMock) {
      this.startMockMode();
    } else {
      await this.connectSimConnect();
    }

    // 3. Start cloud telemetry sync loop (1 Hz)
    setInterval(() => this.tickSyncLoop(), 1000);

    // 4. Start active flight sync loop (every 2.5s)
    setInterval(() => this.syncActiveFlight(), 2500);
    await this.syncActiveFlight();
  }

  getHeaders(extra = {}) {
    const headers = { ...extra };
    if (this.passcode) {
      headers['x-pilot-passcode'] = this.passcode;
    }
    return headers;
  }

  async testApiConnection() {
    try {
      const res = await fetch(`${this.apiUrl}/api/health`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        console.log(`\x1b[32m✓ Connected to Airbound Backend at ${this.apiUrl}\x1b[0m`);
      } else {
        console.warn(`\x1b[33m! Airbound API responded with status ${res.status}\x1b[0m`);
      }
    } catch (err) {
      console.warn(`\x1b[33m! Warning: Could not reach Airbound API at ${this.apiUrl} (${err.message}). Will retry.\x1b[0m`);
    }
  }

  async connectSimConnect() {
    try {
      console.log('\x1b[34m[SimConnect] Searching for MSFS 2024 / 2020...\x1b[0m');
      const { open, Protocol, SimConnectDataType, SimConnectPeriod, DataRequestFlag } = await import('node-simconnect');

      const { handle, recvOpen } = await open('Airbound MSFS Connector', Protocol.FSX_SP2);
      this.simHandle = handle;
      this.isConnected = true;
      this.appName = recvOpen?.applicationName === 'SunRise' ? 'MSFS 2024' : (recvOpen?.applicationName || 'MSFS 2024');

      console.log(`\x1b[32m✓ MSFS Connected: ${this.appName}\x1b[0m`);

      // Define SimVars definition
      const DEF_ID = 1;
      const REQ_ID = 1;
      const EVENT_ID_PAUSE = 1;

      handle.addToDataDefinition(DEF_ID, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'SIM ON GROUND', 'bool', SimConnectDataType.INT32);
      handle.addToDataDefinition(DEF_ID, 'AIRSPEED TRUE', 'knots', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'GROUND VELOCITY', 'knots', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'BRAKE PARKING POSITION', 'bool', SimConnectDataType.INT32);
      handle.addToDataDefinition(DEF_ID, 'ENG COMBUSTION:1', 'bool', SimConnectDataType.INT32);
      handle.addToDataDefinition(DEF_ID, 'TITLE', null, SimConnectDataType.STRING256);
      handle.addToDataDefinition(DEF_ID, 'ATC MODEL', null, SimConnectDataType.STRING64);
      handle.addToDataDefinition(DEF_ID, 'VERTICAL SPEED', 'feet per minute', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE ALT ABOVE GROUND', 'feet', SimConnectDataType.FLOAT64);

      try {
        handle.subscribeToSystemEvent(EVENT_ID_PAUSE, 'Pause');
      } catch (err) {
        // Pause event optional
      }

      handle.on('event', (recvEvent) => {
        const eventId = recvEvent.clientEventId ?? recvEvent.eventID;
        if (eventId === EVENT_ID_PAUSE) {
          this.telemetry.isPaused = recvEvent.data === 1;
        }
      });

      // Request frame telemetry (~10-20 Hz for high-res flare buffer)
      handle.requestDataOnSimObject(REQ_ID, DEF_ID, 0, SimConnectPeriod.SIM_FRAME, DataRequestFlag.DATA_REQUEST_FLAG_DEFAULT);

      handle.on('simObjectData', (recv) => {
        if (recv.requestID === REQ_ID) {
          const data = recv.data;
          const baseOffset = (typeof data.getOffset === 'function' ? data.getOffset() : 0) || 0;
          data.setOffset(baseOffset);

          const lat = data.readFloat64();
          const lon = data.readFloat64();
          const alt = data.readFloat64();
          const hdg = data.readFloat64();
          const onGround = Boolean(data.readInt32());
          const tas = data.readFloat64();
          const gs = data.readFloat64();
          const brake = Boolean(data.readInt32());
          const eng = Boolean(data.readInt32());

          let title = this.telemetry.simAircraftTitle;
          let model = this.telemetry.simAircraftModel;
          try {
            data.setOffset(baseOffset + 60);
            const rawTitle = data.readString256();
            if (rawTitle) title = rawTitle.replace(/\0.*$/, '').trim();
            data.setOffset(baseOffset + 316);
            const rawModel = data.readString64();
            if (rawModel) model = rawModel.replace(/\0.*$/, '').trim();
          } catch {}

          let vs = 0;
          let agl = 0;
          try {
            data.setOffset(baseOffset + 380);
            vs = data.readFloat64();
            data.setOffset(baseOffset + 388);
            agl = data.readFloat64();
          } catch {}

          const isValidLoc = Number.isFinite(lat) && Number.isFinite(lon) && !(Math.abs(lat) < 0.05 && Math.abs(lon) < 0.05);

          this.updateTelemetryFrame({
            latitude: isValidLoc ? lat : this.telemetry.latitude,
            longitude: isValidLoc ? lon : this.telemetry.longitude,
            altitude: Number.isFinite(alt) ? Math.round(alt) : this.telemetry.altitude,
            altAboveGround: Number.isFinite(agl) ? Math.round(agl) : 0,
            heading: Number.isFinite(hdg) ? Math.round(hdg) : this.telemetry.heading,
            simOnGround: onGround,
            airspeedTrue: Number.isFinite(tas) ? Math.max(0, Math.round(tas)) : 0,
            groundSpeed: Number.isFinite(gs) ? Math.max(0, Math.round(gs)) : 0,
            parkingBrake: brake,
            engineRunning: eng,
            simAircraftTitle: title,
            simAircraftModel: model,
            verticalSpeed: Number.isFinite(vs) ? Math.round(vs) : 0,
            timestamp: Date.now()
          });
        }
      });

      handle.on('close', () => {
        console.warn('\x1b[33m[SimConnect] Simulator disconnected. Reconnecting in background...\x1b[0m');
        this.isConnected = false;
        this.simHandle = null;
        this.appName = null;
        this.scheduleReconnect();
      });

      handle.on('error', (err) => {
        console.warn(`\x1b[33m[SimConnect] SimConnect Error: ${err.message}\x1b[0m`);
      });
    } catch (err) {
      this.isConnected = false;
      this.simHandle = null;
      console.log(`\x1b[90m[SimConnect] MSFS not running (${err.message}). Retrying in 4s...\x1b[0m`);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected) this.connectSimConnect();
    }, 4000);
  }

  startMockMode() {
    this.isConnected = true;
    this.appName = 'Airbound Mock Flight Generator';
    console.log('\x1b[35m✓ Mock Mode Active: Generating realistic simulated flight telemetry\x1b[0m');
  }

  updateTelemetryFrame(incoming) {
    const now = incoming.timestamp || Date.now();
    this.telemetry = { ...this.telemetry, ...incoming, timestamp: now };

    // Record airborne samples for touchdown flare rate
    if (!this.telemetry.simOnGround) {
      this.airborneSamples.push({
        time: now,
        vs: this.telemetry.verticalSpeed,
        tas: this.telemetry.airspeedTrue,
        gs: this.telemetry.groundSpeed,
        alt: this.telemetry.altitude,
        agl: this.telemetry.altAboveGround
      });
      // Keep only final 5 seconds of airborne samples
      if (this.airborneSamples.length > 100) {
        this.airborneSamples = this.airborneSamples.filter((s) => now - s.time <= 5000);
      }
    }

    this.evaluatePhaseTransitions();
  }

  evaluatePhaseTransitions() {
    const { simOnGround, groundSpeed, parkingBrake, engineRunning } = this.telemetry;
    const now = Date.now();

    // 1. STANDBY -> IDLE: Triggered when active flight is accepted
    if (this.phase === 'STANDBY' && (this.activeJob || this.isFreeFlight)) {
      this.phase = 'IDLE';
      this.departedAt = null;
      this.touchdownAt = null;
      this.flightSeconds = 0;
      this.airborneSeconds = 0;
      console.log(`\x1b[36m[Flight] Flight armed: ${this.activeJob?.origin_icao || 'Auto'} -> ${this.activeJob?.destination_icao || 'Open Roam'} (IDLE)\x1b[0m`);
    }

    // 2. IDLE -> DEPARTED: Wheels leave the ground
    if (this.phase === 'IDLE' && !simOnGround && groundSpeed > 35) {
      this.phase = 'DEPARTED';
      this.departedAt = new Date();
      console.log(`\x1b[32m[Flight] DEPARTED: Airborne from ${this.activeJob?.origin_icao || 'origin'}!\x1b[0m`);
    }

    // 3. DEPARTED -> EN ROUTE: Airborne above 400 AGL or 3 NM out
    if (this.phase === 'DEPARTED') {
      const origDist = this.getOriginDistance();
      if ((origDist != null && origDist > 2.5) || this.telemetry.altAboveGround > 400 || this.airborneSeconds > 60) {
        this.phase = 'EN ROUTE';
        console.log('\x1b[34m[Flight] EN ROUTE: Cruising to destination\x1b[0m');
      }
    }

    // 4. (DEPARTED / EN ROUTE) -> TOUCHDOWN: Transition from airborne to ground
    const wasAirborne = !this.previousSimOnGround;
    if ((this.phase === 'EN ROUTE' || this.phase === 'DEPARTED') && wasAirborne && simOnGround) {
      this.phase = 'TOUCHDOWN';
      this.touchdownAt = new Date();
      this.touchdownFpm = this.determineTouchdownFpm(now);
      this.approachSpeedKts = this.determineApproachSpeed(now);
      console.log(`\x1b[33m[Flight] TOUCHDOWN! Rate: ${this.touchdownFpm != null ? this.touchdownFpm + ' FPM' : 'Captured'}\x1b[0m`);
    }

    // 5. TOUCHDOWN -> COMPLETED: Ground speed < 5 kts and secured (brake set or engines cut)
    if (this.phase === 'TOUCHDOWN') {
      const isStopped = groundSpeed < 5.0;
      const isSecured = parkingBrake || !engineRunning;

      if (isStopped && isSecured) {
        this.phase = 'COMPLETED';
        console.log('\x1b[32m[Flight] Aircraft stopped and secured. Completing flight...\x1b[0m');
        this.submitFlightCompletion();
      }
    }

    this.previousSimOnGround = simOnGround;
  }

  determineTouchdownFpm(now) {
    const instantVs = this.telemetry.verticalSpeed;
    if (this.isMock) return -135;

    const recent = this.airborneSamples.filter((s) => now - s.time <= 1500);
    if (recent.length > 0) {
      const descending = recent.filter((s) => s.vs < 0);
      if (descending.length > 0) {
        const flare = descending.slice(-5);
        const sum = flare.reduce((acc, s) => acc + s.vs, 0);
        const flareAvg = Math.round(sum / flare.length);
        if (instantVs != null && instantVs <= -50) {
          return Math.min(instantVs, flareAvg);
        }
        return flareAvg;
      }
      const last = recent[recent.length - 1];
      if (last && last.vs !== 0) return last.vs;
    }
    return instantVs;
  }

  determineApproachSpeed(now) {
    const recent = this.airborneSamples.filter((s) => now - s.time <= 3500);
    if (recent.length > 0) {
      const speeds = recent.map((s) => s.tas || s.gs).filter((s) => s != null && s > 25);
      if (speeds.length > 0) {
        return Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
      }
    }
    return null;
  }

  getOriginDistance() {
    if (this.originAirport?.location?.coordinates && this.telemetry.latitude && this.telemetry.longitude) {
      const [oLon, oLat] = this.originAirport.location.coordinates;
      return calculateDistanceNm(this.telemetry.latitude, this.telemetry.longitude, oLat, oLon);
    }
    return null;
  }

  getDestDistance() {
    if (this.destinationAirport?.location?.coordinates && this.telemetry.latitude && this.telemetry.longitude) {
      const [dLon, dLat] = this.destinationAirport.location.coordinates;
      return calculateDistanceNm(this.telemetry.latitude, this.telemetry.longitude, dLat, dLon);
    }
    return null;
  }

  async syncActiveFlight() {
    try {
      const res = await fetch(`${this.apiUrl}/api/telemetry/active-flight`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.hasActiveFlight) {
        const hadFlight = Boolean(this.activeJob || this.isFreeFlight);
        this.activeJob = data.activeJob;
        this.isFreeFlight = Boolean(data.isFreeFlight);
        this.originAirport = data.originAirport;
        this.destinationAirport = data.destinationAirport;

        if (!hadFlight && this.phase === 'STANDBY') {
          this.phase = 'IDLE';
          console.log(`\x1b[36m[Airbound Cloud] New flight detected: ${this.activeJob.origin_icao || 'Auto'} -> ${this.activeJob.destination_icao || 'Open Roam'}\x1b[0m`);
        }
      } else {
        if (this.phase !== 'COMPLETED' && (this.activeJob || this.isFreeFlight)) {
          // Flight was cancelled or cleared
          this.activeJob = null;
          this.isFreeFlight = false;
          this.phase = 'STANDBY';
        }
      }
    } catch {
      // Sync retry on next cycle
    }
  }

  async submitFlightCompletion() {
    try {
      console.log('\x1b[36m[Flight] Submitting completion payload to Airbound Cloud...\x1b[0m');
      const payload = {
        job: this.activeJob,
        telemetry: this.telemetry,
        touchdownFpm: this.touchdownFpm,
        approachSpeedKts: this.approachSpeedKts,
        flightSeconds: Math.round(this.flightSeconds),
        airborneSeconds: Math.round(this.airborneSeconds),
        departedAt: this.departedAt,
        touchdownAt: this.touchdownAt
      };

      const res = await fetch(`${this.apiUrl}/api/flight/complete`, {
        method: 'POST',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const f = data.flight;
        console.log('\n\x1b[32m===================================================================');
        console.log('   🎉 FLIGHT COMPLETED & SETTLED SUCCESSFULLY IN AIRBOUND!');
        console.log('===================================================================\x1b[0m');
        console.log(`  Route:      ${f?.summary?.origin_icao} ➔ ${f?.summary?.destination_icao}`);
        console.log(`  Touchdown:  ${f?.touchdownFpm ? f.touchdownFpm + ' FPM' : 'Captured'} (${f?.landingRating || 'Clean'})`);
        console.log(`  Net Payout: $${(f?.payout || 0).toLocaleString()}`);
        console.log(`  XP Earned:  +${(f?.flightXp?.totalXp || 0).toLocaleString()} XP (Level ${f?.rankInfo?.level || 1}: ${f?.rankInfo?.title || 'Aviator'})`);
        console.log('\x1b[32m===================================================================\x1b[0m\n');
      } else {
        const text = await res.text();
        console.warn(`\x1b[31m[Flight Completion Error]: Server returned ${res.status}: ${text}\x1b[0m`);
      }
    } catch (err) {
      console.error(`\x1b[31m[Flight Completion Error]: Failed to post completion: ${err.message}\x1b[0m`);
    } finally {
      // Reset for next flight
      this.activeJob = null;
      this.isFreeFlight = false;
      this.phase = 'STANDBY';
      this.flightSeconds = 0;
      this.airborneSeconds = 0;
      this.touchdownFpm = null;
    }
  }

  tickSyncLoop() {
    const now = Date.now();

    // 1. Step Mock Simulation if in mock mode
    if (this.isMock) {
      this.tickMockSimulation();
    }

    // 2. Flight time accounting (pause-free)
    if (!this.telemetry.isPaused && this.lastTickTime) {
      const dt = (now - this.lastTickTime) / 1000;
      if (this.phase !== 'STANDBY' && this.phase !== 'COMPLETED') {
        this.flightSeconds += dt;
        if (!this.telemetry.simOnGround) {
          this.airborneSeconds += dt;
        }
      }
    }
    this.lastTickTime = now;

    // 3. Compute distances
    const originDist = this.getOriginDistance();
    const destDist = this.getDestDistance();

    // 4. Send telemetry heartbeat to cloud
    const payload = {
      callsign: this.pilotCallsign,
      telemetry: this.telemetry,
      phase: this.phase,
      originDist,
      destDist,
      flightSeconds: Math.round(this.flightSeconds),
      airborneSeconds: Math.round(this.airborneSeconds),
      isPaused: Boolean(this.telemetry.isPaused),
      isMock: this.isMock,
      app: this.appName || (this.isMock ? 'Mock Bridge' : 'MSFS 2024'),
      touchdownFpm: this.touchdownFpm,
      approachSpeedKts: this.approachSpeedKts
    };

    fetch(`${this.apiUrl}/api/telemetry`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    }).catch(() => {
      // Silent error on transient blip
    });

    // 5. Console status line
    this.printCockpitStatus(destDist);
  }

  printCockpitStatus(destDist) {
    const p = this.phase;
    const alt = this.telemetry.altitude.toLocaleString();
    const spd = this.telemetry.airspeedTrue;
    const hdg = String(this.telemetry.heading).padStart(3, '0');
    const distStr = destDist != null ? ` • ${Math.round(destDist)} NM to ${this.activeJob?.destination_icao || 'DEST'}` : '';

    const phaseColor =
      p === 'DEPARTED' || p === 'EN ROUTE'
        ? '\x1b[34m'
        : p === 'TOUCHDOWN'
        ? '\x1b[33m'
        : p === 'IDLE'
        ? '\x1b[36m'
        : '\x1b[90m';

    process.stdout.write(
      `\r[${this.appName || 'MSFS'}] ${phaseColor}[${p}]\x1b[0m ${alt} FT | ${spd} KTS | HDG ${hdg}°${distStr}   `
    );
  }

  tickMockSimulation() {
    if (!this.activeJob && !this.isFreeFlight) {
      this.mockProgress = 0;
      this.telemetry.simOnGround = true;
      this.telemetry.airspeedTrue = 0;
      this.telemetry.groundSpeed = 0;
      this.telemetry.parkingBrake = true;
      return;
    }

    // Step mock flight
    this.mockProgress += 0.02;
    if (this.mockProgress > 1.0) this.mockProgress = 1.0;
    const p = this.mockProgress;

    const [oLon, oLat] = this.originAirport?.location?.coordinates || [-97.27, 37.62];
    const [dLon, dLat] = this.destinationAirport?.location?.coordinates || [-94.31, 36.28];

    this.telemetry.latitude = oLat + (dLat - oLat) * p;
    this.telemetry.longitude = oLon + (dLon - oLon) * p;

    if (p < 0.05) {
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 1300;
      this.telemetry.airspeedTrue = Math.round(p * 1400);
      this.telemetry.groundSpeed = this.telemetry.airspeedTrue;
      this.telemetry.parkingBrake = false;
      this.telemetry.engineRunning = true;
    } else if (p < 0.15) {
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = Math.round(1300 + ((p - 0.05) / 0.1) * 3500);
      this.telemetry.airspeedTrue = 120;
      this.telemetry.groundSpeed = 125;
      this.telemetry.verticalSpeed = 800;
    } else if (p < 0.85) {
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = 5500;
      this.telemetry.airspeedTrue = 135;
      this.telemetry.groundSpeed = 140;
      this.telemetry.verticalSpeed = 0;
    } else if (p < 0.96) {
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = Math.round(5500 - ((p - 0.85) / 0.11) * 4200);
      this.telemetry.airspeedTrue = 75;
      this.telemetry.groundSpeed = 70;
      this.telemetry.verticalSpeed = -450;
    } else if (p < 0.99) {
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 1300;
      this.telemetry.airspeedTrue = Math.max(10, Math.round(60 - ((p - 0.96) / 0.03) * 50));
      this.telemetry.groundSpeed = this.telemetry.airspeedTrue;
      this.telemetry.verticalSpeed = -135;
    } else {
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 1300;
      this.telemetry.airspeedTrue = 0;
      this.telemetry.groundSpeed = 0;
      this.telemetry.parkingBrake = true;
      this.telemetry.engineRunning = false;
    }

    this.updateTelemetryFrame(this.telemetry);
  }
}

const connector = new AirboundSimConnector();
connector.start().catch((err) => {
  console.error('\x1b[31m[Fatal Connector Error]:\x1b[0m', err);
});
