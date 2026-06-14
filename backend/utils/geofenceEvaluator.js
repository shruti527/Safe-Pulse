const Geofence = require('../models/Geofence');
const User = require('../models/User');
const { sendPushToUsers } = require('./fcm');

const userGeofenceState = new Map();

function getDistanceFromLatLngInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function evaluateLocation(userId, latitude, longitude, io) {
  const uid = userId.toString();

  const geofences = await Geofence.find({
    userId,
    active: true,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: 10000
      }
    }
  }).lean();

  const prevState = userGeofenceState.get(uid) || new Set();
  const currentInsideIds = new Set();
  const events = [];

  for (const gf of geofences) {
    const distance = getDistanceFromLatLngInMeters(latitude, longitude, gf.latitude, gf.longitude);
    const isInside = distance <= gf.radius;
    const gid = gf._id.toString();

    if (isInside) currentInsideIds.add(gid);

    const wasInside = prevState.has(gid);

    if (isInside && !wasInside) {
      events.push({ type: 'entry', geofence: gf });
    } else if (!isInside && wasInside) {
      events.push({ type: 'exit', geofence: gf });
    }
  }

  userGeofenceState.set(uid, currentInsideIds);

  if (events.length > 0 && io) {
    await notifyCrossing(userId, events, io);
  }

  return events;
}

async function notifyCrossing(userId, events, io) {
  const user = await User.findById(userId);
  if (!user) return;

  const acceptedContactIds = user.contacts
    .filter(c => c.status === 'accepted' && c.user)
    .map(c => c.user._id);

  for (const event of events) {
    const { type, geofence } = event;
    const payload = {
      userId: userId.toString(),
      userName: user.name,
      geofenceId: geofence._id.toString(),
      geofenceName: geofence.name,
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      time: new Date()
    };

    if (type === 'exit') {
      acceptedContactIds.forEach(contactId => {
        io.to(`user_${contactId}`).emit('safeZoneExit', payload);
      });
      io.to(`user_${userId}`).emit('safeZoneExit', payload);

      await sendPushToUsers(acceptedContactIds, {
        title: 'Safe Zone Exited',
        body: `${user.name} has exited the safe zone: ${geofence.name}`,
        data: {
          type: 'SAFE_ZONE_EXIT',
          userId: userId.toString(),
          geofenceName: geofence.name,
          geofenceId: geofence._id.toString()
        }
      });
    } else if (type === 'entry') {
      acceptedContactIds.forEach(contactId => {
        io.to(`user_${contactId}`).emit('safeZoneEntry', payload);
      });
      io.to(`user_${userId}`).emit('safeZoneEntry', payload);

      await sendPushToUsers(acceptedContactIds, {
        title: 'Safe Zone Entered',
        body: `${user.name} has arrived at the safe zone: ${geofence.name}`,
        data: {
          type: 'SAFE_ZONE_ENTRY',
          userId: userId.toString(),
          geofenceName: geofence.name,
          geofenceId: geofence._id.toString()
        }
      });
    }
  }
}

module.exports = { evaluateLocation };
