import { EventEmitter } from 'events';
import flightStateMachine from './stateMachine.js';
import Airport from '../models/Airport.js';

export class SimConnectBridge extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.isMockMode = false;
    this.appName = null;
    this.pollInterval = null;
    this.reconnectTimer = null;
    this.simConnectHandle = null;

    // Current Telemetry State
    this.telemetry = {
      latitude: 33.942536,
      longitude: -118.408074,
      altitude: 125, // feet
      heading: 250, // degrees
      simOnGround: true,
      airspeedTrue: 0, // knots
      groundSpeed: 0, // knots
      parkingBrake: true,
      engineRunning: true,
      simAircraftTitle: '',
      simAircraftModel: '',
      isPaused: false,
      verticalSpeed: 0,
      timestamp: Date.now()
    };

    // Mock Flight Simulation State
    this.mockFlight = {
      active: false,
      progress: 0, // 0 to 1
      speedMultiplier: 1.0,
      origin: null,
      destination: null
    };
  }

  async init(options = {}) {
    const forceMock = options.forceMock || process.env.USE_MOCK_SIMCONNECT === 'true';

    if (forceMock) {
      console.log('[SimConnect] Starting in MOCK Telemetry mode (forced).');
      this.startMockTelemetry();
      return;
    }

    await this.tryConnectSimConnect();
  }

  async tryConnectSimConnect() {
    try {
      // Dynamically import node-simconnect
      const { open, Protocol, SimConnectDataType, SimConnectPeriod, DataRequestFlag } = await import('node-simconnect');

      console.log('[SimConnect] Attempting connection to MSFS 2024 via SimConnect...');
      const { handle, recvOpen } = await open('Airbound MSFS Tracker', Protocol.FSX_SP2);
      this.simConnectHandle = handle;
      this.isConnected = true;
      this.isMockMode = false;
      this.appName = recvOpen?.applicationName === 'SunRise' ? 'MSFS 2024' : (recvOpen?.applicationName || 'MSFS 2024');

      // Clear any running mock simulation interval & reconnection timer
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      console.log(`[SimConnect] Connected to simulator: ${this.appName}`);
      this.emit('connectionStatus', {
        connected: true,
        isMock: false,
        app: this.appName
      });

      // Define SimVars definition
      const DEF_ID = 1;
      const REQ_ID = 1;

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
      handle.addToDataDefinition(DEF_ID, 'IS SIM PAUSED', 'bool', SimConnectDataType.INT32);
      handle.addToDataDefinition(DEF_ID, 'VERTICAL SPEED', 'feet per minute', SimConnectDataType.FLOAT64);

      // Request continuous telemetry data at 1 Hz
      handle.requestDataOnSimObject(
        REQ_ID,
        DEF_ID,
        0,
        SimConnectPeriod.SECOND,
        DataRequestFlag.DATA_REQUEST_FLAG_DEFAULT
      );

      handle.on('simObjectData', (recvSimObjectData) => {
        if (recvSimObjectData.requestID === REQ_ID) {
          const data = recvSimObjectData.data;
          const lat = data.readFloat64(0);
          const lon = data.readFloat64(8);
          const alt = data.readFloat64(16);
          const hdg = data.readFloat64(24);
          const onGround = Boolean(data.readInt32(32));
          const tas = data.readFloat64(36);
          const gs = data.readFloat64(44);
          const brake = Boolean(data.readInt32(52));
          const eng = Boolean(data.readInt32(56));

          let simTitle = this.telemetry.simAircraftTitle || '';
          let simModel = this.telemetry.simAircraftModel || '';
          try {
            const rawTitle = data.readString256(60);
            if (rawTitle) simTitle = rawTitle.replace(/\0.*$/, '').trim();
            const rawModel = data.readString64(316);
            if (rawModel) simModel = rawModel.replace(/\0.*$/, '').trim();
          } catch {
            // RawBuffer safety fallback
          }

          let isPaused = false;
          let vs = 0;
          try {
            if (data.byteLength >= 384) {
              isPaused = Boolean(data.readInt32(380));
            }
            if (data.byteLength >= 392) {
              vs = data.readFloat64(384);
            }
          } catch {
            // Buffer boundary safety fallback
          }

          this.telemetry = {
            latitude: Number.isFinite(lat) ? lat : this.telemetry.latitude,
            longitude: Number.isFinite(lon) ? lon : this.telemetry.longitude,
            altitude: Number.isFinite(alt) ? Math.round(alt) : this.telemetry.altitude,
            heading: Number.isFinite(hdg) ? Math.round(hdg) : this.telemetry.heading,
            simOnGround: onGround,
            airspeedTrue: Number.isFinite(tas) ? Math.max(0, Math.round(tas)) : 0,
            groundSpeed: Number.isFinite(gs) ? Math.max(0, Math.round(gs)) : 0,
            parkingBrake: brake,
            engineRunning: eng,
            simAircraftTitle: simTitle,
            simAircraftModel: simModel,
            isPaused: isPaused,
            verticalSpeed: Number.isFinite(vs) ? Math.round(vs) : 0,
            timestamp: Date.now()
          };

          this._broadcastTelemetry();
        }
      });

      handle.on('close', () => {
        console.warn('[SimConnect] Connection to MSFS closed. Reconnecting in background...');
        this.isConnected = false;
        this.simConnectHandle = null;
        this.appName = null;
        this.emit('connectionStatus', { connected: false, isMock: false, app: null });
        this._scheduleReconnect();
      });

      handle.on('error', (err) => {
        console.warn('[SimConnect] Error:', err.message);
      });
    } catch (err) {
      this.isConnected = false;
      this.simConnectHandle = null;
      this.appName = null;
      console.log(`[SimConnect] MSFS 2024 not detected (${err.message}). Retrying in 5s...`);
      this.emit('connectionStatus', { connected: false, isMock: this.isMockMode, app: null });
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected) {
        this.tryConnectSimConnect();
      }
    }, 5000);
  }

  startMockTelemetry() {
    this.isMockMode = true;
    this.isConnected = true;
    this.appName = 'Simulated MSFS Bridge';
    this.telemetry.simAircraftTitle = this.telemetry.simAircraftTitle || 'Cessna 172 Skyhawk (Mock)';
    this.telemetry.simAircraftModel = this.telemetry.simAircraftModel || 'C172';
    this.emit('connectionStatus', { connected: true, isMock: true, app: this.appName });

    if (this.pollInterval) clearInterval(this.pollInterval);

    // 1 Hz simulation tick
    this.pollInterval = setInterval(() => {
      this._tickMockSimulation();
      this._broadcastTelemetry();
    }, 1000);
  }

  _tickMockSimulation() {
    if (!this.mockFlight.active || !this.mockFlight.origin || !this.mockFlight.destination) {
      this.telemetry.timestamp = Date.now();
      return;
    }

    // Step mock flight along the route
    this.mockFlight.progress += 0.02 * this.mockFlight.speedMultiplier;
    if (this.mockFlight.progress > 1.0) this.mockFlight.progress = 1.0;

    const p = this.mockFlight.progress;
    const [oLon, oLat] = this.mockFlight.origin;
    const [dLon, dLat] = this.mockFlight.destination;

    // Linear interpolation of coordinates
    this.telemetry.latitude = oLat + (dLat - oLat) * p;
    this.telemetry.longitude = oLon + (dLon - oLon) * p;

    if (p < 0.05) {
      // Taxi / Takeoff roll
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 120;
      this.telemetry.airspeedTrue = Math.min(80, Math.round(p * 1600));
      this.telemetry.groundSpeed = this.telemetry.airspeedTrue;
      this.telemetry.parkingBrake = false;
      this.telemetry.engineRunning = true;
    } else if (p < 0.15) {
      // Initial climb (DEPARTED)
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = Math.round(120 + ((p - 0.05) / 0.1) * 3000);
      this.telemetry.airspeedTrue = 140;
      this.telemetry.groundSpeed = 145;
      this.telemetry.verticalSpeed = 1200;
      this.telemetry.parkingBrake = false;
    } else if (p < 0.85) {
      // Cruise (EN ROUTE)
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = 8500;
      this.telemetry.airspeedTrue = 165;
      this.telemetry.groundSpeed = 170;
      this.telemetry.verticalSpeed = 0;
      this.telemetry.parkingBrake = false;
    } else if (p < 0.95) {
      // Approach / Final Descent
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = Math.round(8500 - ((p - 0.85) / 0.1) * 8350);
      this.telemetry.airspeedTrue = 90;
      this.telemetry.groundSpeed = 85;
      this.telemetry.verticalSpeed = -500;
    } else if (p < 0.99) {
      // TOUCHDOWN roll
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 150;
      this.telemetry.airspeedTrue = Math.max(10, Math.round(70 - ((p - 0.95) / 0.04) * 60));
      this.telemetry.groundSpeed = this.telemetry.airspeedTrue;
      this.telemetry.verticalSpeed = -140;
    } else {
      // COMPLETED: stopped and secured
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 150;
      this.telemetry.airspeedTrue = 0;
      this.telemetry.groundSpeed = 0;
      this.telemetry.verticalSpeed = 0;
      this.telemetry.parkingBrake = true;
      this.telemetry.engineRunning = false;
      this.mockFlight.active = false;
    }

    this.telemetry.timestamp = Date.now();
  }

  async _broadcastTelemetry() {
    // Pass telemetry to state machine
    const stateResult = await flightStateMachine.processTelemetry(this.telemetry, { isMockMode: this.isMockMode });

    // Emit event with telemetry, updated flight phase, and aircraft validation
    this.emit('telemetry', {
      telemetry: this.telemetry,
      phase: stateResult.phase,
      originDist: stateResult.originDist,
      destDist: stateResult.destDist,
      aircraftValidation: stateResult.aircraftValidation,
      flightSeconds: stateResult.flightSeconds || 0,
      airborneSeconds: stateResult.airborneSeconds || 0,
      isPaused: Boolean(stateResult.isPaused),
      isMock: this.isMockMode
    });
  }

  /**
   * Allows UI simulator bar to step flight phase or inject coordinates
   */
  async injectTelemetry(partial) {
    this.telemetry = {
      ...this.telemetry,
      ...partial,
      timestamp: Date.now()
    };
    await this._broadcastTelemetry();
  }

  /**
   * Sets coordinates to a specific airport
   */
  async teleportToAirport(icao) {
    const airport = await Airport.findOne({ icao: icao.toUpperCase() });
    if (airport && airport.location?.coordinates) {
      const [lon, lat] = airport.location.coordinates;
      this.telemetry.latitude = lat;
      this.telemetry.longitude = lon;
      this.telemetry.altitude = 100;
      this.telemetry.simOnGround = true;
      this.telemetry.airspeedTrue = 0;
      this.telemetry.groundSpeed = 0;
      this.telemetry.parkingBrake = true;
      this.telemetry.engineRunning = true;
      this.mockFlight.active = false;
      await this._broadcastTelemetry();
      return true;
    }
    return false;
  }

  /**
   * Starts an automated mock flight between origin and destination
   */
  startAutomatedMockFlight(originCoords, destCoords, speedMultiplier = 1.0) {
    this.mockFlight = {
      active: true,
      progress: 0,
      speedMultiplier,
      origin: originCoords,
      destination: destCoords
    };
    this.telemetry.simOnGround = true;
    this.telemetry.parkingBrake = false;
    this.telemetry.engineRunning = true;
  }

  stopAutomatedMockFlight() {
    this.mockFlight.active = false;
  }
}

export const simConnectBridge = new SimConnectBridge();
export default simConnectBridge;

