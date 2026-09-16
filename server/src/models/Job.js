import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema(
  {
    origin_icao: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    destination_icao: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    distance_nm: {
      type: Number,
      required: true,
      min: 0
    },
    cargo_lbs: {
      type: Number,
      default: 0,
      min: 0
    },
    pax_count: {
      type: Number,
      default: 0,
      min: 0
    },
    payout: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['available', 'accepted', 'completed', 'failed'],
      default: 'available',
      index: true
    },
    accepted_at: {
      type: Date
    },
    completed_at: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export const Job = mongoose.model('Job', JobSchema);
export default Job;

