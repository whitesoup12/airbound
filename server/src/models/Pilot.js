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
      required: true
    },
    duration_seconds: {
      type: Number,
      default: 0
    },
    departed_at: {
      type: Date
    },
    completed_at: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const PilotSchema = new mongoose.Schema(
  {
    callsign: {
      type: String,
      default: 'Airbound-1',
      trim: true
    },
    balance: {
      type: Number,
      default: 15000,
      min: 0
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
    flight_log: {
      type: [FlightRecordSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const Pilot = mongoose.model('Pilot', PilotSchema);
export default Pilot;
