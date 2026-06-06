const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  contacts: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending_sent', 'pending_received', 'accepted'] },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  ghostMode: { type: Boolean, default: false },
  pushNotifications: { type: Boolean, default: true },
  smartAlerts: { type: Boolean, default: true },
  fcmToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Hash password and normalize phone number before saving
userSchema.pre('save', async function(next) {
  if (this.phone) {
    this.phone = this.phone.replace(/\D/g, '');
  }
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
