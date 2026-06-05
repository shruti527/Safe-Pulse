const mongoose = require('mongoose');

const GeofenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  },
  radius: {
    type: Number,
    required: true,
    min: [1, 'Radius must be greater than 0'] // prevents zero/negative-area geofences
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  // GeoJSON Point — populated by pre-save hook for 2dsphere geospatial queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude] — GeoJSON order
      default: [0, 0]
    }
    // REMOVED: index: '2dsphere' from here to prevent the TypeError
  }
}, {
  timestamps: true
});

// This is the correct, compound-safe way to define the 2dsphere index!
GeofenceSchema.index({ location: '2dsphere' });

// Sync the GeoJSON `location` field from scalar lat/lng before every save
// GeoJSON stores coordinates as [longitude, latitude] — note the reversed order
GeofenceSchema.pre('save', function (next) {
  this.location = {
    type: 'Point',
    coordinates: [this.longitude, this.latitude]
  };
  next();
});

module.exports = mongoose.model('Geofence', GeofenceSchema);