const express = require('express');
const router = express.Router();
const SOSAlert = require('../models/SOSAlert');
const User = require('../models/User');
const CheckIn = require('../models/CheckIn');
const { protect } = require('../middleware/authentication');
const { sendPushToUsers } = require('../utils/fcm');

// @route   POST /api/sos/trigger
// @desc    Trigger emergency SOS (HTTP post, triggers Socket.IO broadcast + FCM)
router.post('/trigger', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { latitude, longitude, message, timestamp, battery, network } = req.body;

    // --- Coordinate validation ---
    const toNum = (val) => {
      if (val === undefined || val === null || String(val).trim() === '') return NaN;
      return parseFloat(val);
    };

    const lat = toNum(latitude);
    const lng = toNum(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid latitude: must be a number between -90 and 90' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid longitude: must be a number between -180 and 180' });
    }

    // Find the user and their accepted emergency contacts
    const user = await User.findById(userId).populate('contacts.user');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const acceptedContactIds = user.contacts
      .filter(c => c.status === 'accepted' && c.user)
      .map(c => c.user._id);

    // Deduplication check: see if user already has an active triggered alert
    let sosAlert = await SOSAlert.findOne({
      userId,
      status: 'triggered'
    });

    if (sosAlert) {
      console.log(`[SOS TRIGGER ROUTE] Deduplicated SOS trigger. Alert already active for user ${user.name}`);
    } else {
      sosAlert = new SOSAlert({
        userId,
        latitude: lat,
        longitude: lng,
        message: message || `${user.name} triggered an SOS Emergency Alert!`,
        timestamp: timestamp || new Date(),
        notifiedContacts: acceptedContactIds,
        battery: toNum(battery) || null,
        network: network || null,
        status: 'triggered'
      });
      await sosAlert.save();
    }

    const alertPayload = {
      alertId: sosAlert._id,
      userId,
      userName: user.name,
      userPhone: user.phone || 'N/A',
      userEmail: user.email,
      latitude: sosAlert.latitude,
      longitude: sosAlert.longitude,
      battery: sosAlert.battery,
      network: sosAlert.network,
      message: sosAlert.message,
      time: sosAlert.timestamp,
      escalationLevel: sosAlert.escalationLevel || 1
    };

    // Broadcast to contacts using Socket.IO
    const io = req.app.get('io');
    if (io) {
      acceptedContactIds.forEach(contactId => {
        io.to(`user_${contactId}`).emit('emergencyAlert', alertPayload);
      });
      io.to(`user_${userId}`).emit('emergencyAlert', alertPayload);
    }

    // Send FCM push notifications to accepted contacts
    await sendPushToUsers(acceptedContactIds, {
      title: '🔴 SOS Emergency Alert!',
      body: `${user.name} is in danger! Live location tracking is active.`,
      data: {
        type: 'SOS_ALERT',
        alertId: sosAlert._id.toString(),
        userId: userId.toString(),
        latitude: String(sosAlert.latitude),
        longitude: String(sosAlert.longitude)
      }
    });

    console.log(`[SOS ALERT ROUTE] User ${user.name} (${userId}) triggered SOS at ${sosAlert.timestamp}`);

    res.json({
      success: true,
      data: sosAlert,
      message: 'SOS alert triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering SOS:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while triggering SOS'
    });
  }
});

// @route   POST /api/sos/resolve/:alertId
// @desc    Mark SOS alert as resolved/safe (triggers socket + FCM)
router.post('/resolve/:alertId', protect, async (req, res) => {
  try {
    const { alertId } = req.params;
    const resolvedBy = req.user._id;

    const alert = await SOSAlert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'SOS Alert not found' });
    }

    alert.status = 'resolved';
    alert.resolved = true;
    alert.resolvedBy = resolvedBy;
    await alert.save();

    const user = await User.findById(alert.userId);
    const resolver = await User.findById(resolvedBy);
    const resolverName = resolver ? resolver.name : 'a Contact';

    // Broadcast safety resolution via sockets
    const io = req.app.get('io');
    if (io && user) {
      const safePayload = {
        userId: user._id,
        alertId: alert._id,
        resolvedBy,
        resolverName,
        time: new Date()
      };

      const acceptedContactIds = user.contacts
        .filter(c => c.status === 'accepted' && c.user)
        .map(c => c.user._id);

      acceptedContactIds.forEach(contactId => {
        io.to(`user_${contactId}`).emit('userSafe', safePayload);
      });

      io.to(`user_${user._id}`).emit('userSafe', safePayload);
      
      // Send FCM push notification to contacts
      await sendPushToUsers(acceptedContactIds, {
        title: '🟢 User Marked Safe',
        body: `${user.name} has been marked safe.`,
        data: {
          type: 'USER_SAFE',
          alertId: alert._id.toString(),
          userId: user._id.toString()
        }
      });
    }

    res.json({
      success: true,
      data: alert,
      message: 'Emergency resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving SOS alert:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resolving emergency'
    });
  }
});

// @route   GET /api/sos/alerts/:userId
// @desc    Get SOS alerts for a user network (either created by them or sent to them)
router.get('/alerts/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    
    // Privacy safeguard: must be owner or trusted contact
    if (req.user._id.toString() !== userId) {
      const isContact = req.user.contacts.some(c => c.user && c.user.toString() === userId && c.status === 'accepted');
      if (!isContact) {
        return res.status(403).json({ success: false, message: 'Forbidden: You are not in this user\'s trusted contacts list' });
      }
    }
    
    const userAlerts = await SOSAlert.find({
      $or: [
        { userId },
        { notifiedContacts: userId }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: userAlerts,
      count: userAlerts.length
    });
  } catch (error) {
    console.error('Error fetching SOS alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching SOS alerts'
    });
  }
});

// @route   POST /api/sos/checkin/start
// @desc    Start a safety check-in timer
router.post('/checkin/start', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { durationMinutes, message } = req.body;

    if (!durationMinutes || isNaN(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid check-in duration (minutes)' });
    }

    const deadline = new Date(Date.now() + durationMinutes * 60 * 1000);

    // End any existing pending check-ins
    await CheckIn.updateMany({ userId, status: 'pending' }, { status: 'completed' });

    const checkIn = new CheckIn({
      userId,
      deadline,
      message: message || 'Walking route safety check-in',
      status: 'pending'
    });

    await checkIn.save();

    console.log(`[CHECKIN START] User ${req.user.name} started check-in for ${durationMinutes} mins`);

    res.json({
      success: true,
      data: checkIn,
      message: `Safety check-in timer set for ${durationMinutes} minutes.`
    });
  } catch (error) {
    console.error('Error starting check-in timer:', error);
    res.status(500).json({ success: false, message: 'Server error while setting check-in' });
  }
});

// @route   POST /api/sos/checkin/resolve
// @desc    Acknowledge check-in / Cancel timer
router.post('/checkin/resolve', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Resolve all pending check-ins
    const result = await CheckIn.updateMany(
      { userId, status: 'pending' },
      { status: 'completed' }
    );

    console.log(`[CHECKIN RESOLVE] User ${req.user.name} checked in successfully. resolved count: ${result.modifiedCount}`);

    res.json({
      success: true,
      message: 'Check-in registered successfully.'
    });
  } catch (error) {
    console.error('Error resolving check-in:', error);
    res.status(500).json({ success: false, message: 'Server error while resolving check-in' });
  }
});

module.exports = router;