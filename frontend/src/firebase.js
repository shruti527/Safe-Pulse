import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import axios from 'axios';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock-auth-domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock-storage-bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "mock-app-id"
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

let messaging = null;
let firebaseInitialized = false;

try {
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    firebaseInitialized = true;
    console.log('🔥 Firebase initialized successfully.');
  } else {
    console.log('⚠️ Firebase API key missing in environment. Running Firebase in Mock Mode.');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase client:', error.message);
  console.log('Running Firebase in Mock Mode.');
}

/**
 * Register FCM device token with the backend
 */
export const registerFCMToken = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  if (!firebaseInitialized) {
    console.log('[MOCK FCM] Mock-registering browser token with server.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission was denied.');
      return;
    }

    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (currentToken) {
      console.log('[FCM] Retrieved device token:', currentToken);
      
      // Update on backend using the configured axios defaults
      await axios.put('/api/auth/fcm-token', { token: currentToken });
      console.log('[FCM] Registered device token on backend.');
    } else {
      console.warn('[FCM] No registration token available.');
    }
  } catch (err) {
    console.error('[FCM] Error during token registration:', err.message);
  }
};

/**
 * Register foreground message listener
 */
export const initForegroundMessenger = () => {
  if (!firebaseInitialized || !messaging) return;

  onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground notification received:', payload);
    
    const { title, body } = payload.notification || {};
    
    if (Notification.permission === 'granted' && title) {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else if (title) {
      alert(`${title}\n${body}`);
    }

    // Trigger local events if payload contains alert details
    if (payload.data && (payload.data.alertId || payload.data.type)) {
      window.dispatchEvent(new CustomEvent('safepulse-notification-click', {
        detail: payload.data
      }));
    }
  });
};
