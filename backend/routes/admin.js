const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SOSAlert = require('../models/SOSAlert');
const Geofence = require('../models/Geofence');
const { protect } = require('../middleware/authentication');

// @route   GET /api/admin/stats
// @desc    Get system overview stats (authenticated)
router.get('/stats', protect, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeAlerts = await SOSAlert.countDocuments({ status: 'triggered' });
    const resolvedAlerts = await SOSAlert.countDocuments({ status: 'resolved' });
    const totalGeofences = await Geofence.countDocuments();

    res.json({
      success: true,
      data: {
        totalUsers,
        activeAlerts,
        resolvedAlerts,
        totalGeofences
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, message: 'Server error fetching stats' });
  }
});

// @route   GET /api/admin/alerts
// @desc    Get all active and recent emergency alerts (authenticated)
router.get('/alerts', protect, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const alerts = await SOSAlert.find()
      .populate('userId', 'name email phone')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching admin alerts:', error);
    res.status(500).json({ success: false, message: 'Server error fetching alerts' });
  }
});

module.exports = router;
