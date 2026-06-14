const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'safepulse_secret_key');

      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      // Single-device restriction: validate the device session header matches the stored session
      const deviceSession = req.headers['x-device-session'];
      if (!deviceSession || !user.deviceSession || deviceSession !== user.deviceSession) {
        return res.status(401).json({
          success: false,
          message: 'This account is logged in on another device. Please log in again.'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

module.exports = { protect };
