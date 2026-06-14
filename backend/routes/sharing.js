const express = require('express');
const router = express.Router();
const SharingSession = require('../models/SharingSession');
const { protect } = require('../middleware/authentication');

/*
 * POST /api/sharing/start
 * Body: { durationMinutes: number, label: string }
 *
 * Creates a new time-bounded location sharing session.  Any previously
 * active sessions belonging to this user are automatically expired so
 * only the latest window is ever valid — prevents stale overlaps from
 * leaking location data.
 */
router.post('/start', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { durationMinutes, label } = req.body;

    // --- Input validation ---
    if (!durationMinutes || typeof durationMinutes !== 'number' || durationMinutes < 1) {
      return res.status(400).json({
        success: false,
        message: 'durationMinutes must be a positive number.',
      });
    }
    if (durationMinutes > 43200) {
      // 30 day sanity cap — prevent accidentally creating a session that
      // lives longer than the TTL monitor's practical window.
      return res.status(400).json({
        success: false,
        message: 'durationMinutes cannot exceed 43200 (30 days).',
      });
    }

    // Deactivate any prior active sessions for this user so there is
    // never more than one valid sharing window at a time.
    await SharingSession.updateMany(
      { userId, isActive: true },
      { $set: { isActive: false } },
    );

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    const session = await SharingSession.create({
      userId,
      durationLabel: label || `${durationMinutes} Minutes`,
      startedAt,
      expiresAt,
      isActive: true,
    });

    console.log(`[SHARING] Session started for user ${userId}: ${durationMinutes} min, expires ${expiresAt.toISOString()}`);

    return res.status(201).json({
      success: true,
      data: {
        _id: session._id,
        durationLabel: session.durationLabel,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
      },
    });
  } catch (err) {
    console.error('[SHARING] Error starting session:', err);
    return res.status(500).json({ success: false, message: 'Server error while starting sharing session.' });
  }
});

/*
 * GET /api/sharing/status/:contactId
 *
 * Checks whether the user identified by :contactId currently has an
 * active, unexpired location sharing window.  This lets contacts verify
 * that they are allowed to view real-time coordinates before subscribing
 * to the tracking feed.
 */
router.get('/status/:contactId', protect, async (req, res) => {
  try {
    const { contactId } = req.params;

    // Basic ObjectId shape check to avoid casting errors in the query.
    if (!contactId || contactId.length !== 24) {
      return res.status(400).json({ success: false, message: 'Invalid contactId format.' });
    }

    const activeSession = await SharingSession.findOne({
      userId: contactId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!activeSession) {
      return res.json({ active: false });
    }

    return res.json({
      active: true,
      expiresAt: activeSession.expiresAt,
      durationLabel: activeSession.durationLabel,
    });
  } catch (err) {
    console.error('[SHARING] Error checking session status:', err);
    return res.status(500).json({ success: false, message: 'Server error while checking sharing status.' });
  }
});

module.exports = router;
