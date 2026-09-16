import { EventEmitter } from 'events';
import flightStateMachine from './stateMachine.js';
import Airport from '../models/Airport.js';

export class SimConnectBridge extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.isMockMode = false;
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
      console.log('[SimConnect] Starting in MOCK Telemetry mode.');
      this.startMockTelemetry();
      return;
    }

    await this.tryConnectSimConnect();
  }

  async tryConnectSimConnect() {
    try {
      // Dynamically import node-simconnect
      const { open, Protocol, SimConnectDataType, Period, Flags } = await import('node-simconnect');

      console.log('[SimConnect] Attempting connection to MSFS 2024 via SimConnect...');
      const { handle, recvOpen } = await open('Airbound MSFS Tracker', Protocol.FSX_SP2);
      this.simConnectHandle = handle;
      this.isConnected = true;
      this.isMockMode = false;
      console.log(`[SimConnect] Connected to simulator: ${recvOpen?.applicationName || 'MSFS'}`);
      this.emit('connectionStatus', { connected: true, isMock: false, app: recvOpen?.applicationName });

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

      // Request continuous telemetry data at 1 Hz
      handle.requestDataOnSimObject(REQ_ID, DEF_ID, 0, Period.SECOND, Flags.DEFAULT);

      handle.on('simObjectData', (recvSimObjectData) => {
        if (recvSimObjectData.requestID === REQ_ID) {
          const data = recvSimObjectData.data;
          this.telemetry = {
            latitude: data.readFloat64(0),
            longitude: data.readFloat64(8),
            altitude: Math.round(data.readFloat64(16)),
            heading: Math.round(data.readFloat64(24)),
            simOnGround: Boolean(data.readInt32(32)),
            airspeedTrue: Math.round(data.readFloat64(36)),
            groundSpeed: Math.round(data.readFloat64(44)),
            parkingBrake: Boolean(data.readInt32(52)),
            engineRunning: Boolean(data.readInt32(56)),
            timestamp: Date.now()
          };

          this._broadcastTelemetry();
        }
      });

      handle.on('close', () => {
        console.warn('[SimConnect] Connection to MSFS closed. Falling back to retry/mock.');
        this.isConnected = false;
        this.emit('connectionStatus', { connected: false, isMock: this.isMockMode });
        this._scheduleReconnect();
      });

      handle.on('error', (err) => {
        console.warn('[SimConnect] Error:', err.message);
      });
    } catch (err) {
      console.log(`[SimConnect] MSFS 2024 not detected (${err.message}). Activating Mock Mode for companion UI testing.`);
      this.startMockTelemetry();
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isConnected && !this.isMockMode) {
        this.tryConnectSimConnect();
      }
    }, 10000);
  }

  startMockTelemetry() {
    this.isMockMode = true;
    this.emit('connectionStatus', { connected: true, isMock: true, app: 'Simulated MSFS Bridge' });

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
      this.telemetry.parkingBrake = false;
    } else if (p < 0.85) {
      // Cruise (EN ROUTE)
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = 8500;
      this.telemetry.airspeedTrue = 165;
      this.telemetry.groundSpeed = 170;
      this.telemetry.parkingBrake = false;
    } else if (p < 0.95) {
      // Approach / Final Descent
      this.telemetry.simOnGround = false;
      this.telemetry.altitude = Math.round(8500 - ((p - 0.85) / 0.1) * 8350);
      this.telemetry.airspeedTrue = 90;
      this.telemetry.groundSpeed = 85;
    } else if (p < 0.99) {
      // TOUCHDOWN roll
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 150;
      this.telemetry.airspeedTrue = Math.max(10, Math.round(70 - ((p - 0.95) / 0.04) * 60));
      this.telemetry.groundSpeed = this.telemetry.airspeedTrue;
    } else {
      // COMPLETED: stopped and secured
      this.telemetry.simOnGround = true;
      this.telemetry.altitude = 150;
      this.telemetry.airspeedTrue = 0;
      this.telemetry.groundSpeed = 0;
      this.telemetry.parkingBrake = true;
      this.telemetry.engineRunning = false;
      this.mockFlight.active = false;
    }

    this.telemetry.timestamp = Date.now();
  }

  async _broadcastTelemetry() {
    // Pass telemetry to state machine
    const stateResult = await flightStateMachine.processTelemetry(this.telemetry);

    // Emit event with telemetry and updated flight phase
    this.emit('telemetry', {
      telemetry: this.telemetry,
      phase: stateResult.phase,
      originDist: stateResult.originDist,
      destDist: stateResult.destDist,
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

