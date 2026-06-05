const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authentication');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'safepulse_secret_key', {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
    });

    if (user) {
      res.status(201).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST /api/auth/login
// @desc    Auth user & get token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get user profile
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('contacts.user', 'name email phone ghostMode');
    if (user) {
      res.json({ success: true, data: user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   PUT /api/auth/settings
// @desc    Update user profile settings (ghostMode, pushNotifications, smartAlerts)
router.put('/settings', protect, async (req, res) => {
  try {
    const { ghostMode, pushNotifications, smartAlerts } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (ghostMode !== undefined) user.ghostMode = ghostMode;
    if (pushNotifications !== undefined) user.pushNotifications = pushNotifications;
    if (smartAlerts !== undefined) user.smartAlerts = smartAlerts;

    await user.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        ghostMode: user.ghostMode,
        pushNotifications: user.pushNotifications,
        smartAlerts: user.smartAlerts
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   GET /api/auth/contacts
// @desc    Get contacts with online status
router.get('/contacts', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('contacts.user', 'name email phone ghostMode');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const contactsList = user.contacts.map(c => {
      if (!c.user) return null;
      const contactObj = c.user.toObject();
      const isOnline = global.onlineUsers && global.onlineUsers.has(c.user._id.toString()) && !c.user.ghostMode;
      return {
        _id: c._id,
        user: {
          ...contactObj,
          status: isOnline ? 'Online' : 'Offline'
        },
        status: c.status
      };
    }).filter(Boolean);

    res.json({ success: true, data: contactsList });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST /api/auth/contacts/request
// @desc    Send contact request (by email or phone)
router.post('/contacts/request', protect, async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res.status(400).json({ success: false, message: 'Please provide an email or phone number' });
    }

    const trimmedValue = emailOrPhone.trim();
    const isEmail = trimmedValue.includes('@');
    const normalizedPhone = trimmedValue.replace(/\D/g, '');

    // Find the target user by email or phone; accept formatted phone input too.
    const query = isEmail
      ? { email: trimmedValue.toLowerCase() }
      : {
          $or: [
            { phone: trimmedValue },
            { phone: normalizedPhone }
          ]
        };

    const targetUser = await User.findOne(query);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found with this email/phone' });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot add yourself as a contact' });
    }

    // Check if relationship already exists
    const sender = await User.findById(req.user._id);
    const alreadyContact = sender.contacts.find(c => c.user.toString() === targetUser._id.toString());

    if (alreadyContact) {
      return res.status(400).json({ 
        success: false, 
        message: alreadyContact.status === 'accepted' 
          ? 'This user is already in your contacts' 
          : 'A contact request is already pending' 
      });
    }

    // Add pending requests to both users
    sender.contacts.push({ user: targetUser._id, status: 'pending_sent' });
    targetUser.contacts.push({ user: req.user._id, status: 'pending_received' });

    await sender.save();
    await targetUser.save();

    // Notify recipient in real-time if socket is connected
    const io = req.app.get('io');
    if (io) {
      const socketPayload = {
        _id: sender._id,
        userId: sender._id,
        name: sender.name,
        phone: sender.phone || '',
        relation: 'Trusted Contact',
        avatar: null,
        status: 'pending_received',
        statusLabel: 'Incoming request',
        trackingMe: true,
        iTrack: false
      };
      io.to(`user_${targetUser._id}`).emit('contact_request_received', socketPayload);
      // Deprecated alias status event
      io.to(`user_${targetUser._id}`).emit('contactStatusUpdate', socketPayload);
    }

    // Send FCM push notification
    const { sendPushNotification } = require('../utils/fcm');
    if (targetUser.fcmToken) {
      await sendPushNotification(targetUser.fcmToken, {
        title: 'New Trusted Contact Request',
        body: `${sender.name} wants to add you as a trusted contact on SafePulse.`,
        data: {
          type: 'CONTACT_REQUEST',
          senderId: sender._id.toString()
        }
      });
    }

    res.json({ success: true, message: 'Contact request sent successfully' });
  } catch (error) {
    console.error('Error sending contact request:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST /api/auth/contacts/accept
// @desc    Accept contact request
router.post('/contacts/accept', protect, async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) {
      return res.status(400).json({ success: false, message: 'Missing contact ID' });
    }

    const user = await User.findById(req.user._id);
    const contactIdx = user.contacts.findIndex(c => c.user.toString() === contactId && c.status === 'pending_received');

    if (contactIdx === -1) {
      return res.status(400).json({ success: false, message: 'No pending request found from this user' });
    }

    // Find the other user
    const otherUser = await User.findById(contactId);
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User no longer exists' });
    }

    const otherIdx = otherUser.contacts.findIndex(c => c.user.toString() === req.user._id.toString() && c.status === 'pending_sent');

    // Update statuses to accepted
    user.contacts[contactIdx].status = 'accepted';
    if (otherIdx !== -1) {
      otherUser.contacts[otherIdx].status = 'accepted';
    } else {
      // In case of inconsistency, add it
      otherUser.contacts.push({ user: req.user._id, status: 'accepted' });
    }

    await user.save();
    await otherUser.save();

    // Notify other user in real-time
    const io = req.app.get('io');
    if (io) {
      const socketPayload = {
        _id: user._id,
        userId: user._id,
        name: user.name,
        phone: user.phone || '',
        relation: 'Trusted Contact',
        avatar: null,
        status: 'accepted',
        statusLabel: 'Connected',
        trackingMe: true,
        iTrack: true
      };
      io.to(`user_${otherUser._id}`).emit('contactStatusUpdate', socketPayload);
    }

    // Send FCM Push notification
    const { sendPushNotification } = require('../utils/fcm');
    if (otherUser.fcmToken) {
      await sendPushNotification(otherUser.fcmToken, {
        title: 'Contact Request Accepted',
        body: `${user.name} accepted your trusted contact request.`,
        data: {
          type: 'CONTACT_ACCEPTED',
          userId: user._id.toString()
        }
      });
    }

    res.json({ success: true, message: 'Contact request accepted' });
  } catch (error) {
    console.error('Error accepting contact request:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   POST /api/auth/contacts/reject
// @desc    Reject or remove a contact
router.post('/contacts/reject', protect, async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) {
      return res.status(400).json({ success: false, message: 'Missing contact ID' });
    }

    const user = await User.findById(req.user._id);
    const otherUser = await User.findById(contactId);

    // Remove from both lists
    user.contacts = user.contacts.filter(c => c.user.toString() !== contactId);
    if (otherUser) {
      otherUser.contacts = otherUser.contacts.filter(c => c.user.toString() !== req.user._id.toString());
      await otherUser.save();
    }

    await user.save();

    res.json({ success: true, message: 'Contact removed/request rejected successfully' });
  } catch (error) {
    console.error('Error removing contact:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   PUT /api/auth/fcm-token
// @desc    Register or update user FCM push token
router.put('/fcm-token', protect, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing token in request body' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.fcmToken = token;
    await user.save();

    console.log(`[FCM TOKEN ROUTE] Registered FCM token for user ${user.name} (${user._id})`);

    res.json({
      success: true,
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
