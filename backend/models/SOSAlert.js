const mongoose = require('mongoose');

const SOSAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  message: {
    type: String,
    default: 'SOS triggered'
  },
  status: {
    type: String,
    enum: ['triggered', 'resolved', 'acknowledged'],
    default: 'triggered'
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  escalationLevel: {
    type: Number,
    default: 1,
    enum: [1, 2, 3]
  },
  checkinDeadline: {
    type: Date,
    default: null
  },
  notifiedContacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  battery: {
    type: Number,
    default: null
  },
  network: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SOSAlert', SOSAlertSchema);
