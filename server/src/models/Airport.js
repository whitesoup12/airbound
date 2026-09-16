import mongoose from 'mongoose';

const AirportSchema = new mongoose.Schema(
  {
    icao: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      default: '',
      trim: true
    },
    country: {
      type: String,
      default: '',
      uppercase: true,
      trim: true
    },
    longest_runway_ft: {
      type: Number,
      default: 3000,
      min: 0
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere index on location field for geospatial queries ($nearSphere)
AirportSchema.index({ location: '2dsphere' });

export const Airport = mongoose.model('Airport', AirportSchema);
export default Airport;

