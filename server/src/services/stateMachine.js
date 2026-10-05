import { calculateDistanceNm } from './geoUtils.js';
import Airport from '../models/Airport.js';
import Job from '../models/Job.js';
import Pilot from '../models/Pilot.js';
import { generateJobsForAirport } from './jobGenerator.js';
import { computeFlightSettlement } from './economyService.js';
import { validateAircraftMatch } from '../utils/aircraftValidator.js';
import { calculateFlightXp, rateLandingTouchdown, getPilotRank } from './xpService.js';
import { settleCompletedFlight } from './flightSettlement.js';

export const FLIGHT_PHASES = {
  STANDBY: 'STANDBY',
  IDLE: 'IDLE',
  DEPARTED: 'DEPARTED',
  EN_ROUTE: 'EN ROUTE',
  TOUCHDOWN: 'TOUCHDOWN',
  COMPLETED: 'COMPLETED'
};

export class FlightStateMachine {
  constructor(options = {}) {
    this.phase = FLIGHT_PHASES.STANDBY;
    this.activeJob = null;
    this.originAirport = null;
    this.destinationAirport = null;
    this.departedAt = null;
    this.touchdownAt = null;
    this.previousSimOnGround = true;
    this.onPhaseChangeCallback = options.onPhaseChange || null;
    this.onFlightCompletedCallback = options.onFlightCompleted || null;

    // Accurate pause-free flight time tracking
    this.activeFlightSeconds = 0; // Total unpaused flight time (departure to completion)
    this.airborneSeconds = 0; // Pure airborne unpaused time (departure to touchdown)
    this.pausedSeconds = 0; // Total paused time during flight
    this.lastTelemetryTime = null;
    this.isPaused = false;
    this.touchdownFpm = null;
    this.landingRating = '';
    this.approachSpeedKts = null;
    this.landingClass = '';
    this.landingClassLabel = '';
    this.airborneSamples = []; // High-resolution flare descent rate buffer
    this.isMockMode = false;
    this.lastAircraftValidation = null;
    this.activeAircraft = null;
    this._lastAircraftFetch = 0;
  }

  setActiveAircraft(aircraft) {
    this.activeAircraft = aircraft;
    this._lastAircraftFetch = Date.now();
  }

  setCallbacks({ onPhaseChange, onFlightCompleted }) {
    if (onPhaseChange) this.onPhaseChangeCallback = onPhaseChange;
    if (onFlightCompleted) this.onFlightCompletedCallback = onFlightCompleted;
  }

  async setActiveJob(job) {
    if (job) {
      const pilot = await Pilot.findOne().select('active_aircraft').lean();
      this.activeAircraft = pilot?.active_aircraft || null;
      this._lastAircraftFetch = Date.now();
      this.originAirport = job.origin_icao ? await Airport.findOne({ icao: job.origin_icao }) : null;
      this.destinationAirport = job.destination_icao ? await Airport.findOne({ icao: job.destination_icao }) : null;
      const rawJob = job.toObject ? job.toObject() : { ...job };
      this.activeJob = {
        ...rawJob,
        origin_airport: this.originAirport,
        destination_airport: this.destinationAirport
      };
      this.phase = FLIGHT_PHASES.IDLE;
      this.departedAt = rawJob.accepted_at ? new Date(rawJob.accepted_at) : null;
      this.touchdownAt = null;
      this.previousSimOnGround = true;
      this.activeFlightSeconds = 0;
      this.airborneSeconds = 0;
      this.pausedSeconds = 0;
      this.lastTelemetryTime = null;
      this.isPaused = false;
      this.touchdownFpm = null;
      this.landingRating = '';
      this.approachSpeedKts = null;
      this.landingClass = '';
      this.landingClassLabel = '';
      this.airborneSamples = [];
      const modeLabel = job.is_free_flight ? 'Free Flight session' : 'Active Job';
      console.log(`[StateMachine] ${modeLabel} loaded: ${job.origin_icao || 'Auto'} -> ${job.destination_icao || 'Open Roam'}, phase set to IDLE`);
    } else {
      this.activeJob = null;
      this.originAirport = null;
      this.destinationAirport = null;
      this.phase = FLIGHT_PHASES.STANDBY;
      this.activeFlightSeconds = 0;
      this.airborneSeconds = 0;
      this.pausedSeconds = 0;
      this.lastTelemetryTime = null;
      this.isPaused = false;
      this.touchdownFpm = null;
      this.landingRating = '';
      this.approachSpeedKts = null;
      this.landingClass = '';
      this.landingClassLabel = '';
      this.airborneSamples = [];
    }

    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback(this.phase, { job: this.activeJob });
    }
  }

  async clearActiveJob() {
    if (this.activeJob?.is_free_flight) {
      try {
        await Pilot.updateOne({}, { $set: { active_free_flight: null } });
      } catch (err) {
        console.warn('[StateMachine] Failed to clear active_free_flight from pilot:', err.message);
      }
    }
    this.activeJob = null;
    this.originAirport = null;
    this.destinationAirport = null;
    this.phase = FLIGHT_PHASES.STANDBY;
    this.activeFlightSeconds = 0;
    this.airborneSeconds = 0;
    this.pausedSeconds = 0;
    this.lastTelemetryTime = null;
    this.isPaused = false;
    this.touchdownFpm = null;
    this.landingRating = '';
    this.approachSpeedKts = null;
    this.landingClass = '';
    this.landingClassLabel = '';
    this.airborneSamples = [];
    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback(this.phase, null);
    }
  }

  /**
   * Forces state machine to a specific phase (used by simulation test controls)
   */
  async forceSetPhase(newPhase, telemetry = {}) {
    if (!this.activeJob) return { phase: this.phase, error: 'No active job' };

    this.phase = newPhase;

    if (newPhase === FLIGHT_PHASES.DEPARTED && !this.departedAt) {
      this.departedAt = new Date();
    } else if (newPhase === FLIGHT_PHASES.TOUCHDOWN && !this.touchdownAt) {
      this.touchdownAt = new Date();
      if (this.touchdownFpm == null) {
        this.touchdownFpm = telemetry.verticalSpeed != null && !isNaN(telemetry.verticalSpeed)
          ? Math.round(telemetry.verticalSpeed)
          : null;
        const landingRate = rateLandingTouchdown(this.touchdownFpm);
        this.landingRating = landingRate.rating;
        this.landingClass = landingRate.aircraftClass;
        this.landingClassLabel = landingRate.aircraftClassLabel;
      }
    } else if (newPhase === FLIGHT_PHASES.COMPLETED) {
      await this._handleFlightCompleted(telemetry);
    }

    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback(this.phase, {
        job: this.activeJob,
        telemetry
      });
    }

    return { phase: this.phase, activeJob: this.activeJob };
  }

  /**
   * Evaluates incoming telemetry against state machine rules
   * @param {object} telemetry
   * @param {number} telemetry.latitude Plane Latitude in degrees
   * @param {number} telemetry.longitude Plane Longitude in degrees
   * @param {number} telemetry.altitude Plane Altitude in feet
   * @param {boolean} telemetry.simOnGround True if wheels on ground
   * @param {number} telemetry.airspeedTrue True Airspeed in knots
   * @param {number} telemetry.groundSpeed Ground speed in knots
   * @param {boolean} telemetry.parkingBrake True if parking brake is set
   * @param {boolean} telemetry.engineRunning True if engine combustion is active
   */
  async processTelemetry(telemetry, options = {}) {
    const now = telemetry.timestamp || Date.now();
    const isTestEnv = process.env.NODE_ENV === 'test';
    // In production, cache activeAircraft in memory to avoid querying MongoDB Atlas on every simulator frame
    if (isTestEnv || !this.activeAircraft || (now - this._lastAircraftFetch > 5000)) {
      try {
        const pilot = await Pilot.findOne().select('active_aircraft').lean();
        if (pilot?.active_aircraft) {
          this.activeAircraft = pilot.active_aircraft;
        }
      } catch {
        // Retain existing activeAircraft in memory
      }
      this._lastAircraftFetch = now;
    }
    const activeAircraft = options.activeAircraft || this.activeAircraft;
    const isMockMode = Boolean(options.isMockMode);
    this.isMockMode = isMockMode;
    const isFreeFlight = Boolean(this.activeJob?.is_free_flight);
    const aircraftValidation = validateAircraftMatch(activeAircraft, telemetry, isMockMode);
    if (isFreeFlight) {
      aircraftValidation.matches = true;
      aircraftValidation.isFreeFlight = true;
      aircraftValidation.expectedAircraft = telemetry.simAircraftTitle || activeAircraft?.name || 'MSFS Aircraft';
    }
    this.lastAircraftValidation = aircraftValidation;

    if (!this.activeJob) {
      this.previousSimOnGround = telemetry.simOnGround;
      return { phase: this.phase, activeJob: null, aircraftValidation };
    }

    const {
      latitude,
      longitude,
      simOnGround,
      groundSpeed = telemetry.airspeedTrue || 0,
      parkingBrake = false,
      engineRunning = false
    } = telemetry;

    const isPaused = Boolean(telemetry.isPaused);
    this.isPaused = isPaused;

    // Record airborne samples for pre-touchdown flare rate detection
    if (!simOnGround && telemetry.verticalSpeed != null && !isNaN(telemetry.verticalSpeed)) {
      this.airborneSamples.push({
        time: now,
        vs: Math.round(telemetry.verticalSpeed),
        alt: Math.round(telemetry.altitude || 0),
        agl: Number.isFinite(telemetry.altAboveGround) ? Math.round(telemetry.altAboveGround) : null,
        tas: Number.isFinite(telemetry.airspeedTrue) ? Math.round(telemetry.airspeedTrue) : null,
        gs: Number.isFinite(telemetry.groundSpeed) ? Math.round(telemetry.groundSpeed) : null
      });
      if (this.airborneSamples.length > 50) {
        this.airborneSamples.shift();
      }
    }

    // Accumulate unpaused active flight time and airborne time
    const isFlightActive =
      this.phase === FLIGHT_PHASES.DEPARTED ||
      this.phase === FLIGHT_PHASES.EN_ROUTE ||
      this.phase === FLIGHT_PHASES.TOUCHDOWN;

    if (isFlightActive && this.lastTelemetryTime) {
      const dt = (now - this.lastTelemetryTime) / 1000;
      if (dt > 0) {
        if (isPaused || dt > 2.5) {
          // Simulator was paused, in ESC menu, or telemetry stalled
          this.pausedSeconds += dt;
        } else {
          // Active unpaused flight time
          this.activeFlightSeconds += dt;
          if (this.phase === FLIGHT_PHASES.DEPARTED || this.phase === FLIGHT_PHASES.EN_ROUTE) {
            this.airborneSeconds += dt;
          }
        }
      }
    }
    this.lastTelemetryTime = now;

    // Guard against uninitialized coordinates from simulator main menu (e.g. Null Island ~0, 0)
    const hasValidCoords =
      telemetry.hasValidLocation !== undefined
        ? Boolean(telemetry.hasValidLocation)
        : Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          !(Math.abs(latitude) < 0.05 && Math.abs(longitude) < 0.05);

    if (!hasValidCoords) {
      this.previousSimOnGround = simOnGround;
      return {
        phase: this.phase,
        activeJob: this.activeJob,
        aircraftValidation,
        originDist: null,
        destDist: null,
        flightSeconds: Math.round(this.activeFlightSeconds),
        airborneSeconds: Math.round(this.airborneSeconds),
        isPaused: this.isPaused,
        hasValidLocation: false
      };
    }

    let originDist = 99999;
    let destDist = 99999;

    if (this.originAirport?.location?.coordinates) {
      const [oLon, oLat] = this.originAirport.location.coordinates;
      originDist = calculateDistanceNm(latitude, longitude, oLat, oLon);
    }

    if (this.destinationAirport?.location?.coordinates) {
      const [dLon, dLat] = this.destinationAirport.location.coordinates;
      destDist = calculateDistanceNm(latitude, longitude, dLat, dLon);
    }

    const oldPhase = this.phase;

    // STATE TRANSITIONS
    switch (this.phase) {
      case FLIGHT_PHASES.STANDBY:
        // Transition to IDLE if job is present
        this.phase = FLIGHT_PHASES.IDLE;
        break;

      case FLIGHT_PHASES.IDLE:
        // Free Flight auto-detect: automatically update origin airport while on the ground if user spawned at a new airport
        if (isFreeFlight && simOnGround) {
          if (!this.originAirport || originDist > 5.0) {
            try {
              const nearest = await Airport.findOne({
                location: {
                  $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                    $maxDistance: 35000
                  }
                }
              });
              if (nearest && nearest.icao !== this.activeJob.origin_icao) {
                this.originAirport = nearest;
                this.activeJob.origin_icao = nearest.icao;
                this.activeJob.origin_airport = nearest;
                const [oLon, oLat] = nearest.location.coordinates;
                originDist = calculateDistanceNm(latitude, longitude, oLat, oLon);
                console.log(`[StateMachine] Free Flight origin auto-detected: ${nearest.icao} (${nearest.name})`);

                try {
                  await Pilot.updateOne(
                    {},
                    { $set: { 'active_free_flight.origin_icao': nearest.icao } }
                  );
                } catch {}

                if (this.onPhaseChangeCallback) {
                  this.onPhaseChangeCallback(this.phase, { job: this.activeJob });
                }
              }
            } catch (err) {
              console.warn('[StateMachine] Free flight origin auto-detect note:', err.message);
            }
          }
        }

        // Recovery 1: If aircraft is already airborne mid-flight (e.g. server restart or reconnection en route)
        if (!simOnGround && originDist > 5.0) {
          this.phase = FLIGHT_PHASES.EN_ROUTE;
          this.departedAt = this.departedAt || new Date(now - 30 * 60 * 1000);
          console.log(`[StateMachine] RECOVERY: Aircraft already airborne (${originDist.toFixed(1)} NM from origin, ${destDist.toFixed(1)} NM to dest). Transitioning to EN ROUTE.`);
          break;
        }

        // Recovery 2: If aircraft already arrived at destination on the ground (destDist <= 3.5 NM and originDist > 10.0 NM)
        if (simOnGround && destDist <= 3.5 && originDist > 10.0) {
          console.log(`[StateMachine] RECOVERY: Aircraft arrived at destination (${destDist.toFixed(1)} NM from ${this.activeJob.destination_icao}). Transitioning to TOUCHDOWN.`);
          this.phase = FLIGHT_PHASES.TOUCHDOWN;
          this.touchdownAt = this.touchdownAt || new Date();
          const acceptedTime = this.activeJob.accepted_at ? new Date(this.activeJob.accepted_at) : null;
          this.departedAt = this.departedAt || acceptedTime || new Date(now - 45 * 60 * 1000);
          this.touchdownFpm = this.touchdownFpm || -130;
          this.landingRating = this.landingRating || 'Butter';
          this.landingClass = this.landingClass || 'Jet';
          this.landingClassLabel = this.landingClassLabel || 'Airliner / Jet';

          const isStopped = groundSpeed < 5.0;
          const isSecured = parkingBrake || !engineRunning;
          if (isStopped && isSecured) {
            this.phase = FLIGHT_PHASES.COMPLETED;
            console.log('[StateMachine] COMPLETED: Aircraft stopped and secured at destination (recovered arrival)');
            await this._handleFlightCompleted(telemetry);
          }
          break;
        }

        // DEPARTED: SIM ON GROUND changes from true to false within 5 NM of origin
        // Must be genuinely airborne (not a gear bounce at 0 knots or ground taxiing!)
        const hasSpeedOrAgl = (telemetry.groundSpeed !== undefined) || (telemetry.airspeedTrue !== undefined) || (telemetry.altAboveGround !== undefined);
        const isAirborneSpeed = (groundSpeed >= 35.0) || (telemetry.airspeedTrue >= 35.0);
        const isAboveGround = (telemetry.altAboveGround != null && telemetry.altAboveGround >= 10);
        const isGenuinelyAirborne = !simOnGround && (!hasSpeedOrAgl || isAirborneSpeed || isAboveGround);

        if (this.previousSimOnGround && isGenuinelyAirborne && (originDist <= 5.0 || isFreeFlight)) {
          if (isFreeFlight && (!this.originAirport || originDist > 5.0)) {
            try {
              const nearest = await Airport.findOne({
                location: {
                  $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                    $maxDistance: 35000
                  }
                }
              });
              if (nearest) {
                this.originAirport = nearest;
                this.activeJob.origin_icao = nearest.icao;
                this.activeJob.origin_airport = nearest;
                const [oLon, oLat] = nearest.location.coordinates;
                originDist = calculateDistanceNm(latitude, longitude, oLat, oLon);
              }
            } catch (err) {
              console.warn('[StateMachine] Dynamic origin lookup note:', err.message);
            }
          }

          if (!aircraftValidation.matches) {
            console.warn(
              `[StateMachine] Takeoff BLOCKED: Airframe mismatch! Contract requires "${aircraftValidation.expectedAircraft}", but MSFS is flying "${aircraftValidation.simAircraftTitle}".`
            );
            // Block departure: stay in IDLE until correct aircraft is flown!
          } else {
            this.phase = FLIGHT_PHASES.DEPARTED;
            this.departedAt = new Date();
            this.lastTelemetryTime = now;
            console.log(`[StateMachine] DEPARTED: Took off in ${isFreeFlight ? 'Free Flight' : 'verified aircraft'} within ${originDist.toFixed(1)} NM of origin (${this.activeJob.origin_icao || 'Airfield'})`);
          }
        }
        break;

      case FLIGHT_PHASES.DEPARTED:
        // If aircraft is back on the ground at origin airfield (aborted takeoff, taxiing, rollout)
        if (simOnGround && originDist <= 3.5 && (destDist > 10.0 || !this.destinationAirport)) {
          console.log(`[StateMachine] On ground at origin (${originDist.toFixed(1)} NM). Reverting to IDLE.`);
          this.phase = FLIGHT_PHASES.IDLE;
          this.departedAt = null;
          break;
        }

        // EN ROUTE: Airborne tracking mode once safely climbing / moving away
        if (!simOnGround) {
          // If past 3 NM from origin or climbing above 800 ft AGL, transition to EN ROUTE
          const agl = Number.isFinite(telemetry.altAboveGround) ? telemetry.altAboveGround : null;
          const originElevation = this.originAirport?.elevation_ft || 0;
          const heightAboveOrigin = telemetry.altitude - originElevation;
          const isClimbingOut = (agl !== null && agl > 800) || heightAboveOrigin > 800;

          if (originDist > 3.0 || isClimbingOut) {
            this.phase = FLIGHT_PHASES.EN_ROUTE;
            console.log('[StateMachine] EN ROUTE: Airborne tracking mode active');
          }
        } else if (simOnGround && this.destinationAirport && destDist <= 3.5 && originDist > 1.0) {
          // Short hop / circuit touchdown directly from DEPARTED
          await this._handleTouchdown(telemetry, destDist, now);
        }
        break;

      case FLIGHT_PHASES.EN_ROUTE:
        // If aircraft landed back at the origin airport or is on the ground near origin
        if (simOnGround && originDist <= 3.5 && (destDist > 10.0 || !this.destinationAirport)) {
          console.log(`[StateMachine] Aircraft on ground at origin airfield (${originDist.toFixed(1)} NM). Reverting to IDLE.`);
          this.phase = FLIGHT_PHASES.IDLE;
          this.departedAt = null;
          break;
        }

        // TOUCHDOWN: SIM ON GROUND changes from false to true within 3.5 NM of destination ICAO
        // Or if wheels are on the ground in the destination airport area
        if (this.destinationAirport) {
          if (simOnGround && destDist <= 3.5) {
            await this._handleTouchdown(telemetry, destDist, now);
          }
        } else if (isFreeFlight) {
          // Open Roam mode: touchdown detected when on ground and moved away from origin (or in flight > 30s)
          if (simOnGround && (originDist > 1.0 || this.airborneSeconds >= 30)) {
            // Find destination airfield near touchdown point
            try {
              const nearestDest = await Airport.findOne({
                location: {
                  $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                    $maxDistance: 35000
                  }
                }
              });
              if (nearestDest) {
                this.destinationAirport = nearestDest;
                this.activeJob.destination_icao = nearestDest.icao;
                this.activeJob.destination_airport = nearestDest;
                const [dLon, dLat] = nearestDest.location.coordinates;
                destDist = calculateDistanceNm(latitude, longitude, dLat, dLon);
              } else {
                this.activeJob.destination_icao = this.activeJob.origin_icao || 'UNKN';
                destDist = 0;
              }
            } catch (err) {
              console.warn('[StateMachine] Failed to find landing airport:', err.message);
              this.activeJob.destination_icao = this.activeJob.origin_icao || 'UNKN';
              destDist = 0;
            }
            await this._handleTouchdown(telemetry, destDist, now);
          }
        }
        break;

      case FLIGHT_PHASES.TOUCHDOWN:
        // COMPLETED: Ground speed is below 5 knots AND (Parking Brake is engaged OR engines are shut down)
        const isStopped = groundSpeed < 5.0;
        const isSecured = parkingBrake || !engineRunning;

        if (isStopped && isSecured) {
          this.phase = FLIGHT_PHASES.COMPLETED;
          console.log('[StateMachine] COMPLETED: Aircraft stopped and secured at destination');
          await this._handleFlightCompleted(telemetry);
        }
        break;

      case FLIGHT_PHASES.COMPLETED:
        // Stays completed until user accepts a new job or resets
        break;
    }

    this.previousSimOnGround = simOnGround;

    if (oldPhase !== this.phase && this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback(this.phase, {
        job: this.activeJob,
        originDist,
        destDist,
        aircraftValidation,
        flightSeconds: Math.round(this.activeFlightSeconds),
        airborneSeconds: Math.round(this.airborneSeconds),
        isPaused: this.isPaused,
        telemetry
      });
    }

    return {
      phase: this.phase,
      activeJob: this.activeJob,
      originDist,
      destDist,
      aircraftValidation,
      flightSeconds: Math.round(this.activeFlightSeconds),
      airborneSeconds: Math.round(this.airborneSeconds),
      pausedSeconds: Math.round(this.pausedSeconds),
      isPaused: this.isPaused
    };
  }

  /**
   * Evaluates the landing flare descent rate immediately before wheel contact.
   * Prevents touchdown FPM from collapsing to 0 due to post-touchdown wheel compression.
   */
  _determineTouchdownFpm(telemetry, now) {
    const instantVs = telemetry.verticalSpeed != null && !isNaN(telemetry.verticalSpeed)
      ? Math.round(telemetry.verticalSpeed)
      : null;

    if (this.isMockMode) {
      return instantVs !== null ? instantVs : -140;
    }

    // Filter airborne samples from the final 1.5 seconds leading to touchdown
    const recent = this.airborneSamples.filter((s) => now - s.time <= 1500);

    if (recent.length > 0) {
      // Find descending samples (negative VS) right before touchdown
      const descending = recent.filter((s) => s.vs < 0);
      if (descending.length > 0) {
        // Take the last up to 5 descending samples in the flare
        const flare = descending.slice(-5);
        const sum = flare.reduce((acc, s) => acc + s.vs, 0);
        const flareAvg = Math.round(sum / flare.length);

        // If instantaneous VS is already a solid descent (<= -50), take the more negative
        // or if instantaneous already decayed toward 0 upon wheel contact (instantVs > -50),
        // use the true pre-touchdown flare descent rate
        if (instantVs !== null && instantVs <= -50) {
          return Math.min(instantVs, flareAvg);
        }
        return flareAvg;
      }

      // If no negative samples found (e.g. float/balloon), use last recorded airborne sample
      const lastAirborne = recent[recent.length - 1];
      if (lastAirborne && lastAirborne.vs !== 0) {
        return lastAirborne.vs;
      }
    }

    return instantVs;
  }

  _determineApproachSpeed(now) {
    const recent = this.airborneSamples.filter((s) => now - s.time <= 3500);
    if (recent.length > 0) {
      const speeds = recent.map((s) => s.tas || s.gs).filter((s) => s != null && s > 25);
      if (speeds.length > 0) {
        const sum = speeds.reduce((acc, v) => acc + v, 0);
        return Math.round(sum / speeds.length);
      }
    }
    return null;
  }

  async _handleTouchdown(telemetry, destDist, now) {
    this.phase = FLIGHT_PHASES.TOUCHDOWN;
    this.touchdownAt = new Date();
    this.touchdownFpm = this._determineTouchdownFpm(telemetry, now);
    this.approachSpeedKts = this._determineApproachSpeed(now);

    const activeAircraft = this.activeAircraft || (await Pilot.findOne().select('active_aircraft').lean())?.active_aircraft || null;

    const landingRate = rateLandingTouchdown(this.touchdownFpm, {
      category: activeAircraft?.category,
      aircraftName: activeAircraft?.name || telemetry.simAircraftTitle,
      approachKts: this.approachSpeedKts
    });

    this.landingRating = landingRate.rating;
    this.landingClass = landingRate.aircraftClass;
    this.landingClassLabel = landingRate.aircraftClassLabel;

    console.log(
      `[StateMachine] TOUCHDOWN: Touched down at ${this.touchdownFpm !== null ? this.touchdownFpm + ' FPM' : 'normal'} (${landingRate.label} [${landingRate.aircraftClassLabel}]) within ${destDist.toFixed(1)} NM of destination`
    );
  }

  /**
   * Handles completion and persistence of job and pilot statistics
   */
  async _handleFlightCompleted(telemetry) {
    if (!this.activeJob) return;

    try {
      const result = await settleCompletedFlight({
        job: this.activeJob,
        telemetry,
        touchdownFpm: this.touchdownFpm,
        approachSpeedKts: this.approachSpeedKts,
        flightSeconds: this.activeFlightSeconds,
        airborneSeconds: this.airborneSeconds,
        departedAt: this.departedAt,
        touchdownAt: this.touchdownAt,
        originAirport: this.originAirport,
        destinationAirport: this.destinationAirport
      });

      if (this.onFlightCompletedCallback) {
        this.onFlightCompletedCallback(result);
      }

      // Conclude active contract upon successful flight completion
      this.activeJob = null;
      this.originAirport = null;
      this.destinationAirport = null;
    } catch (err) {
      console.error('[StateMachine] Error persisting flight completion:', err);
    }
  }
}

export const flightStateMachine = new FlightStateMachine();
export default flightStateMachine;

