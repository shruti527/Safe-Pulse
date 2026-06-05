const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/safepulse';

  const connectionOptions = {
    serverSelectionTimeoutMS: 5000, // Timeout server selection after 5 seconds
    socketTimeoutMS: 30000,        // Close socket after 30 seconds
  };

  if (primaryUri) {
    try {
      console.log('Attempting to connect to primary MongoDB Atlas...');
      const conn = await mongoose.connect(primaryUri, connectionOptions);
      
      // Verify connection is actually responsive by running a quick ping
      await mongoose.connection.db.admin().command({ ping: 1 }, { maxTimeMS: 3000 });
      
      console.log(`🔌 MongoDB Connected (Primary): ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`⚠️ MongoDB Atlas connection failed or unresponsive: ${error.message}`);
      try {
        await mongoose.disconnect();
      } catch (disconnectErr) {
        // Suppress disconnection errors during fallback
      }
      console.log('Falling back to local MongoDB database...');
    }
  }

  try {
    const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`🔌 MongoDB Connected (Local Fallback): ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
