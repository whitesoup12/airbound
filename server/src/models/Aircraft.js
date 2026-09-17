import mongoose from 'mongoose';

const AircraftSchema = new mongoose.Schema(
  {
    model_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    manufacturer: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      enum: ['single_prop', 'turboprop', 'jet', 'airliner'],
      default: 'single_prop'
    },
    purchase_price: {
      type: Number,
      required: true,
      min: 0
    },
    rental_price_per_flight: {
      type: Number,
      required: true,
      min: 0
    },
    cruise_speed_kts: {
      type: Number,
      required: true,
      min: 50
    },
    max_range_nm: {
      type: Number,
      required: true,
      min: 100
    },
    max_cargo_lbs: {
      type: Number,
      required: true,
      min: 100
    },
    max_pax: {
      type: Number,
      required: true,
      min: 1
    },
    min_runway_ft: {
      type: Number,
      required: true,
      min: 500
    },
    fuel_type: {
      type: String,
      enum: ['100LL', 'Jet-A'],
      default: '100LL'
    },
    fuel_burn_gph: {
      type: Number,
      required: true,
      min: 1
    },
    description: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export const Aircraft = mongoose.model('Aircraft', AircraftSchema);
export default Aircraft;

