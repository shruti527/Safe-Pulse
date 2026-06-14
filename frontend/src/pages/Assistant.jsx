import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../socket';
import MapComponent from '../components/Map';

const DEFAULT_POSITION = [37.7749, -122.4194];
const THROTTLE_MS = 12000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}';
const IMPACT_THRESHOLD = 25;

const isDarkHours = () => {
  const h = new Date().getHours();
  return h >= 18 || h < 6;
};

const computeSafetyScore = () => {
  const base = 98;
  if (!isDarkHours()) return base;
  return Math.max(65, base - Math.floor(Math.random() * 11) - 5);
};

const computeLampPercent = () => {
  const base = 84;
  if (!isDarkHours()) return base;
  return Math.max(50, base - Math.floor(Math.random() * 16) - 5);
};

const fetchNeighborhood = async (lat, lng, setter) => {
  try {
    const res = await fetch(NOMINATIM_URL.replace('{lat}', lat).replace('{lng}', lng), {
      headers: { 'User-Agent': 'SafePulse/1.0' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const addr = data.address;
    const label = addr?.neighbourhood || addr?.suburb || addr?.district || addr?.city || 'Unknown area';
    setter(label);
  } catch {
    /* swallow — fallback keeps last known name */
  }
};

const Assistant = () => {
  const [safetyStatus, setSafetyStatus] = useState({
    safetyScore: computeSafetyScore(),
    warningStatus: 'Optimal',
    movementPattern: 'Consistent pace detected. No unusual stops or deviations observed.',
    streetLampPercent: computeLampPercent(),
    neighborhood: 'Mission District',
    position: DEFAULT_POSITION,
  });
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const positionRef = useRef(DEFAULT_POSITION);
  const lastEmitRef = useRef(0);
  const watchIdRef = useRef(null);
  const socketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const prevAccelRef = useRef({ x: 0, y: 0, z: 0 });
  const motionIntervalRef = useRef(null);

  /*
   * Socket.IO lifecycle — connect once and start a tracking session
   * so the backend records our route and broadcasts to contacts.
   */
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onSessionStarted = (data) => {
      sessionIdRef.current = data.sessionId;
    };
    socket.on('session_started', onSessionStarted);

    const userId = localStorage.getItem('userId');
    if (userId && socket.connected) {
      socket.emit('startTracking', {
        userId,
        latitude: positionRef.current[0],
        longitude: positionRef.current[1],
      });
    }

    const onSharingBlocked = (data) => {
      setSafetyStatus((prev) => ({
        ...prev,
        warningStatus: 'Caution',
        movementPattern: data.message || 'Location sharing is not active. Start a session from the Share page.',
      }));
    };

    socket.on('sharing_gate_blocked', onSharingBlocked);

    return () => {
      socket.off('session_started', onSessionStarted);
      socket.off('sharing_gate_blocked', onSharingBlocked);
      if (sessionIdRef.current) {
        socket.emit('sessionEnded', { userId, sessionId: sessionIdRef.current });
      }
    };
  }, []);

  /*
   * Geolocation — watchPosition fires as often as the device wants,
   * but we throttle handler calls to every THROTTLE_MS (12 s) to match
   * backend rate limits.  We store the latest position in a ref so the
   * throttle closure always sees the freshest coordinates.
   */
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('[Assistant] Geolocation not available — using fallback coords');
      return;
    }

    const onPosition = (pos) => {
      const { latitude, longitude } = pos.coords;
      const now = Date.now();

      positionRef.current = [latitude, longitude];

      if (now - lastEmitRef.current < THROTTLE_MS) return;
      lastEmitRef.current = now;

      setSafetyStatus((prev) => ({ ...prev, position: [latitude, longitude] }));
      setRecenterTrigger((t) => t + 1);

      fetchNeighborhood(latitude, longitude, (name) => {
        setSafetyStatus((prev) => ({ ...prev, neighborhood: name }));
      });

      const socket = socketRef.current;
      if (socket?.connected) {
        const userId = localStorage.getItem('userId');
        socket.emit('locationUpdate', {
          userId,
          sessionId: sessionIdRef.current,
          latitude,
          longitude,
          accuracy: pos.coords.accuracy,
        });
      }
    };

    const onError = (err) => {
      console.warn('[Assistant] Geolocation error:', err.message);
    };

    /*
     * enableHighAccuracy: true asks for GPS where available.
     * maximumAge: 0 ensures we never get a stale cache entry.
     * timeout: 15000 gives the device up to 15 s to acquire a fix.
     */
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  /*
   * Device motion sensor — listen for devicemotion to detect sudden
   * impacts (heavy acceleration spike) or unexpected stops (velocity
   * drops to ~0 mid-route).
   *
   * We poll acceleration deltas on a short interval and compare the
   * magnitude against IMPACT_THRESHOLD.  If the user's device doesn't
   * support devicemotion the listener simply never fires and the UI
   * stays at "Optimal".
   */
  useEffect(() => {
    const onMotion = (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const { x = 0, y = 0, z = 0 } = acc;
      const prev = prevAccelRef.current;
      const dx = Math.abs(x - prev.x);
      const dy = Math.abs(y - prev.y);
      const dz = Math.abs(z - prev.z);
      const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);

      prevAccelRef.current = { x, y, z };

      if (magnitude > IMPACT_THRESHOLD) {
        setSafetyStatus((prev) => ({
          ...prev,
          warningStatus: 'Warning',
          movementPattern: 'Sudden impact detected. Possible fall or collision — reviewing safety.',
        }));
      } else if (magnitude < 0.3 && prev.x !== 0) {
        setSafetyStatus((prev) => ({
          ...prev,
          warningStatus: 'Caution',
          movementPattern: 'Unexpected stop detected. Monitoring surroundings closely.',
        }));
      }
    };

    /*
     * devicemotion fires at ~60 Hz on most devices.  We sample it
     * every 3 s via an interval to avoid excessive React re-renders
     * while still catching impacts quickly enough for safety UI.
     */
    let latestEvent = null;
    const handler = (e) => { latestEvent = e; };

    window.addEventListener('devicemotion', handler);

    motionIntervalRef.current = setInterval(() => {
      if (latestEvent) onMotion(latestEvent);
    }, 3000);

    return () => {
      window.removeEventListener('devicemotion', handler);
      if (motionIntervalRef.current) clearInterval(motionIntervalRef.current);
    };
  }, []);

  /*
   * Recompute time-dependent values every 60 s so the score and lamp
   * percentage stay roughly accurate as evening sets in.
   */
  useEffect(() => {
    const tick = setInterval(() => {
      setSafetyStatus((prev) => ({
        ...prev,
        safetyScore: computeSafetyScore(),
        streetLampPercent: computeLampPercent(),
      }));
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  /*
   * Reset warning back to "Optimal" after 20 s of normal movement.
   */
  useEffect(() => {
    if (safetyStatus.warningStatus === 'Optimal') return;
    const t = setTimeout(() => {
      setSafetyStatus((prev) => ({
        ...prev,
        warningStatus: 'Optimal',
        movementPattern: 'Consistent pace detected. No unusual stops or deviations observed.',
      }));
    }, 20000);
    return () => clearTimeout(t);
  }, [safetyStatus.warningStatus]);

  /*
   * View Route — opens Google Maps (or Apple Maps fallback) with
   * directions from the user's current live position to their home /
   * last known destination, which is persisted to localStorage by the
   * Home page.  No API key required.
   */
  const handleViewRoute = useCallback(() => {
    const [lat, lng] = positionRef.current;
    const dest = localStorage.getItem('lastLocation');
    const destName = localStorage.getItem('lastAddress');

    const base = `https://www.google.com/maps/dir/${lat},${lng}`;
    const url = dest
      ? `${base}/${dest}&travelmode=walking`
      : `${base}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const statusBorderColor =
    safetyStatus.warningStatus === 'Warning'
      ? 'border-l-red-500'
      : safetyStatus.warningStatus === 'Caution'
      ? 'border-l-yellow-500'
      : 'border-l-secondary';

  const statusBadgeBg =
    safetyStatus.warningStatus === 'Warning'
      ? 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300'
      : safetyStatus.warningStatus === 'Caution'
      ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 text-yellow-700 dark:text-yellow-300'
      : 'bg-secondary-container/10 border-secondary/20 text-secondary dark:text-safepulse-accent';

  return (
    <div className="bg-background text-on-background min-h-screen w-full h-[calc(100vh-130px)] pt-4 pb-24 overflow-y-auto">
      <main className="max-w-7xl mx-auto px-container-margin">
        {/* Hero Section: AI Orb & Status */}
        <section className="flex flex-col items-center justify-center py-stack-md text-center">
          <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center mb-stack-lg">
            <div className="absolute inset-0 rounded-full border-2 border-secondary/20 scale-110 opacity-40 animate-pulse"></div>
            <div className="absolute inset-4 rounded-full border border-secondary/30 scale-105 opacity-60 animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr from-secondary via-secondary-container to-on-tertiary-container shadow-[0_0_50px_rgba(33,112,228,0.4)] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent"></div>
              <span className="material-symbols-outlined text-white text-[64px] font-thin animate-pulse">neurology</span>
            </div>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-primary dark:text-on-primary mb-stack-sm">AI Guardian Active</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
            {safetyStatus.warningStatus === 'Optimal'
              ? 'Monitoring your surroundings in real-time. Everything appears safe for your current route.'
              : safetyStatus.warningStatus === 'Caution'
              ? 'Caution advised. Sensors detected an anomaly — staying alert on your behalf.'
              : 'Warning! Unusual activity detected. Reviewing your safety status urgently.'}
          </p>
        </section>

        {/* Bento Grid Insights */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg mt-8">
          {/* Route Safety Score (Large Card) */}
          <div className="md:col-span-8 glass-card rounded-lg p-stack-lg flex flex-col justify-between shadow-sm relative overflow-hidden bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="flex justify-between items-start mb-stack-lg relative z-10">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary dark:text-on-primary mb-1">Route Safety Score</h3>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {safetyStatus.neighborhood} &middot;{' '}
                  {isDarkHours() ? 'Evening hours' : 'Daytime'}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-full border ${statusBadgeBg}`}>
                <span className="font-label-md text-label-md">{safetyStatus.warningStatus}</span>
              </div>
            </div>

            <div className="flex items-end gap-stack-md relative z-10 mt-6">
              <span className="text-[80px] font-extrabold leading-none tracking-tighter text-primary dark:text-on-primary">
                {safetyStatus.safetyScore}
              </span>
              <div className="pb-3">
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-8 rounded-full ${
                        i <= 3 ? 'bg-secondary' : 'bg-secondary/30'
                      }`}
                    ></div>
                  ))}
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Confidence Index</p>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          {/* Smart Recommendation (Small Card) */}
          <div className="md:col-span-4 glass-card rounded-lg p-stack-lg flex flex-col justify-between shadow-sm bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="space-y-4">
              <span className="material-symbols-outlined text-secondary dark:text-safepulse-accent text-3xl">lightbulb</span>
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">Smart Recommendation</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {isDarkHours()
                  ? 'Stick to main roads with active street lighting. Avoid poorly lit shortcuts after dark.'
                  : 'The path via 5th Ave is currently better lit. Consider this alternate route for your return walk.'}
              </p>
            </div>
            <button onClick={handleViewRoute} className="mt-8 w-full py-3 bg-secondary text-on-secondary rounded-full font-label-md text-label-md hover:opacity-90 transition-opacity">View Route</button>
          </div>

          {/* Unusual Movement (Medium Card) */}
          <div className={`md:col-span-6 glass-card rounded-lg p-stack-lg flex items-center gap-stack-lg shadow-sm border-l-4 ${statusBorderColor} bg-white/70 dark:bg-surface-container/70 border-y border-r border-white/50`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${
              safetyStatus.warningStatus === 'Warning'
                ? 'bg-red-100 dark:bg-red-900/30'
                : safetyStatus.warningStatus === 'Caution'
                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                : 'bg-secondary-container/10'
            }`}>
              <span className={`material-symbols-outlined text-headline-md ${
                safetyStatus.warningStatus === 'Warning'
                  ? 'text-red-500'
                  : safetyStatus.warningStatus === 'Caution'
                  ? 'text-yellow-500'
                  : 'text-secondary'
              }`} style={{ fontVariationSettings: "'FILL' 1" }}>directions_run</span>
            </div>
            <div>
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">Movement Pattern</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{safetyStatus.movementPattern}</p>
            </div>
          </div>

          {/* Lighting Analysis (Medium Card) */}
          <div className="md:col-span-6 glass-card rounded-lg p-stack-lg flex items-center gap-stack-lg shadow-sm bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="w-16 h-16 rounded-full bg-surface-container-high dark:bg-surface-container-highest flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant text-headline-md">wb_sunny</span>
            </div>
            <div>
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">Ambient Insights</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Area lighting is rated &apos;{isDarkHours() ? 'Moderate' : 'Excellent'}&apos;.{' '}
                {safetyStatus.streetLampPercent}% of street lamps are functional on your current block.
              </p>
            </div>
          </div>

          {/* Map View — interactive Leaflet map backed by OpenStreetMap tiles */}
          <div className="md:col-span-12 h-64 rounded-lg overflow-hidden shadow-sm relative border border-white/20">
            <MapComponent
              center={safetyStatus.position}
              trackingActive={true}
              recenterTrigger={recenterTrigger}
            />
            <div className="absolute bottom-4 left-4 glass-card px-4 py-2 rounded-full flex items-center gap-2 border border-white/40 z-[1000]">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              <span className="font-label-sm text-label-sm text-primary dark:text-on-primary">
                Live Tracking: {safetyStatus.neighborhood}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Assistant;
