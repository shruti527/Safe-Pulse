import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import TopAppBar from './components/TopAppBar';
import BottomNavBar from './components/BottomNavBar';
import Home from './pages/Home';
import Contacts from './pages/Contacts';
import SOS from './pages/SOS';
import SafeZones from './pages/SafeZones';
// Share.jsx is a standalone page — TemporarySharing is used for both /share and /tracking
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import Register from './pages/Register';
import Assistant from './pages/Assistant';
import TemporarySharing from './pages/TemporarySharing';

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const hideNavPaths = ['/splash', '/onboarding', '/login', '/register', '/sos'];
  const shouldHideNav = hideNavPaths.includes(location.pathname);

  React.useEffect(() => {
    const handleNotificationClick = (e) => {
      const data = e.detail;
      console.log('[APP] Foreground notification click handler triggered:', data);
      if (data) {
        if (data.type === 'SOS_ALERT' || data.type === 'ALERT_ESCALATED' || data.type === 'MISSED_CHECKIN') {
          navigate(`/sos?alertId=${data.alertId || ''}&userId=${data.userId || ''}`);
        } else if (data.type === 'CONTACT_REQUEST') {
          navigate('/contacts');
        }
      }
    };

    window.addEventListener('safepulse-notification-click', handleNotificationClick);
    return () => window.removeEventListener('safepulse-notification-click', handleNotificationClick);
  }, [navigate]);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-surface dark:bg-safepulse-dark">
      {!shouldHideNav && <TopAppBar />}
      <Routes>
        {/* Public routes — accessible without authentication */}
        <Route path="/splash" element={<Splash />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes — redirect to /login if no token */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
        <Route path="/share" element={<ProtectedRoute><TemporarySharing /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/zones" element={<ProtectedRoute><SafeZones /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/sos" element={<ProtectedRoute><SOS /></ProtectedRoute>} />
        <Route path="/tracking" element={<ProtectedRoute><TemporarySharing /></ProtectedRoute>} />
      </Routes>
      {!shouldHideNav && <BottomNavBar />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
