import { calculateDistanceNm } from './geoUtils.js';
import Airport from '../models/Airport.js';
import Job from '../models/Job.js';
import Pilot from '../models/Pilot.js';
import { generateJobsForAirport } from './jobGenerator.js';

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
  }

  setCallbacks({ onPhaseChange, onFlightCompleted }) {
    if (onPhaseChange) this.onPhaseChangeCallback = onPhaseChange;
    if (onFlightCompleted) this.onFlightCompletedCallback = onFlightCompleted;
  }

  async setActiveJob(job) {
    this.activeJob = job;
    if (job) {
      this.originAirport = await Airport.findOne({ icao: job.origin_icao });
      this.destinationAirport = await Airport.findOne({ icao: job.destination_icao });
      this.phase = FLIGHT_PHASES.IDLE;
      this.departedAt = null;
      this.touchdownAt = null;
      this.previousSimOnGround = true;
      console.log(`[StateMachine] Active Job loaded: ${job.origin_icao} -> ${job.destination_icao}, phase set to IDLE`);
    } else {
      this.originAirport = null;
      this.destinationAirport = null;
      this.phase = FLIGHT_PHASES.STANDBY;
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
    if (this.onPhaseChangeCallback) {
      this.onPhaseChangeCallback(this.phase, null);
    }
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
  async processTelemetry(telemetry) {
    if (!this.activeJob) {
      this.previousSimOnGround = telemetry.simOnGround;
      return { phase: this.phase, activeJob: null };
    }

    const {
      latitude,
      longitude,
      simOnGround,
      groundSpeed = telemetry.airspeedTrue || 0,
      parkingBrake = false,
      engineRunning = false
    } = telemetry;

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
          this.phase = FLIGHT_PHASES.DEPARTED;
          this.departedAt = new Date();
          console.log(`[StateMachine] DEPARTED: Took off within ${originDist.toFixed(1)} NM of origin`);
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
        telemetry
      });
    }

    return {
      phase: this.phase,
      activeJob: this.activeJob,
      originDist,
      destDist
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
      const durationSeconds = Math.max(1, Math.round((completedAt.getTime() - departedAt.getTime()) / 1000));

      const destCountry = this.destinationAirport?.country || 'US';
      const destIcao = this.activeJob.destination_icao;

      // 1. Update Job status to 'completed'
      await Job.findByIdAndUpdate(this.activeJob._id, {
        status: 'completed',
        completed_at: completedAt
      });

      // 2. Flight summary for logbook
      const flightSummary = {
        job_id: this.activeJob._id,
        origin_icao: this.activeJob.origin_icao,
        destination_icao: destIcao,
        distance_nm: this.activeJob.distance_nm,
        cargo_lbs: this.activeJob.cargo_lbs,
        pax_count: this.activeJob.pax_count,
        payout: this.activeJob.payout,
        duration_seconds: durationSeconds,
        departed_at: departedAt,
        completed_at: completedAt
      };

      // 3. Update Pilot persistence:
      // Increment pilot.balance by the job payout
      // Set pilot.current_icao to destination airport
      // Append destination ICAO and country code using $addToSet (preventing duplicates)
      // Append flight summary to flight_log
      const pilot = await Pilot.findOne();
      if (pilot) {
        await Pilot.findByIdAndUpdate(pilot._id, {
          $inc: { balance: this.activeJob.payout },
          $set: { current_icao: destIcao },
          $addToSet: {
            visited_airports: destIcao,
            visited_countries: destCountry
          },
          $push: {
            flight_log: flightSummary
          }
        });
      }

      console.log(`[StateMachine] Flight successfully persisted. Pilot credited +$${this.activeJob.payout}.`);

      // 4. Auto-generate new jobs for the new location!
      await generateJobsForAirport(destIcao);

      if (this.onFlightCompletedCallback) {
        this.onFlightCompletedCallback({
          summary: flightSummary,
          payout: this.activeJob.payout,
          newIcao: destIcao
        });
      }
    } catch (err) {
      console.error('[StateMachine] Error persisting flight completion:', err);
    }
  }
}

export const flightStateMachine = new FlightStateMachine();
export default flightStateMachine;
