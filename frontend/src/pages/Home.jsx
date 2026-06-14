import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../components/Map';
import { getSocket } from '../socket';
import axios from 'axios';
import { registerFCMToken, initForegroundMessenger } from '../firebase';

const Home = () => {
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState(() => {
    const saved = localStorage.getItem('lastLocation');
    return saved ? JSON.parse(saved) : null;
  });
  const [address, setAddress] = useState(() => {
    const saved = localStorage.getItem('lastAddress');
    return saved || 'Fetching GPS position...';
  });
  const [trackingActive, setTrackingActive] = useState(() => {
    const saved = localStorage.getItem('trackingActive');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [geofences, setGeofences] = useState([]);
  const [contactsOnMap, setContactsOnMap] = useState([]);
  const [focusedContact, setFocusedContact] = useState(null);
  const [acceptedContactIds, setAcceptedContactIds] = useState([]);
  const [trackingMeContacts, setTrackingMeContacts] = useState([]);
  const [iTrackContactNames, setITrackContactNames] = useState([]);
  const [showContactsPanel, setShowContactsPanel] = useState(false);
  const [checkInActive, setCheckInActive] = useState(() => {
    const saved = localStorage.getItem('checkInActive');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [checkInDeadline, setCheckInDeadline] = useState(() => {
    const saved = localStorage.getItem('checkInDeadline');
    return saved || null;
  });
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

  const [sessionId, setSessionId] = useState(() => localStorage.getItem('sessionId') || null);
  const [trackingStartTime, setTrackingStartTime] = useState(() => {
    const saved = localStorage.getItem('trackingStartTime');
    return saved ? parseInt(saved, 10) : null;
  });
  const [trackingDuration, setTrackingDuration] = useState('');
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('trackingActive', JSON.stringify(trackingActive));
  }, [trackingActive]);

  useEffect(() => {
    localStorage.setItem('checkInActive', JSON.stringify(checkInActive));
  }, [checkInActive]);

  useEffect(() => {
    if (checkInDeadline) {
      localStorage.setItem('checkInDeadline', checkInDeadline);
    } else {
      localStorage.removeItem('checkInDeadline');
    }
  }, [checkInDeadline]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
    } else {
      localStorage.removeItem('sessionId');
    }
  }, [sessionId]);

  useEffect(() => {
    if (trackingStartTime) {
      localStorage.setItem('trackingStartTime', trackingStartTime.toString());
    } else {
      localStorage.removeItem('trackingStartTime');
    }
  }, [trackingStartTime]);

  // Compute tracking elapsed duration
  useEffect(() => {
    if (!trackingActive || !trackingStartTime) {
      setTrackingDuration('');
      return;
    }

    const updateDuration = () => {
      const elapsed = Date.now() - trackingStartTime;
      const totalSecs = Math.floor(elapsed / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setTrackingDuration(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [trackingActive, trackingStartTime]);

  // Tracks timestamp of the last successful location POST to throttle API calls
  const lastSentRef = useRef(0);
  const THROTTLE_INTERVAL_MS = 12000; // send at most once every 10-15 seconds for backend efficiency
  const socketRef = useRef(null);

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
      setTrackingStartTime(Date.now());
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

    // New emergency alert from a contact — navigate to the activity feed
    socket.on('emergencyAlert', (data) => {
      if (data.userId && data.userId !== userId) {
        navigate('/alerts');
      }
    });

    // Alert escalated — same treatment
    socket.on('alertEscalated', (data) => {
      if (data.userId && data.userId !== userId) {
        navigate('/alerts');
      }
    });

    // Contact marked safe — update their status on the map
    socket.on('userSafe', (data) => {
      setContactsOnMap((prev) => prev.map((c) =>
        c.id === data.userId ? { ...c, lastSeen: 'Online' } : c
      ));
    });

    // Safe zone entry/exit from a tracked friend
    socket.on('safeZoneEntry', (data) => {
      if (data.userId && data.userId !== userId) {
        navigate('/alerts');
      }
    });
    socket.on('safeZoneExit', (data) => {
      if (data.userId && data.userId !== userId) {
        navigate('/alerts');
      }
    });

    // Sharing session blocked — show a one-time alert
    socket.on('sharing_gate_blocked', (data) => {
      console.warn('[SHARING]', data.message);
    });

    return () => {
      socket.off('session_started');
      socket.off('locationUpdate');
      socket.off('user_status_change');
      socket.off('emergencyAlert');
      socket.off('alertEscalated');
      socket.off('userSafe');
      socket.off('safeZoneEntry');
      socket.off('safeZoneExit');
      socket.off('sharing_gate_blocked');
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

  // 1b. Fast low-accuracy position fill (1-3s via WiFi/cell) while GPS acquires
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const loc = { latitude, longitude, accuracy };
        setCurrentLocation(loc);
        localStorage.setItem('lastLocation', JSON.stringify(loc));
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }
    );
  }, []);

  // 2. Fetch user geolocation and watch movements
  useEffect(() => {
    if (!trackingActive || !userId) return;

    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const loc = { latitude, longitude, accuracy };
          setCurrentLocation(loc);
          localStorage.setItem('lastLocation', JSON.stringify(loc));

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

          const resolved = cleanAddr || data.display_name || 'Coordinates resolved';
          setAddress(resolved);
          localStorage.setItem('lastAddress', resolved);
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

  // 4. Fetch trusted contacts with directional awareness
  useEffect(() => {
    const fetchContactsForMap = async () => {
      try {
        const contactsRes = await axios.get('/api/auth/contacts');
        const allContacts = contactsRes.data.data || [];
        const currentUserId = localStorage.getItem('userId');

        // Separate by direction
        const iTrack = allContacts.filter(c => {
          if (c.status !== 'accepted') return false;
          return c.requestedBy === currentUserId;
        });

        const trackingMe = allContacts.filter(c => {
          if (c.status !== 'accepted') return false;
          return c.requestedBy && c.requestedBy !== currentUserId;
        });

        setTrackingMeContacts(trackingMe.map(c => ({
          userId: c.user?._id || c.userId,
          name: c.user?.name || c.name || 'Contact',
          online: c.user?.status === 'Online',
        })));

        setITrackContactNames(iTrack.map(c => ({
          userId: c.user?._id || c.userId,
          name: c.user?.name || c.name || 'Contact',
          online: c.user?.status === 'Online',
        })));

        // Join socket rooms only for iTrack contacts (whose locations I can see)
        const ids = iTrack
          .map(c => c.user?._id || c.userId)
          .filter(Boolean);
        setAcceptedContactIds(ids);

        // Fetch last known location for each iTrack contact
        const mapItems = await Promise.all(
          iTrack.map(async (contact) => {
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
              return null;
            }
          })
        );

        setContactsOnMap(mapItems.filter(Boolean));

        if (trackId) {
          const target = mapItems.find(item => item?.id === trackId);
          setFocusedContact(target || null);
        }
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
          focusedContact={focusedContact}
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

        {/* Trusted Contacts Panel */}
        {(iTrackContactNames.length > 0 || trackingMeContacts.length > 0) && (
          <div className="max-w-md w-full mt-2 pointer-events-auto">
            <button
              onClick={() => setShowContactsPanel(p => !p)}
              className="w-full glass-card rounded-lg px-4 py-2 border border-white/40 shadow-sm flex items-center justify-between gap-2 hover:bg-white/80 dark:hover:bg-surface-container-high/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">group</span>
                <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                  Trusted Contacts ({iTrackContactNames.length + trackingMeContacts.length})
                </span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-outline transition-transform" style={{ transform: showContactsPanel ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                expand_more
              </span>
            </button>
            {showContactsPanel && (
              <div className="glass-card rounded-lg mt-1 p-3 border border-white/40 shadow-sm space-y-3">
                {iTrackContactNames.length > 0 && (
                  <div>
                    <p className="font-label-sm text-label-sm text-secondary font-semibold mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">visibility</span> You Track
                    </p>
                    {iTrackContactNames.map(c => (
                      <div key={c.userId} className="flex items-center gap-2 py-1">
                        <span className={`w-2 h-2 rounded-full ${c.online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <span className="font-body-sm text-[13px] text-on-surface">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {trackingMeContacts.length > 0 && (
                  <div>
                    <p className="font-label-sm text-label-sm text-amber-600 font-semibold mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">visibility_off</span> Tracking You
                    </p>
                    {trackingMeContacts.map(c => (
                      <div key={c.userId} className="flex items-center gap-2 py-1">
                        <span className={`w-2 h-2 rounded-full ${c.online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <span className="font-body-sm text-[13px] text-on-surface">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] right-0 px-container-margin flex flex-col items-end gap-stack-md z-30 pointer-events-auto">
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
    </main>
  );
};

export default Home;
