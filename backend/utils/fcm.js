const admin = require('firebase-admin');

let firebaseInitialized = false;

try {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    let serviceAccount;
    if (serviceAccountEnv.trim().startsWith('{')) {
      serviceAccount = JSON.parse(serviceAccountEnv);
    } else {
      // Treat as path to file
      serviceAccount = require(serviceAccountEnv);
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('🔥 Firebase Admin SDK initialized successfully.');
  } else {
    console.log('⚠️ FIREBASE_SERVICE_ACCOUNT env not found. Running Firebase Admin in Mock Mode.');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  console.log('Running Firebase Admin in Mock Mode.');
}

/**
 * Send FCM push notification to a device token.
 * 
 * @param {string} fcmToken - The target user's FCM device token
 * @param {object} payload - Notification payload { title, body, data }
 */
async function sendPushNotification(fcmToken, payload) {
  if (!fcmToken) {
    console.log('[MOCK FCM] No token provided, skipping push.');
    return;
  }
  
  const title = payload.title || 'SafePulse Alert';
  const body = payload.body || 'New security update';
  const data = payload.data || {};

  // Ensure all data values are strings for FCM compatibility
  const stringifiedData = {};
  for (const key in data) {
    stringifiedData[key] = String(data[key]);
  }

  const message = {
    notification: { title, body },
    data: stringifiedData,
    token: fcmToken
  };

  if (firebaseInitialized) {
    try {
      const response = await admin.messaging().send(message);
      console.log(`[FCM] Notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      console.error(`[FCM] Error sending message to token ${fcmToken}:`, error.message);
    }
  } else {
    console.log(`[MOCK FCM] WOULD SEND TO TOKEN: ${fcmToken}`);
    console.log(`[MOCK FCM] Notification Details:`, { title, body, data: stringifiedData });
    return { mockSuccess: true, messageId: 'mock-msg-' + Date.now() };
  }
}

/**
 * Send push notifications to multiple user IDs.
 * Helper that looks up FCM tokens for users in MongoDB.
 * 
 * @param {Array<string>} userIds - Array of MongoDB User IDs
 * @param {object} payload - Notification payload { title, body, data }
 */
async function sendPushToUsers(userIds, payload) {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return;
  
  const User = require('../models/User');
  try {
    const users = await User.find({ _id: { $in: userIds }, fcmToken: { $ne: null } });
    const sendPromises = users.map(user => {
      console.log(`[FCM] Queueing push notification for User ${user.name} (${user._id})`);
      return sendPushNotification(user.fcmToken, payload);
    });
    await Promise.all(sendPromises);
  } catch (error) {
    console.error('[FCM] Error sending bulk push notifications:', error);
  }
}

module.exports = {
  sendPushNotification,
  sendPushToUsers
};
