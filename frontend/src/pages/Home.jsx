import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../components/Map';
import { getSocket } from '../socket';
import axios from 'axios';
import { registerFCMToken, initForegroundMessenger } from '../firebase';

const Home = () => {
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [address, setAddress] = useState('Fetching GPS position...');
  const [trackingActive, setTrackingActive] = useState(true);
  const [geofences, setGeofences] = useState([]);
  const [contactsOnMap, setContactsOnMap] = useState([]);
  const [acceptedContactIds, setAcceptedContactIds] = useState([]);
  const [checkInActive, setCheckInActive] = useState(false);
  const [checkInDeadline, setCheckInDeadline] = useState(null);
  const [checkInTimeLeft, setCheckInTimeLeft] = useState('');

  useEffect(() => {
    if (!checkInActive || !checkInDeadline) return;

    const updateTimer = () => {
      const msLeft = new Date(checkInDeadline).getTime() - Date.now();
      if (msLeft <= 0) {
        setCheckInActive(false);
        setCheckInDeadline(null);
        setCheckInTimeLeft('');
      } else {
        const totalSecs = Math.floor(msLeft / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setCheckInTimeLeft(`${mins}:${secs < 10 ? '0' + secs : secs}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [checkInActive, checkInDeadline]);

  const handleStartCheckIn = async (mins) => {
    try {
      const res = await axios.post('/api/sos/checkin/start', { durationMinutes: mins });
      if (res.data.success) {
        setCheckInDeadline(res.data.data.deadline);
        setCheckInActive(true);
      }
    } catch (err) {
      console.error('Error starting check-in timer:', err);
    }
  };

  const handleResolveCheckIn = async () => {
    try {
      const res = await axios.post('/api/sos/checkin/resolve');
      if (res.data.success) {
        setCheckInActive(false);
        setCheckInDeadline(null);
        setCheckInTimeLeft('');
      }
    } catch (err) {
      console.error('Error resolving check-in timer:', err);
    }
  };

  const userId = localStorage.getItem('userId');
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const SOCKET_URL = API_URL.replace('/api', '');

  // Tracks timestamp of the last successful location POST to throttle API calls
  const lastSentRef = useRef(0);
  const THROTTLE_INTERVAL_MS = 12000; // send at most once every 10-15 seconds for backend efficiency
  const socketRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const queryParams = new URLSearchParams(window.location.search);
  const trackId = queryParams.get('track');

  // Initialize Socket Connection & FCM Registration
  useEffect(() => {
    if (userId) {
      registerFCMToken();
      initForegroundMessenger();
    }
  }, [userId]);

  // Setup Socket Listeners
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    
    if (userId) {
      socket.emit('join_user_room', userId);
    }
    
    socket.on('session_started', (data) => {
      setSessionId(data.sessionId);
    });

    // Update position for ANY tracked contact on the map
    socket.on('locationUpdate', (data) => {
      setContactsOnMap((prev) => 
        prev.map((c) => {
          if (c.id === data.userId) {
            return {
              ...c,
              position: [data.latitude, data.longitude],
              lastSeen: 'Online',
            };
          }
          return c;
        })
      );
    });

    // Update online/offline status for any contact on the map
    socket.on('user_status_change', (data) => {
      setContactsOnMap((prev) => 
        prev.map((c) => {
          if (c.id === data.userId) {
            return {
              ...c,
              lastSeen: data.status,
            };
          }
          return c;
        })
      );
    });

    return () => {
      socket.off('session_started');
      socket.off('locationUpdate');
      socket.off('user_status_change');
    };
  }, [userId]);

  // 1. Fetch geofences to display circles on map
  useEffect(() => {
    if (!userId) return;
    const fetchGeofences = async () => {
      try {
        const res = await axios.get(`/api/geofences/list/${userId}`);
        if (res.data.success) {
          setGeofences(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching geofences for map:', err);
      }
    };
    fetchGeofences();
  }, [userId]);

  // 2. Fetch user geolocation and watch movements
  useEffect(() => {
    if (!trackingActive || !userId) return;

    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setCurrentLocation({ latitude, longitude, accuracy });

          // Throttle: only send if THROTTLE_INTERVAL_MS has elapsed
          const now = Date.now();
          if (now - lastSentRef.current >= THROTTLE_INTERVAL_MS) {
            lastSentRef.current = now;
            socketRef.current.emit('location_update', {
              userId,
              sessionId,
              latitude,
              longitude,
              accuracy
            });
          }
        },
        (err) => {
          console.error('Error accessing location:', err);
          setAddress('Location Access Denied');
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    } else {
      setAddress('Geolocation unsupported');
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [trackingActive, userId]);

  // 3. Resolve Coordinates to a readable street address using Nominatim (Reverse Geocoding)
  useEffect(() => {
    if (!currentLocation) return;

    const resolveAddress = async () => {
      try {
        const { latitude, longitude } = currentLocation;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'SafePulse-React-App'
            }
          }
        );
        const data = await res.json();

        if (data && data.address) {
          const addr = data.address;
          const cleanAddr = [
            addr.road || addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village || addr.county
          ].filter(Boolean).join(', ');

          setAddress(cleanAddr || data.display_name || 'Coordinates resolved');
        } else {
          setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      } catch (err) {
        console.error('Error reverse geocoding:', err);
        setAddress(`${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`);
      }
    };

    resolveAddress();
  }, [currentLocation]);

  // 4. Fetch ALL accepted trusted contacts and place them on the map
  useEffect(() => {
    const fetchContactsForMap = async () => {
      try {
        const contactsRes = await axios.get('/api/auth/contacts');
        const allContacts = contactsRes.data.data || [];
        const accepted = allContacts.filter(c => c.status === 'accepted');

        // Track their IDs for socket room joining
        const ids = accepted
          .map(c => c.user?._id || c.userId)
          .filter(Boolean);
        setAcceptedContactIds(ids);

        // Fetch last known location for each accepted contact in parallel
        const mapItems = await Promise.all(
          accepted.map(async (contact) => {
            const contactUserId = contact.user?._id || contact.userId;
            if (!contactUserId) return null;
            const name = contact.user?.name || contact.name || 'Contact';
            const isOnline = contact.user?.status === 'Online';
            try {
              const historyRes = await axios.get(`/api/location/history/${contactUserId}?limit=1`);
              const lastLoc = historyRes.data.data?.[0];
              if (!lastLoc) return null;
              return {
                id: contactUserId,
                name,
                position: [lastLoc.latitude, lastLoc.longitude],
                lastSeen: isOnline ? 'Online' : 'Offline',
              };
            } catch {
              return null; // No location data — skip silently
            }
          })
        );

        setContactsOnMap(mapItems.filter(Boolean));
      } catch (err) {
        console.error('Error fetching contacts for map:', err);
      }
    };

    fetchContactsForMap();
  }, [trackId]);

  // 5. Join socket rooms for all accepted contacts to receive live location updates
  useEffect(() => {
    if (!acceptedContactIds.length) return;
    const socket = getSocket();
    // Join each accepted contact's socket room to receive their location updates
    acceptedContactIds.forEach(id => socket.emit('track_contact', id));
    return () => {
      acceptedContactIds.forEach(id => socket.emit('untrack_contact', id));
    };
  }, [acceptedContactIds]);

  return (
    <main className="flex-grow relative w-full pt-16 pb-20 overflow-hidden h-screen">
      {/* Real Interactive Leaflet Map */}
      <div className="absolute inset-0 z-0">
        <MapComponent 
          center={currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null}
          contacts={contactsOnMap}
          geofences={geofences}
          trackingActive={trackingActive}
          recenterTrigger={recenterTrigger}
        />
      </div>

      {/* Overlays Layer */}
      <div className="relative z-10 p-container-margin h-full pointer-events-none flex flex-col">
        {/* AI Insight Card */}
        <div 
          onClick={() => navigate('/assistant')}
          className="max-w-md w-full glass-card rounded-lg p-stack-md border border-white/40 shadow-sm pointer-events-auto flex items-center gap-stack-md cursor-pointer hover:bg-white/80 dark:hover:bg-surface-container-high/80 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined">auto_awesome</span>
          </div>
          <div className="flex-grow">
            <p className="font-label-md text-label-md text-primary">
              {trackingActive ? 'You are on a safe route' : 'Live Tracking Paused'}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant line-clamp-1">
              {address}
            </p>
          </div>
          <span className="material-symbols-outlined text-outline">chevron_right</span>
        </div>
      </div>

      {/* Bottom Controls: Card & FABs side by side */}
      <div className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 w-full px-container-margin flex justify-between items-end gap-4 z-30 pointer-events-none">
        {/* Active Sharing Session Card */}
        <div className="flex-1 max-w-[260px] glass-card rounded-lg p-stack-md border border-white/40 shadow-lg pointer-events-auto">
          <div className="flex justify-between items-center mb-stack-sm">
            <span className="font-label-md text-label-md text-secondary">Live Tracking</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${trackingActive ? 'bg-error animate-pulse' : 'bg-outline/40'}`}></div>
              <span className={`font-label-sm text-label-sm ${trackingActive ? 'text-error' : 'text-on-surface-variant'}`}>
                {trackingActive ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>
          <p className="font-headline-md text-headline-md font-bold mb-stack-sm">
            {trackingActive ? '00:42:15' : '--:--:--'}
          </p>

          <button 
            onClick={() => {
              if (trackingActive) {
                socketRef.current.emit('end_session', { userId, sessionId });
                setTrackingActive(false);
                setSessionId(null);
              } else {
                setTrackingActive(true);
                if (currentLocation) {
                  socketRef.current.emit('start_session', { 
                    userId, 
                    latitude: currentLocation.latitude, 
                    longitude: currentLocation.longitude 
                  });
                }
              }
            }}
            className={`w-full py-stack-md rounded-full font-label-md transition-colors pointer-events-auto mb-2 ${
              trackingActive ? 'bg-primary text-on-primary hover:opacity-90' : 'bg-secondary text-white hover:opacity-95'
            }`}
          >
            {trackingActive ? 'End Session' : 'Start Session'}
          </button>

          {checkInActive ? (
            <div className="mt-2 border-t border-black/10 dark:border-white/10 pt-2 pointer-events-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="font-label-sm text-xs text-secondary">Check-In</span>
                <span className="font-label-sm text-xs font-bold text-error animate-pulse">{checkInTimeLeft}</span>
              </div>
              <button 
                onClick={handleResolveCheckIn}
                className="w-full py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-label-md"
              >
                Check In Safe
              </button>
            </div>
          ) : (
            <div className="mt-2 border-t border-black/10 dark:border-white/10 pt-2 flex gap-1 pointer-events-auto">
              <button 
                onClick={() => handleStartCheckIn(15)}
                className="flex-1 py-1 text-[10px] bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 transition-colors font-label-sm"
              >
                +15m
              </button>
              <button 
                onClick={() => handleStartCheckIn(30)}
                className="flex-1 py-1 text-[10px] bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 transition-colors font-label-sm"
              >
                +30m
              </button>
            </div>
          )}
        </div>

        {/* Floating Action Buttons */}
        <div className="flex flex-col items-end gap-stack-md pointer-events-auto flex-shrink-0">
        {/* Recenter FAB */}
        <button
          onClick={() => setRecenterTrigger(t => t + 1)}
          className="w-14 h-14 flex items-center justify-center bg-white/80 dark:bg-surface-container-high/90 backdrop-blur-md text-primary rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all border border-white/40"
          title="Recenter Map"
        >
          <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>my_location</span>
        </button>
        {/* Quick Share FAB */}
        <button 
          onClick={() => navigate('/tracking')}
          className="w-14 h-14 flex items-center justify-center bg-secondary text-on-secondary rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
          title="Quick Share"
        >
          <span className="material-symbols-outlined">share</span>
        </button>
        {/* Large SOS Button */}
        <button 
          onClick={() => {
            navigate('/sos');
          }}
          className="w-20 h-20 rounded-full bg-error text-on-error flex flex-col items-center justify-center sos-glow hover:scale-110 active:scale-90 transition-all pointer-events-auto"
        >
          <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>sos</span>
          <span className="font-label-sm text-label-sm font-extrabold uppercase tracking-widest mt-0.5">SOS</span>
        </button>
      </div>
      </div>
    </main>
  );
};

export default Home;
