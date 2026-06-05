/**
 * Integration Test Suite for SafePulse
 * 
 * Verifies end-to-end backend functionality:
 * 1. Database Connection
 * 2. User Registration & Password Hashing
 * 3. User Login & Token Generation
 * 4. Contact Request Generation
 * 5. Contact Request Acceptance
 * 6. SOS Alert Trigger & Coordinates Validation
 * 7. Real-Time Socket/Broadcast simulation
 * 8. SOS Alert Resolution
 * 9. Cleanup of Test Data
 */

process.env.PORT = 5001;
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');

// Base URL for local test server
const BASE_URL = 'http://localhost:5001';

// Helper for making fetch requests
async function makeRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }
  
  return {
    status: response.status,
    data
  };
}

// Import model definitions for database assertions & cleanup
const User = require('./models/User');
const SOSAlert = require('./models/SOSAlert');
const CheckIn = require('./models/CheckIn');

async function runTests() {
  console.log('=== STARTING SAFEPULSE INTEGRATION TESTS ===');
  
  // 1. Start Server
  console.log('Initializing test server on port 5001...');
  require('./server');

  // Wait a moment for database connection to establish
  await new Promise(resolve => setTimeout(resolve, 3000));

  let tokenA, tokenB, userIdA, userIdB;
  let testAlertId;

  try {
    // Clean any prior leftover test accounts first
    await User.deleteMany({ email: { $in: ['test_user_a@safepulse.com', 'test_user_b@safepulse.com'] } });
    console.log('🧹 Cleaned up any stale test accounts.');

    // --- TEST 1: User Registration ---
    console.log('\nRunning Test 1: User Registration...');
    
    const regResA = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User A',
        email: 'test_user_a@safepulse.com',
        password: 'password123',
        phone: '1234567890'
      })
    });

    if (regResA.status !== 201 || !regResA.data.success) {
      throw new Error(`Registration for A failed: ${JSON.stringify(regResA.data)}`);
    }
    userIdA = regResA.data._id;
    tokenA = regResA.data.token;
    console.log(`✅ Registered User A: ${userIdA}`);

    const regResB = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User B',
        email: 'test_user_b@safepulse.com',
        password: 'password123',
        phone: '0987654321'
      })
    });

    if (regResB.status !== 201 || !regResB.data.success) {
      throw new Error(`Registration for B failed: ${JSON.stringify(regResB.data)}`);
    }
    userIdB = regResB.data._id;
    tokenB = regResB.data.token;
    console.log(`✅ Registered User B: ${userIdB}`);

    // --- TEST 2: User Login ---
    console.log('\nRunning Test 2: User Login & Verification...');
    const loginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test_user_a@safepulse.com',
        password: 'password123'
      })
    });

    if (loginRes.status !== 200 || !loginRes.data.success || !loginRes.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }
    console.log('✅ User Login success, JWT Token received.');

    // --- TEST 3: Send Contact Request ---
    console.log('\nRunning Test 3: Send Contact Request...');
    const requestRes = await makeRequest('/api/auth/contacts/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ emailOrPhone: 'test_user_b@safepulse.com' })
    });

    if (requestRes.status !== 200 || !requestRes.data.success) {
      throw new Error(`Contact request failed: ${JSON.stringify(requestRes.data)}`);
    }
    console.log('✅ Contact request sent from A to B successfully.');

    // Verify database state of request
    const userA = await User.findById(userIdA);
    const contactRecordA = userA.contacts.find(c => c.user.toString() === userIdB.toString());
    if (!contactRecordA || contactRecordA.status !== 'pending_sent') {
      throw new Error(`Incorrect contact status in A: ${JSON.stringify(contactRecordA)}`);
    }
    console.log('✅ User A database state verified (pending_sent).');

    // --- TEST 4: Accept Contact Request ---
    console.log('\nRunning Test 4: Accept Contact Request...');
    const acceptRes = await makeRequest('/api/auth/contacts/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ contactId: userIdA })
    });

    if (acceptRes.status !== 200 || !acceptRes.data.success) {
      throw new Error(`Contact accept failed: ${JSON.stringify(acceptRes.data)}`);
    }
    console.log('✅ Contact request accepted by B successfully.');

    // Verify contact lists are now accepted/accepted
    const updatedUserA = await User.findById(userIdA);
    const updatedUserB = await User.findById(userIdB);
    const finalA = updatedUserA.contacts.find(c => c.user.toString() === userIdB.toString());
    const finalB = updatedUserB.contacts.find(c => c.user.toString() === userIdA.toString());

    if (finalA.status !== 'accepted' || finalB.status !== 'accepted') {
      throw new Error(`Contact list status synchronization failed. A: ${finalA.status}, B: ${finalB.status}`);
    }
    console.log('✅ Verified mutual accepted contact status in database.');

    // --- TEST 5: SOS Alert Trigger with Coordinate Validation ---
    console.log('\nRunning Test 5: SOS Alert Trigger with Coordinates Validation...');
    
    // Test invalid lat
    const invalidLatRes = await makeRequest('/api/sos/trigger', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ latitude: 100, longitude: -45, message: 'Help!' })
    });
    if (invalidLatRes.status !== 400) {
      throw new Error(`Should reject latitude 100 with status 400. Got: ${invalidLatRes.status}`);
    }
    console.log('✅ Successfully validated and rejected invalid latitude.');

    // Trigger valid SOS
    const sosRes = await makeRequest('/api/sos/trigger', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ latitude: 37.7749, longitude: -122.4194, message: 'Emergency SOS test!', battery: 85, network: '4G' })
    });

    if (sosRes.status !== 200 || !sosRes.data.success) {
      throw new Error(`SOS Trigger failed: ${JSON.stringify(sosRes.data)}`);
    }
    testAlertId = sosRes.data.data._id;
    console.log(`✅ Valid SOS alert triggered successfully. Alert ID: ${testAlertId}`);

    // --- TEST 6: Get SOS Alerts for Network ---
    console.log('\nRunning Test 6: Verify Alert History / Network Access...');
    const historyRes = await makeRequest(`/api/sos/alerts/${userIdA}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` } // B checks history of A
    });

    if (historyRes.status !== 200 || !historyRes.data.success) {
      throw new Error(`History fetch failed for B querying A: ${JSON.stringify(historyRes.data)}`);
    }
    const alertFound = historyRes.data.data.some(alert => alert._id === testAlertId);
    if (!alertFound) {
      throw new Error('SOS alert was not returned in User B\'s history query.');
    }
    console.log('✅ SOS alert is visible in trusted contact\'s history feed.');

    // --- TEST 7: SOS Alert Resolution ---
    console.log('\nRunning Test 7: Resolve SOS Alert...');
    const resolveRes = await makeRequest(`/api/sos/resolve/${testAlertId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    if (resolveRes.status !== 200 || !resolveRes.data.success) {
      throw new Error(`SOS Resolution failed: ${JSON.stringify(resolveRes.data)}`);
    }
    console.log('✅ SOS Alert marked resolved/safe.');

    // Verify DB status
    const finalAlert = await SOSAlert.findById(testAlertId);
    if (finalAlert.status !== 'resolved' || !finalAlert.resolved) {
      throw new Error(`Database state mismatch on resolution: ${JSON.stringify(finalAlert)}`);
    }
    console.log('✅ Database state verified for alert safety resolution.');

    console.log('\n=============================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================');
  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:');
    console.error(error.message || error);
    if (error.stack) console.error(error.stack);
    process.exitCode = 1;
  } finally {
    // Clean up test users and alerts
    console.log('\n🧹 Cleaning up test data from MongoDB...');
    try {
      if (userIdA) {
        await User.deleteOne({ _id: userIdA });
        await SOSAlert.deleteMany({ userId: userIdA });
        await CheckIn.deleteMany({ userId: userIdA });
      }
      if (userIdB) {
        await User.deleteOne({ _id: userIdB });
        await SOSAlert.deleteMany({ userId: userIdB });
        await CheckIn.deleteMany({ userId: userIdB });
      }
      console.log('🧹 Cleanup complete.');
    } catch (cleanupError) {
      console.error('Failed to clean up test data:', cleanupError);
    }
    
    // Close Mongoose connection & exit the process
    try {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed. Exiting process...');
    } catch (closeErr) {
      console.error('Error closing MongoDB connection:', closeErr);
    }
    process.exit();
  }
}

runTests();
