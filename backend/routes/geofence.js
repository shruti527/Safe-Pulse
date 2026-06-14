const express = require('express');
const router = express.Router();
const Geofence = require('../models/Geofence');
const User = require('../models/User');
const Location = require('../models/Location');
const SharingSession = require('../models/SharingSession');
const { protect } = require('../middleware/authentication');
const { evaluateLocation } = require('../utils/geofenceEvaluator');

// @route   POST /api/geofences/create
// @desc    Create a new geofence for the user
router.post('/create', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, address, radius, latitude, longitude } = req.body;

    // --- Strict input validation ---
    const toNum = (val) => {
      if (val === undefined || val === null || String(val).trim() === '') return NaN;
      return parseFloat(val);
    };

    const lat  = toNum(latitude);
    const lng  = toNum(longitude);
    const rad  = toNum(radius);

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ success: false, message: 'Missing required fields: name' });
    }
    if (isNaN(lat) || lat < -90  || lat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid latitude: must be a number between -90 and 90' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid longitude: must be a number between -180 and 180' });
    }
    if (isNaN(rad) || rad < 1) {
      return res.status(400).json({ success: false, message: 'Invalid radius: must be a number greater than 0' });
    }

    const geofence = new Geofence({
      userId,
      name,
      address: address || '',
      radius: rad,
      latitude: lat,
      longitude: lng
    });

    await geofence.save();

    res.json({
      success: true,
      data: geofence,
      message: 'Geofence created successfully'
    });
  } catch (error) {
    console.error('Error creating geofence:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating geofence'
    });
  }
});

// @route   GET /api/geofences/list/:userId
// @desc    Get all geofences of a user
router.get('/list/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    // Guard: Only allow the user themselves to list their geofences
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot access another user\'s safe zones' });
    }

    const userGeofences = await Geofence.find({ userId });
    
    res.json({
      success: true,
      data: userGeofences,
      count: userGeofences.length
    });
  } catch (error) {
    console.error('Error listing geofences:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while listing geofences'
    });
  }
});

// @route   PATCH /api/geofences/toggle/:id
// @desc    Toggle geofence active status
router.patch('/toggle/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const geofence = await Geofence.findById(id);
    if (!geofence) {
      return res.status(404).json({ success: false, message: 'Geofence not found' });
    }

    // Authorization check
    if (geofence.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not own this safe zone' });
    }

    geofence.active = !geofence.active;
    await geofence.save();
    res.json({ success: true, data: geofence, message: 'Geofence status updated' });
  } catch (error) {
    console.error('Error toggling geofence:', error);
    res.status(500).json({ success: false, message: 'Server error while toggling geofence' });
  }
});

// @route   DELETE /api/geofences/delete/:id
// @desc    Delete a geofence
router.delete('/delete/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const geofence = await Geofence.findById(id);
    if (!geofence) {
      return res.status(404).json({ success: false, message: 'Geofence not found' });
    }

    // Authorization check
    if (geofence.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not own this safe zone' });
    }

    await Geofence.findByIdAndDelete(id);
    res.json({ success: true, message: 'Geofence deleted successfully' });
  } catch (error) {
    console.error('Error deleting geofence:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting geofence' });
  }
});

// @route   GET /api/geofences/track-friend/:friendId
// @desc    Get a friend's current location and active geofences (permission-checked)
router.get('/track-friend/:friendId', protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { friendId } = req.params;

    // Verify the requesting user is allowed to track this friend
    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const contact = user.contacts.find(
      c =>
        c.user &&
        c.user.toString() === friendId &&
        c.status === 'accepted' &&
        c.requestedBy &&
        c.requestedBy.toString() === currentUserId.toString()
    );

    if (!contact) {
      return res.status(403).json({ success: false, message: 'Not authorized to track this user' });
    }

    // Check if friend has ghost mode enabled
    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({ success: false, message: 'Friend not found' });
    }
    if (friend.ghostMode) {
      return res.status(403).json({ success: false, message: 'This user has ghost mode enabled' });
    }

    // Privacy gate: verify the friend has an active temporary sharing session
    const activeSharing = await SharingSession.findOne({
      userId: friendId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });
    if (!activeSharing) {
      return res.status(403).json({
        success: false,
        message: 'This friend does not have an active location sharing session. Ask them to start one from the Share page.',
      });
    }

    // Get friend's last known location
    const lastLocation = await Location.findOne({ userId: friendId }).sort({ timestamp: -1 });

    // Get friend's active geofences
    const geofences = await Geofence.find({ userId: friendId, active: true });

    res.json({
      success: true,
      data: {
        location: lastLocation
          ? {
              latitude: lastLocation.latitude,
              longitude: lastLocation.longitude,
              timestamp: lastLocation.timestamp
            }
          : null,
        geofences
      }
    });
  } catch (error) {
    console.error('Error tracking friend:', error);
    res.status(500).json({ success: false, message: 'Server error while tracking friend' });
  }
});

// @route   POST /api/geofences/evaluate
// @desc    Evaluate user coordinates against all active geofences
router.post('/evaluate', protect, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid latitude: must be between -90 and 90' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid longitude: must be between -180 and 180' });
    }

    const io = req.app.get('io');
    const events = await evaluateLocation(req.user._id, lat, lng, io);

    res.json({ success: true, events, count: events.length });
  } catch (error) {
    console.error('Error evaluating geofence:', error);
    res.status(500).json({ success: false, message: 'Server error while evaluating geofences' });
  }
});

module.exports = router;