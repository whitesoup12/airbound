import mongoose from 'mongoose';

const FlightRecordSchema = new mongoose.Schema(
  {
    job_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job'
    },
    origin_icao: {
      type: String,
      required: true,
      uppercase: true
    },
    destination_icao: {
      type: String,
      required: true,
      uppercase: true
    },
    distance_nm: {
      type: Number,
      required: true
    },
    cargo_lbs: {
      type: Number,
      default: 0
    },
    pax_count: {
      type: Number,
      default: 0
    },
    payout: {
      type: Number,
      default: 0
    },
    // Financial operating expenses
    gross_payout: {
      type: Number,
      default: 0
    },
    fuel_cost: {
      type: Number,
      default: 0
    },
    fuel_gallons: {
      type: Number,
      default: 0
    },
    landing_fee: {
      type: Number,
      default: 0
    },
    net_payout: {
      type: Number,
      default: 0
    },
    exploration_bonus: {
      type: Number,
      default: 0
    },
    rental_fee: {
      type: Number,
      default: 0
    },
    rent_to_own_equity_earned: {
      type: Number,
      default: 0
    },
    aircraft_name: {
      type: String,
      default: 'Cessna 172 Skyhawk'
    },
    duration_seconds: {
      type: Number,
      default: 0
    },
    airborne_seconds: {
      type: Number,
      default: 0
    },
    departed_at: {
      type: Date
    },
    completed_at: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['airbound_dispatch', 'msfs_import'],
      enum: ['airbound_dispatch', 'msfs_import', 'free_flight'],
      default: 'airbound_dispatch'
    },
    is_external: {
      type: Boolean,
      default: false
    },
    external_flight_number: {
      type: Number
    },
    xp_earned: {
      type: Number,
      default: 0
    },
    touchdown_fpm: {
      type: Number,
      default: null
    },
    landing_rating: {
      type: String,
      default: ''
    },
    landing_class: {
      type: String,
      default: ''
    },
    approach_speed_kts: {
      type: Number,
      default: null
    },
    category: {
      type: String,
      default: ''
    }
  },
  { _id: true }
);

const OwnedAircraftSchema = new mongoose.Schema(
  {
    aircraft_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Aircraft'
    },
    model_id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    tail_number: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'single_prop'
    },
    is_rental: {
      type: Boolean,
      default: false
    },
    rental_price_per_flight: {
      type: Number,
      default: 0
    },
    rental_flights_paid: {
      type: Number,
      default: 0
    },
    accumulated_equity: {
      type: Number,
      default: 0
    },
    is_loaner: {
      type: Boolean,
      default: false
    },
    purchased_at: {
      type: Date,
      default: Date.now
    },
    flight_hours: {
      type: Number,
      default: 0
    }
  },
  { _id: true }
);

const PilotSchema = new mongoose.Schema(
  {
    callsign: {
      type: String,
      default: 'James',
      trim: true
    },
    balance: {
      type: Number,
      default: 15000,
      min: 0
    },
    rent_to_own_equity: {
      type: Object,
      default: {}
    },
    current_icao: {
      type: String,
      default: 'KLAX',
      uppercase: true,
      trim: true
    },
    visited_airports: {
      type: [String],
      default: ['KLAX']
    },
    visited_countries: {
      type: [String],
      default: ['US']
    },
    xp: {
      type: Number,
      default: 0,
      min: 0
    },
    level: {
      type: Number,
      default: 1,
      min: 1
    },
    rank_title: {
      type: String,
      default: 'Junior Aviator'
    },
    // Active flying aircraft
    active_aircraft: {
      model_id: { type: String, default: 'c172' },
      name: { type: String, default: 'Cessna 172 Skyhawk' },
      tail_number: { type: String, default: 'N172AB' },
      category: { type: String, default: 'single_prop' },
      is_rental: { type: Boolean, default: false },
      rental_price_per_flight: { type: Number, default: 0 },
      rental_flights_paid: { type: Number, default: 0 },
      accumulated_equity: { type: Number, default: 0 },
      flight_hours: { type: Number, default: 0 },
      is_loaner: { type: Boolean, default: false },
      cruise_speed_kts: { type: Number, default: 120 },
      max_range_nm: { type: Number, default: 500 },
      max_cargo_lbs: { type: Number, default: 500 },
      max_pax: { type: Number, default: 3 },
      min_runway_ft: { type: Number, default: 1600 },
      fuel_type: { type: String, default: '100LL' },
      fuel_burn_gph: { type: Number, default: 9.0 }
    },
    fleet: {
      type: [OwnedAircraftSchema],
      default: [
        {
          model_id: 'c172',
          name: 'Cessna 172 Skyhawk',
          tail_number: 'N172AB',
          category: 'single_prop',
          is_rental: false,
          purchased_at: new Date(),
          flight_hours: 0
        }
      ]
    },
    flight_log: {
      type: [FlightRecordSchema],
      default: []
    },
    active_free_flight: {
      origin_icao: { type: String, uppercase: true },
      destination_icao: { type: String, uppercase: true, default: null },
      deduct_fees: { type: Boolean, default: false },
      departed_at: { type: Date, default: null },
      created_at: { type: Date, default: Date.now },
      active: { type: Boolean, default: false }
    },
    active_telemetry: {
      telemetry: { type: Object, default: null },
      phase: { type: String, default: 'STANDBY' },
      originDist: { type: Number, default: null },
      destDist: { type: Number, default: null },
      aircraftValidation: { type: Object, default: null },
      flightSeconds: { type: Number, default: 0 },
      airborneSeconds: { type: Number, default: 0 },
      isPaused: { type: Boolean, default: false },
      connected: { type: Boolean, default: false },
      isMock: { type: Boolean, default: false },
      app: { type: String, default: null },
      touchdownFpm: { type: Number, default: null },
      approachSpeedKts: { type: Number, default: null },
      landingRating: { type: String, default: '' },
      completedFlight: { type: Object, default: null },
      lastSeen: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

export const Pilot = mongoose.model('Pilot', PilotSchema);
export default Pilot;
