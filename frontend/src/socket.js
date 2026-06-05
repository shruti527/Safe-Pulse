import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace('/api', '');

let socket = null;

export const getSocket = () => {
  if (!socket) {
    console.log('[SOCKET] Initializing singleton Socket.IO connection to:', SOCKET_URL);
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      autoConnect: false
    });

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to server. Socket ID:', socket.id);
      const userId = localStorage.getItem('userId');
      if (userId) {
        console.log('[SOCKET] Automatically joining private room for User:', userId);
        socket.emit('join_user_room', userId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[SOCKET] Disconnected from server. Reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error.message);
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`[SOCKET] Attempting to reconnect... (Attempt ${attempt})`);
    });

    socket.on('reconnect_failed', () => {
      console.error('[SOCKET] Reconnection failed after all attempts.');
    });
  }

  // Connect if not already connected
  if (socket && !socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('[SOCKET] Manually disconnecting socket.');
    socket.disconnect();
    socket = null;
  }
};
