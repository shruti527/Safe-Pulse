const mongoose = require('mongoose');

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/safepulse';

  if (primaryUri) {
    try {
      console.log('Attempting to connect to primary MongoDB Atlas...');
      const conn = await mongoose.connect(primaryUri);
      console.log(`🔌 MongoDB Connected (Primary): ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`⚠️ MongoDB Atlas connection failed: ${error.message}`);
      console.log('Falling back to local MongoDB database...');
    }
  }

  try {
    const conn = await mongoose.connect(localUri);
    console.log(`🔌 MongoDB Connected (Local Fallback): ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
