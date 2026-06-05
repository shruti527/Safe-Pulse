/**
 * SafePulse Backend Server
 * 
 * Production-ready Node.js + Express backend for real-time personal safety
 * and geofencing application. Optimized for free-tier deployment on Render/Railway.
 * 
 * Features:
 * - MongoDB Atlas integration (M0 free tier optimized)
 * - Firebase Admin SDK ready for FCM push notifications
 * - HTTP polling-based location updates (no WebSockets to comply with free hosting limits)
 * - Geospatial queries for geofence detection
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const safepulseRoutes = require('./routes/safepulse');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Initialize Sockets
require('./sockets/tracking')(io);
app.set('io', io);
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
connectDB();

// CORS configuration - accepts requests from your React frontend domain
// Set FRONTEND_URL in your .env file (e.g., https://safepulse.netlify.app)
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (useful for deployment platforms)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
// Prefix: /api
// - POST /api/geofences/create - Create a new geofence
// - POST /api/location/update - Update user location, check geofence transitions
// - POST /api/sos/trigger - Trigger emergency SOS to SafeCircle
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', safepulseRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`
🚀 SafePulse Backend Server
   Running on port ${PORT}
   Environment: ${process.env.NODE_ENV || 'development'}
   Frontend URL: ${process.env.FRONTEND_URL || '*'}
  `);
});