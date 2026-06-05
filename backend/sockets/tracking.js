const mongoose = require('mongoose');
const TrackingSession = require('../models/TrackingSession');
const User = require('../models/User');
const SOSAlert = require('../models/SOSAlert');

// Initialize the global online users map if not already done
if (!global.onlineUsers) {
  global.onlineUsers = new Map(); // userId string -> Set of socketId strings
}

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

module.exports = function (io) {
  // Background worker for Missed Check-ins and Alert Escalations (runs every 15s)
  setInterval(async () => {
    try {
      const CheckIn = require('../models/CheckIn');
      const Location = require('../models/Location');
      const { sendPushToUsers } = require('../utils/fcm');

      // 1. Check for Missed Check-ins
      const missedCheckIns = await CheckIn.find({
        status: 'pending',
        deadline: { $lte: new Date() }
      });

      for (const checkIn of missedCheckIns) {
        checkIn.status = 'missed';
        await checkIn.save();

        console.log(`[BACKGROUND SERVICE] Missed check-in detected for user ${checkIn.userId}`);

        const user = await User.findById(checkIn.userId).populate('contacts.user');
        if (!user) continue;

        const acceptedContactIds = user.contacts
          .filter(c => c.status === 'accepted' && c.user)
          .map(c => c.user._id);

        // Find user's last known location coordinates
        const lastLocation = await Location.findOne({ userId: checkIn.userId }).sort({ timestamp: -1 });
        const lat = lastLocation ? lastLocation.latitude : null;
        const lng = lastLocation ? lastLocation.longitude : null;

        const alertMsg = `${user.name} missed a scheduled safety check-in!`;

        // Check if an SOS alert is already active
        let sosAlert = await SOSAlert.findOne({ userId: checkIn.userId, status: 'triggered' });
        if (!sosAlert) {
          sosAlert = new SOSAlert({
            userId: checkIn.userId,
            latitude: lat,
            longitude: lng,
            message: alertMsg,
            notifiedContacts: acceptedContactIds,
            status: 'triggered'
          });
          await sosAlert.save();
        }

        const alertPayload = {
          alertId: sosAlert._id,
          userId: user._id,
          userName: user.name,
          userPhone: user.phone || 'N/A',
          userEmail: user.email,
          latitude: lat,
          longitude: lng,
          battery: null,
          network: null,
          message: alertMsg,
          time: new Date(),
          escalationLevel: 1
        };

        // Emit Socket.IO alerts
        acceptedContactIds.forEach(contactId => {
          io.to(`user_${contactId}`).emit('emergencyAlert', alertPayload);
        });
        io.to(`user_${user._id}`).emit('emergencyAlert', alertPayload);

        // Send FCM push notification
        await sendPushToUsers(acceptedContactIds, {
          title: '⚠️ Missed Check-In Alert',
          body: `${user.name} missed their scheduled check-in. Emergency mode active.`,
          data: {
            type: 'MISSED_CHECKIN',
            alertId: sosAlert._id.toString(),
            userId: user._id.toString()
          }
        });
      }

      // 2. Check for SOS Alert Escalations
      const activeAlerts = await SOSAlert.find({ status: 'triggered' });
      for (const alert of activeAlerts) {
        const timeDiffMins = (Date.now() - new Date(alert.createdAt).getTime()) / (60 * 1000);
        
        let newLevel = 1;
        if (timeDiffMins >= 10) {
          newLevel = 3;
        } else if (timeDiffMins >= 5) {
          newLevel = 2;
        }

        if (newLevel > alert.escalationLevel) {
          alert.escalationLevel = newLevel;
          await alert.save();

          console.log(`[BACKGROUND SERVICE] SOS Alert ${alert._id} escalated to Level ${newLevel}`);

          const user = await User.findById(alert.userId);
          if (!user) continue;

          const acceptedContactIds = user.contacts
            .filter(c => c.status === 'accepted' && c.user)
            .map(c => c.user._id);

          const escalationPayload = {
            alertId: alert._id,
            userId: alert.userId,
            userName: user.name,
            escalationLevel: newLevel,
            time: new Date()
          };

          // Emit Socket.IO escalations
          acceptedContactIds.forEach(contactId => {
            io.to(`user_${contactId}`).emit('alertEscalated', escalationPayload);
          });
          io.to(`user_${alert.userId}`).emit('alertEscalated', escalationPayload);

          // Send FCM push notification
          const levelName = newLevel === 2 ? 'Level 2: Warning' : 'Level 3: Critical';
          await sendPushToUsers(acceptedContactIds, {
            title: `🚨 Alert Escalated (${levelName})`,
            body: `${user.name}'s emergency remains unresolved. Escalated to Level ${newLevel}.`,
            data: {
              type: 'ALERT_ESCALATED',
              alertId: alert._id.toString(),
              escalationLevel: String(newLevel)
            }
          });
        }
      }
    } catch (err) {
      console.error('[BACKGROUND SERVICE] Error checking checkins/escalations:', err);
    }
  }, 15000);

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Connected: ${socket.id}`);

    // Register user and join their private room
    socket.on('join_user_room', async (userId) => {
      if (!userId || !isValidObjectId(userId)) {
        console.warn('[SOCKET] Invalid userId for join_user_room:', userId);
        return;
      }
      socket.userId = userId;
      socket.join(`user_${userId}`);
      console.log(`[SOCKET] User ${userId} joined room user_${userId} on socket ${socket.id}`);

      // Track online status
      if (!global.onlineUsers.has(userId)) {
        global.onlineUsers.set(userId, new Set());
      }
      global.onlineUsers.get(userId).add(socket.id);

      // Fetch user to check ghostMode
      const user = await User.findById(userId);
      const isGhost = user ? user.ghostMode : false;

      if (!isGhost) {
        // Broadcast user's online status to everyone
        io.emit('user_status_change', { userId, status: 'Online' });
      }
    });

    // 1. startTracking
    const handleStartTracking = async (data) => {
      try {
        const { userId, latitude, longitude } = data;
        if (!userId || !isValidObjectId(userId)) {
          console.warn('[SOCKET] Invalid userId for startTracking:', userId);
          return;
        }

        console.log(`[SOCKET] startTracking from user ${userId} at [${latitude}, ${longitude}]`);
        
        const session = await TrackingSession.create({
          userId,
          status: 'active',
          route: [{ latitude, longitude }]
        });

        // Acknowledge to the emitter
        socket.emit('session_started', {
          sessionId: session._id,
          userId,
          latitude,
          longitude
        });

        // Broadcast to user's room (contacts watching)
        io.to(`user_${userId}`).emit('live_status', {
          trackingActive: true,
          sessionId: session._id,
          latitude,
          longitude
        });
      } catch (err) {
        console.error('[SOCKET] Error in startTracking:', err);
      }
    };

    socket.on('startTracking', handleStartTracking);
    socket.on('start_session', handleStartTracking); // Legacy alias

    // 2. locationUpdate
    const handleLocationUpdate = async (data) => {
      try {
        const { userId, sessionId, latitude, longitude, accuracy, battery, network } = data;
        if (!userId || !isValidObjectId(userId)) {
          console.warn('[SOCKET] Invalid userId for locationUpdate:', userId);
          return;
        }

        // Fetch user to check ghostMode
        const user = await User.findById(userId);
        if (user && user.ghostMode) {
          console.log(`[SOCKET] Suppressed locationUpdate broadcast for User ${userId} (Ghost Mode Active)`);
          return;
        }

        // Update tracking session route if session exists
        if (sessionId) {
          await TrackingSession.findByIdAndUpdate(sessionId, {
            $push: { route: { latitude, longitude, timestamp: new Date() } }
          });
        }

        // Broadcast update to watchers (contacts)
        io.to(`user_${userId}`).emit('locationUpdate', {
          userId,
          sessionId,
          latitude,
          longitude,
          accuracy,
          battery,
          network,
          timestamp: new Date()
        });
      } catch (err) {
        console.error('[SOCKET] Error in locationUpdate:', err);
      }
    };

    socket.on('locationUpdate', handleLocationUpdate);
    socket.on('location_update', handleLocationUpdate); // Legacy alias

    // 3. emergencyAlert (SOS Pressed)
    const handleEmergencyAlert = async (data) => {
      try {
        const { userId, latitude, longitude, battery, network, message } = data;
        if (!userId || !isValidObjectId(userId)) {
          console.warn('[SOCKET] Invalid userId for emergencyAlert:', userId);
          return;
        }

        console.log(`[SOCKET] EMERGENCY ALERT triggered by user ${userId} at [${latitude}, ${longitude}]`);

        // Get user's details and their accepted contacts to notify
        const user = await User.findById(userId).populate('contacts.user');
        if (!user) return;

        const acceptedContactIds = user.contacts
          .filter(c => c.status === 'accepted' && c.user)
          .map(c => c.user._id);

        // Save SOSAlert to MongoDB (Deduplicated)
        let alert = await SOSAlert.findOne({ userId, status: 'triggered' });
        if (!alert) {
          alert = new SOSAlert({
            userId,
            latitude,
            longitude,
            message: message || `${user.name} triggered an SOS Emergency Alert!`,
            notifiedContacts: acceptedContactIds,
            battery: battery || null,
            network: network || null,
            status: 'triggered'
          });
          await alert.save();
        }

        const alertPayload = {
          alertId: alert._id,
          userId,
          userName: user.name,
          userPhone: user.phone || 'N/A',
          userEmail: user.email,
          latitude,
          longitude,
          battery,
          network,
          message: alert.message,
          time: alert.timestamp,
          escalationLevel: alert.escalationLevel || 1
        };

        // Broadcast alert directly to all accepted contacts' private rooms
        acceptedContactIds.forEach(contactId => {
          console.log(`[SOCKET] Emitting emergencyAlert to contact room user_${contactId}`);
          io.to(`user_${contactId}`).emit('emergencyAlert', alertPayload);
        });

        // Also emit back to the user's room to notify any active map listeners
        io.to(`user_${userId}`).emit('emergencyAlert', alertPayload);

        // Send FCM notification
        const { sendPushToUsers } = require('../utils/fcm');
        await sendPushToUsers(acceptedContactIds, {
          title: '🔴 SOS Emergency Alert!',
          body: `${user.name} triggered an SOS! Live tracking active.`,
          data: {
            type: 'SOS_ALERT',
            alertId: alert._id.toString(),
            userId: userId.toString(),
            latitude: String(latitude),
            longitude: String(longitude)
          }
        });

      } catch (err) {
        console.error('[SOCKET] Error in emergencyAlert:', err);
      }
    };

    socket.on('emergencyAlert', handleEmergencyAlert);
    socket.on('sos_alert', handleEmergencyAlert); // Legacy alias

    // 4. safeZoneExit
    const handleSafeZoneExit = async (data) => {
      try {
        const { userId, geofenceName, latitude, longitude } = data;
        if (!userId || !isValidObjectId(userId)) {
          console.warn('[SOCKET] Invalid userId for safeZoneExit:', userId);
          return;
        }

        console.log(`[SOCKET] User ${userId} exited safe zone: ${geofenceName}`);

        const user = await User.findById(userId);
        const name = user ? user.name : 'User';

        const alertPayload = {
          userId,
          userName: name,
          geofenceName,
          latitude,
          longitude,
          time: new Date()
        };

        // Notify contacts
        const acceptedContactIds = user.contacts
          .filter(c => c.status === 'accepted' && c.user)
          .map(c => c.user._id);

        acceptedContactIds.forEach(contactId => {
          io.to(`user_${contactId}`).emit('safeZoneExit', alertPayload);
        });

        // Send FCM Notification
        const { sendPushToUsers } = require('../utils/fcm');
        await sendPushToUsers(acceptedContactIds, {
          title: '🚪 Safe Zone Exited',
          body: `${name} has exited the safe zone: ${geofenceName}`,
          data: {
            type: 'SAFE_ZONE_EXIT',
            userId: userId.toString(),
            geofenceName
          }
        });

      } catch (err) {
        console.error('[SOCKET] Error in safeZoneExit:', err);
      }
    };

    socket.on('safeZoneExit', handleSafeZoneExit);

    // 5. sessionEnded
    const handleSessionEnded = async (data) => {
      try {
        const { userId, sessionId } = data;
        if (!userId) return;

        if (sessionId) {
          await TrackingSession.findByIdAndUpdate(sessionId, {
            status: 'completed',
            endTime: new Date()
          });
        }

        io.to(`user_${userId}`).emit('sessionEnded', { userId, sessionId });
      } catch (err) {
        console.error('[SOCKET] Error in sessionEnded:', err);
      }
    };

    socket.on('sessionEnded', handleSessionEnded);
    socket.on('end_session', handleSessionEnded); // Legacy alias

    // 6. userSafe (Mark Safe / Emergency Resolved)
    const handleUserSafe = async (data) => {
      try {
        let { userId, alertId, resolvedBy } = data;
        if (!userId || !isValidObjectId(userId)) {
          console.warn('[SOCKET] Invalid userId for userSafe:', userId);
          return;
        }
        if (resolvedBy && !isValidObjectId(resolvedBy)) {
          console.warn('[SOCKET] Invalid resolvedBy userId for userSafe:', resolvedBy);
          resolvedBy = null;
        }

        console.log(`[SOCKET] User ${userId} marked SAFE by ${resolvedBy || 'Self'}`);

        // Update SOSAlert record in MongoDB
        let alert;
        if (alertId) {
          alert = await SOSAlert.findByIdAndUpdate(alertId, {
            status: 'resolved',
            resolved: true,
            resolvedBy: resolvedBy || null
          }, { new: true });
        } else {
          // If no alertId was provided, resolve the latest triggered alert for this user
          alert = await SOSAlert.findOneAndUpdate(
            { userId, status: 'triggered' },
            { status: 'resolved', resolved: true, resolvedBy: resolvedBy || null },
            { sort: { timestamp: -1 }, new: true }
          );
        }

        const resolverUser = resolvedBy ? await User.findById(resolvedBy) : null;
        const resolverName = resolverUser ? resolverUser.name : 'Self';

        const safePayload = {
          userId,
          alertId: alert ? alert._id : alertId,
          resolvedBy,
          resolverName,
          time: new Date()
        };

        // Broadcast to user's room and all of user's contacts
        const user = await User.findById(userId);
        if (user) {
          const acceptedContactIds = user.contacts
            .filter(c => c.status === 'accepted' && c.user)
            .map(c => c.user._id);

          acceptedContactIds.forEach(contactId => {
            io.to(`user_${contactId}`).emit('userSafe', safePayload);
          });

          // Send FCM Notification
          const { sendPushToUsers } = require('../utils/fcm');
          await sendPushToUsers(acceptedContactIds, {
            title: '🟢 User Marked Safe',
            body: `${user.name} has been marked safe by ${resolverName}.`,
            data: {
              type: 'USER_SAFE',
              alertId: alert ? alert._id.toString() : '',
              userId: userId.toString()
            }
          });
        }

        io.to(`user_${userId}`).emit('userSafe', safePayload);
      } catch (err) {
        console.error('[SOCKET] Error in userSafe:', err);
      }
    };

    socket.on('userSafe', handleUserSafe);

    // 7. track_contact
    socket.on('track_contact', (contactId) => {
      if (!contactId) return;
      socket.join(`user_${contactId}`);
      console.log(`[SOCKET] Socket ${socket.id} started tracking contact ${contactId}`);
    });

    // 8. untrack_contact
    socket.on('untrack_contact', (contactId) => {
      if (!contactId) return;
      socket.leave(`user_${contactId}`);
      console.log(`[SOCKET] Socket ${socket.id} stopped tracking contact ${contactId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${socket.id}`);
      if (socket.userId) {
        const userId = socket.userId;
        if (global.onlineUsers.has(userId)) {
          const userSockets = global.onlineUsers.get(userId);
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            global.onlineUsers.delete(userId);
            // Broadcast offline status
            io.emit('user_status_change', { userId, status: 'Offline' });
          }
        }
      }
    });
  });
};
