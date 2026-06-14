const mongoose = require('mongoose');

/*
 * SharingSession — Tracks ephemeral location-sharing windows that users
 * explicitly opt into.  Documents are automatically garbage-collected by
 * MongoDB's TTL index the moment expiresAt is reached, so no background
 * cron job or application-level cleanup is necessary.
 *
 * TTL index performance notes for free-tier Atlas M0:
 *   - The index is single-field on expiresAt with expireAfterSeconds: 0.
 *   - MongoDB's background TTL monitor runs every 60 seconds by default.
 *   - Deletion is O(log n) per expired doc and incurs no CPU on the app
 *     server — ideal for the 512 MB RAM constraint of an M0 cluster.
 */
const sharingSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  durationLabel: {
    type: String,
    required: true,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

/*
 * TTL index — expireAfterSeconds: 0 tells MongoDB to delete the document
 * as soon as expiresAt <= current server time.  The background TTL daemon
 * sweeps every ~60 s, so real-world deletion latency is at most one minute
 * after expiry.  This is acceptable for a privacy window and avoids
 * complicating the application with schedulers or queue workers.
 */
sharingSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SharingSession', sharingSessionSchema);
