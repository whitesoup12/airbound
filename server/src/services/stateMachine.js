import { calculateDistanceNm } from './geoUtils.js';
import Airport from '../models/Airport.js';
import Job from '../models/Job.js';
import Pilot from '../models/Pilot.js';
import { generateJobsForAirport } from './jobGenerator.js';
import { computeFlightSettlement } from './economyService.js';
import { validateAircraftMatch } from '../utils/aircraftValidator.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';

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
  }

  setCallbacks({ onPhaseChange, onFlightCompleted }) {
    if (onPhaseChange) this.onPhaseChangeCallback = onPhaseChange;
    if (onFlightCompleted) this.onFlightCompletedCallback = onFlightCompleted;
  }

  async setActiveJob(job) {
    if (job) {
      this.originAirport = await Airport.findOne({ icao: job.origin_icao });
      this.destinationAirport = await Airport.findOne({ icao: job.destination_icao });
      const rawJob = job.toObject ? job.toObject() : { ...job };
      this.activeJob = {
        ...rawJob,
        origin_airport: this.originAirport,
        destination_airport: this.destinationAirport
      };
      this.phase = FLIGHT_PHASES.IDLE;
      this.departedAt = null;
      this.touchdownAt = null;
      this.previousSimOnGround = true;
      this.activeFlightSeconds = 0;
      this.airborneSeconds = 0;
      this.pausedSeconds = 0;
      this.lastTelemetryTime = null;
      this.isPaused = false;
      console.log(`[StateMachine] Active Job loaded: ${job.origin_icao} -> ${job.destination_icao}, phase set to IDLE`);
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
    }

    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback(this.phase, { job: this.activeJob });
    }
  }

  async clearActiveJob() {
    this.activeJob = null;
    this.originAirport = null;
    this.destinationAirport = null;
    this.phase = FLIGHT_PHASES.STANDBY;
    this.activeFlightSeconds = 0;
    this.airborneSeconds = 0;
    this.pausedSeconds = 0;
    this.lastTelemetryTime = null;
    this.isPaused = false;
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
    const pilot = await Pilot.findOne();
    const activeAircraft = pilot?.active_aircraft || null;
    const isMockMode = Boolean(options.isMockMode);
    const aircraftValidation = validateAircraftMatch(activeAircraft, telemetry, isMockMode);

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

    const now = telemetry.timestamp || Date.now();
    const isPaused = Boolean(telemetry.isPaused);
    this.isPaused = isPaused;

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
        // DEPARTED: SIM ON GROUND changes from true to false within 5 NM of origin
        if (this.previousSimOnGround && !simOnGround && originDist <= 5.0) {
          if (!aircraftValidation.matches) {
            console.warn(
              `[StateMachine] Takeoff BLOCKED: Airframe mismatch! Contract requires "${aircraftValidation.expectedAircraft}", but MSFS is flying "${aircraftValidation.simAircraftTitle}".`
            );
            // Block departure: stay in IDLE until correct aircraft is flown!
          } else {
            this.phase = FLIGHT_PHASES.DEPARTED;
            this.departedAt = new Date();
            this.lastTelemetryTime = now;
            console.log(`[StateMachine] DEPARTED: Took off in verified aircraft within ${originDist.toFixed(1)} NM of origin`);
          }
        }
        break;

      case FLIGHT_PHASES.DEPARTED:
        // EN ROUTE: Airborne tracking mode once safely climbing / moving away
        if (!simOnGround) {
          // If past 2 NM from origin or climbing above 500 ft AGL, transition to EN ROUTE
          if (originDist > 2.0 || telemetry.altitude > 1000) {
            this.phase = FLIGHT_PHASES.EN_ROUTE;
            console.log('[StateMachine] EN ROUTE: Airborne tracking mode active');
          }
        }
        break;

      case FLIGHT_PHASES.EN_ROUTE:
        // TOUCHDOWN: SIM ON GROUND changes from false to true within 3 NM of destination ICAO
        if (!this.previousSimOnGround && simOnGround && destDist <= 3.0) {
          this.phase = FLIGHT_PHASES.TOUCHDOWN;
          this.touchdownAt = new Date();
          console.log(`[StateMachine] TOUCHDOWN: Touched down within ${destDist.toFixed(1)} NM of destination`);
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
   * Handles completion and persistence of job and pilot statistics
   */
  async _handleFlightCompleted(telemetry) {
    if (!this.activeJob) return;

    try {
      const completedAt = new Date();
      const departedAt = this.departedAt || new Date(completedAt.getTime() - 15 * 60 * 1000);

      // Raw wall-clock fallback if telemetry stream was not polled at 1Hz (e.g. instant unit tests)
      const rawWallClockSeconds = Math.max(1, Math.round((completedAt.getTime() - departedAt.getTime()) / 1000));

      // Active pause-free flight duration (takeoff to engine shutdown/parking)
      const durationSeconds = this.activeFlightSeconds >= 1
        ? Math.max(1, Math.round(this.activeFlightSeconds))
        : rawWallClockSeconds;

      // Pure airborne duration (takeoff to touchdown, pause-free)
      const airborneSeconds = this.airborneSeconds >= 1
        ? Math.max(1, Math.round(this.airborneSeconds))
        : (this.touchdownAt && this.departedAt
            ? Math.max(1, Math.round((this.touchdownAt.getTime() - this.departedAt.getTime()) / 1000))
            : durationSeconds);

      const durationHours = Math.round((durationSeconds / 3600) * 10) / 10;

      const destCountry = this.destinationAirport?.country || 'US';
      const destIcao = (await normalizeTo4CharIcao(this.activeJob.destination_icao)) || this.activeJob.destination_icao;
      const destRunwayFt = this.destinationAirport?.longest_runway_ft || 5000;

      // Fetch pilot and active aircraft specs for settlement
      const pilot = await Pilot.findOne();
      const activeAircraft = pilot?.active_aircraft || {
        name: 'Cessna 172 Skyhawk',
        fuel_burn_gph: 9.0,
        fuel_type: '100LL'
      };

      // Calculate economic settlement: Gross - Fuel - Landing Fee = Net Payout
      const settlement = computeFlightSettlement({
        grossPayout: this.activeJob.payout,
        durationSeconds,
        fuelBurnGph: activeAircraft.fuel_burn_gph || 9.0,
        fuelType: activeAircraft.fuel_type || '100LL',
        destRunwayFt,
        aircraftName: activeAircraft.name || 'Cessna 172 Skyhawk'
      });

      // 1. Update Job status to 'completed'
      await Job.findByIdAndUpdate(this.activeJob._id, {
        status: 'completed',
        completed_at: completedAt
      });

      // 2. Flight summary for logbook with detailed financial ledger
      const flightSummary = {
        job_id: this.activeJob._id,
        origin_icao: this.activeJob.origin_icao,
        destination_icao: destIcao,
        distance_nm: this.activeJob.distance_nm,
        cargo_lbs: this.activeJob.cargo_lbs,
        pax_count: this.activeJob.pax_count,
        payout: settlement.netPayout, // Persisted reward
        gross_payout: settlement.grossPayout,
        fuel_cost: settlement.fuelCost,
        fuel_gallons: settlement.fuelGallons,
        landing_fee: settlement.landingFee,
        net_payout: settlement.netPayout,
        aircraft_name: settlement.aircraftName,
        duration_seconds: durationSeconds,
        airborne_seconds: airborneSeconds,
        departed_at: departedAt,
        completed_at: completedAt
      };

      // 3. Update Pilot persistence:
      // Increment pilot.balance by the net payout
      // Set pilot.current_icao to destination airport
      // Append destination ICAO and country code using $addToSet (preventing duplicates)
      // Append flight summary to flight_log
      let insufficientRentalFunds = false;
      let rentalPrice = 0;

      if (pilot) {
        // Increment flight hours for the flown aircraft in pilot's fleet if matching
        let fleetPlane = null;
        if (pilot.fleet && pilot.fleet.length > 0 && activeAircraft.tail_number) {
          fleetPlane = pilot.fleet.find((p) => p.tail_number === activeAircraft.tail_number);
          if (fleetPlane) {
            fleetPlane.flight_hours = Math.round(((fleetPlane.flight_hours || 0) + durationHours) * 10) / 10;
          }
        }

        // If flown aircraft is a rental, reset prepaid flight status so the next flight requires renewal fee
        if (activeAircraft.is_rental && !activeAircraft.is_loaner) {
          if (pilot.active_aircraft) {
            pilot.active_aircraft.rental_flights_paid = 0;
          }
          if (fleetPlane) {
            fleetPlane.rental_flights_paid = 0;
          }
        }

        pilot.balance = Math.max(0, (pilot.balance || 0) + settlement.netPayout);
        pilot.current_icao = destIcao;
        if (!pilot.visited_airports.includes(destIcao)) {
          pilot.visited_airports.push(destIcao);
        }
        if (destCountry && !pilot.visited_countries.includes(destCountry)) {
          pilot.visited_countries.push(destCountry);
        }
        pilot.flight_log.push(flightSummary);

        // Check if balance after settlement is insufficient for another flight with this rental
        if (activeAircraft.is_rental && !activeAircraft.is_loaner) {
          rentalPrice = activeAircraft.rental_price_per_flight || 0;
          if (pilot.balance < rentalPrice) {
            insufficientRentalFunds = true;
          }
        }

        await pilot.save();
      }

      console.log(
        `[StateMachine] Flight completed! Gross: $${settlement.grossPayout}, Fuel: -$${settlement.fuelCost} (${settlement.fuelGallons} gal), Landing Fee: -$${settlement.landingFee}. Net credited: +$${settlement.netPayout}`
      );

      // 4. Auto-generate new jobs for the new location scaled to the active aircraft
      await generateJobsForAirport(destIcao, { aircraft: pilot?.active_aircraft });

      if (this.onFlightCompletedCallback) {
        this.onFlightCompletedCallback({
          summary: flightSummary,
          payout: settlement.netPayout,
          settlement,
          newIcao: destIcao,
          insufficientRentalFunds,
          rentalPrice,
          aircraftName: activeAircraft.name
        });
      }
    } catch (err) {
      console.error('[StateMachine] Error persisting flight completion:', err);
    }
  }
}

export const flightStateMachine = new FlightStateMachine();
export default flightStateMachine;

