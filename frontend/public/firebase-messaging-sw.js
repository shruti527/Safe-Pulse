// Import and configure the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "mock-api-key",
  authDomain: "mock-auth-domain",
  projectId: "mock-project-id",
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'SafePulse Alert';
  const notificationOptions = {
    body: payload.notification.body || 'New security update',
    icon: '/favicon.ico',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to navigate to related page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const alertData = event.notification.data;
  let urlToOpen = '/';

  if (alertData) {
    if (alertData.type === 'SOS_ALERT' || alertData.type === 'ALERT_ESCALATED' || alertData.type === 'MISSED_CHECKIN') {
      urlToOpen = `/sos?alertId=${alertData.alertId || ''}&userId=${alertData.userId || ''}`;
    } else if (alertData.type === 'CONTACT_REQUEST') {
      urlToOpen = '/contacts';
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(urlToOpen).then(c => c.focus());
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
