const mongoose = require('mongoose');

const CheckInSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'missed'],
    default: 'pending'
  },
  message: {
    type: String,
    default: 'SafePulse Check-in'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CheckIn', CheckInSchema);
