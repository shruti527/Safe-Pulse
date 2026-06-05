const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const trackingSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  route: [pointSchema]
});

module.exports = mongoose.model('TrackingSession', trackingSessionSchema);
