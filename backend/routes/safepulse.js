const express = require('express');
const router = express.Router();

const geofenceRoutes = require('./geofence');
const locationRoutes = require('./location');
const sosRoutes = require('./sos');

router.use('/geofences', geofenceRoutes);
router.use('/location', locationRoutes);
router.use('/sos', sosRoutes);

module.exports = router;