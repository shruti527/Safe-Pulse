const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const User = require('../models/User');
const { protect } = require('../middleware/authentication');

router.post('/update', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { latitude, longitude, timestamp, accuracy } = req.body;

    // --- Strict input validation ---
    // Helper: reject empty strings and values that parse to NaN
    const toNum = (val) => {
      if (val === undefined || val === null || String(val).trim() === '') return NaN;
      return parseFloat(val);
    };

    const lat = toNum(latitude);
    const lng = toNum(longitude);

    if (isNaN(lat) || lat < -90  || lat > 90) {
      return res.status(400).json({ success: false, message: 'Invalid latitude: must be a number between -90 and 90' });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid longitude: must be a number between -180 and 180' });
    }
    // --- End validation ---

    const acc = toNum(accuracy);

    const location = new Location({
      userId,
      latitude: lat,
      longitude: lng,
      timestamp: timestamp || new Date(),
      accuracy: !isNaN(acc) ? acc : null // only store accuracy if it's a valid number
    });

    await location.save();

    res.json({
      success: true,
      data: location,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating location'
    });
  }
});

router.get('/history/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    // Privacy Guard: If requester is not the user themselves, check target user's ghost mode status
    if (req.user._id.toString() !== userId) {
      const targetUser = await User.findById(userId);
      if (targetUser && targetUser.ghostMode) {
        console.log(`[PRIVACY] Location history requested for User ${userId} (Ghost Mode Active) - Access Blocked`);
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'Ghost Mode is enabled'
        });
      }
    }
    
    const userLocations = await Location.find({ userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: userLocations,
      count: userLocations.length
    });
  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching location history'
    });
  }
});

module.exports = router;