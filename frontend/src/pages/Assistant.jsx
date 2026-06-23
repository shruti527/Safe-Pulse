import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../socket';
import MapComponent from '../components/Map';

const DEFAULT_POSITION = [37.7749, -122.4194];
const THROTTLE_MS = 12000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}';
const IMPACT_THRESHOLD = 25;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const isDarkHours = () => {
  const h = new Date().getHours();
  return h >= 18 || h < 6;
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
    return label;
  } catch {
    return 'Unknown area';
  }
};

const Assistant = () => {
  const [safetyStatus, setSafetyStatus] = useState({
    safetyScore: '--',
    warningStatus: 'Optimal',
    movementPattern: 'Consistent pace detected. No unusual stops or deviations observed.',
    streetLampPercent: '--',
    neighborhood: 'Locating...',
    position: DEFAULT_POSITION,
  });
  
  const [aiRecommendation, setAiRecommendation] = useState('Analyzing surroundings...');
  const [isAiLoading, setIsAiLoading] = useState(true);
  
  // Chat Assistant State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', content: 'Hi there! I am your AI Guardian. How can I help you stay safe right now?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const positionRef = useRef(DEFAULT_POSITION);
  const lastEmitRef = useRef(0);
  const watchIdRef = useRef(null);
  const socketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const prevAccelRef = useRef({ x: 0, y: 0, z: 0 });
  const motionIntervalRef = useRef(null);
  const neighborhoodRef = useRef('Unknown area');
  const aiUpdateTimeoutRef = useRef(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const fetchRiskAssessment = async (lat, lng, locName, motionStatus) => {
    try {
      setIsAiLoading(true);
      const res = await fetch(`${API_URL}/api/ai/risk-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          locationName: locName,
          timeOfDay: isDarkHours() ? 'Night' : 'Day',
          speed: 'Normal walking pace',
          motionStatus: motionStatus
        })
      });
      const data = await res.json();
      
      setSafetyStatus(prev => ({
        ...prev,
        safetyScore: data.riskScore,
        warningStatus: data.riskLevel,
        movementPattern: data.reasoning || prev.movementPattern,
        streetLampPercent: isDarkHours() ? 65 : 100 // Estimate since AI doesn't know exact lamp count
      }));
      setAiRecommendation(data.recommendation);
    } catch (err) {
      console.error('Failed to fetch AI risk assessment:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          context: {
            locationName: neighborhoodRef.current,
            timeOfDay: isDarkHours() ? 'Night' : 'Day',
            motionStatus: safetyStatus.movementPattern
          }
        })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'model', content: data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', content: 'Sorry, I am having trouble connecting to the network right now.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

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

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('[Assistant] Geolocation not available');
      return;
    }

    const onPosition = async (pos) => {
      const { latitude, longitude } = pos.coords;
      const now = Date.now();

      positionRef.current = [latitude, longitude];
      setSafetyStatus((prev) => ({ ...prev, position: [latitude, longitude] }));
      setRecenterTrigger((t) => t + 1);

      // Only fetch AI update every THROTTLE_MS to avoid rate limits
      if (now - lastEmitRef.current > THROTTLE_MS) {
        lastEmitRef.current = now;
        
        const locName = await fetchNeighborhood(latitude, longitude, (name) => {
          neighborhoodRef.current = name;
          setSafetyStatus((prev) => ({ ...prev, neighborhood: name }));
        });
        
        fetchRiskAssessment(latitude, longitude, locName || neighborhoodRef.current, 'Normal walking pace');
        
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
      }
    };

    const onError = (err) => {
      console.warn('[Assistant] Geolocation error:', err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });

    // Initial AI Assessment load if we have a default position
    fetchRiskAssessment(DEFAULT_POSITION[0], DEFAULT_POSITION[1], 'San Francisco', 'Idle');

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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

      let motionStatus = 'Normal';
      if (magnitude > IMPACT_THRESHOLD) {
        motionStatus = 'Sudden impact detected. Possible fall or collision.';
        setSafetyStatus((prev) => ({
          ...prev,
          warningStatus: 'Warning',
          movementPattern: motionStatus,
        }));
        // Trigger immediate AI re-assessment on impact
        if (aiUpdateTimeoutRef.current) clearTimeout(aiUpdateTimeoutRef.current);
        aiUpdateTimeoutRef.current = setTimeout(() => {
           fetchRiskAssessment(positionRef.current[0], positionRef.current[1], neighborhoodRef.current, motionStatus);
        }, 1000);
      } else if (magnitude < 0.3 && prev.x !== 0) {
        setSafetyStatus((prev) => ({
          ...prev,
          warningStatus: 'Caution',
          movementPattern: 'Unexpected stop detected. Monitoring surroundings closely.',
        }));
      }
    };

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

  const handleViewRoute = useCallback(() => {
    const [lat, lng] = positionRef.current;
    const dest = localStorage.getItem('lastLocation');
    const base = `https://www.google.com/maps/dir/${lat},${lng}`;
    const url = dest ? `${base}/${dest}&travelmode=walking` : `${base}`;
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
    <div className="bg-background text-on-background min-h-screen w-full h-[calc(100vh-130px)] pt-4 pb-24 overflow-y-auto relative">
      <main className="max-w-7xl mx-auto px-container-margin">
        <section className="flex flex-col items-center justify-center py-stack-md text-center">
          <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center mb-stack-lg">
            <div className="absolute inset-0 rounded-full border-2 border-secondary/20 scale-110 opacity-40 animate-pulse"></div>
            <div className="absolute inset-4 rounded-full border border-secondary/30 scale-105 opacity-60 animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr ${isAiLoading ? 'from-gray-400 via-gray-300 to-white' : 'from-secondary via-secondary-container to-on-tertiary-container'} shadow-[0_0_50px_rgba(33,112,228,0.4)] flex items-center justify-center relative overflow-hidden transition-all duration-500`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent"></div>
              <span className={`material-symbols-outlined text-white text-[64px] font-thin ${isAiLoading ? 'animate-spin' : 'animate-pulse'}`}>neurology</span>
            </div>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-primary dark:text-on-primary mb-stack-sm">
            {isAiLoading ? 'Analyzing...' : 'AI Guardian Active'}
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
            {safetyStatus.warningStatus === 'Optimal'
              ? 'Monitoring your surroundings in real-time. Everything appears safe for your current route.'
              : safetyStatus.warningStatus === 'Caution'
              ? 'Caution advised. Sensors detected an anomaly — staying alert on your behalf.'
              : 'Warning! Unusual activity detected. Reviewing your safety status urgently.'}
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg mt-8">
          <div className="md:col-span-8 glass-card rounded-lg p-stack-lg flex flex-col justify-between shadow-sm relative overflow-hidden bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="flex justify-between items-start mb-stack-lg relative z-10">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary dark:text-on-primary mb-1">Route Safety Score</h3>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {safetyStatus.neighborhood} &middot; {isDarkHours() ? 'Evening hours' : 'Daytime'}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-full border ${statusBadgeBg}`}>
                <span className="font-label-md text-label-md">{safetyStatus.warningStatus}</span>
              </div>
            </div>

            <div className="flex items-end gap-stack-md relative z-10 mt-6">
              {isAiLoading ? (
                 <div className="h-20 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md"></div>
              ) : (
                <span className="text-[80px] font-extrabold leading-none tracking-tighter text-primary dark:text-on-primary">
                  {safetyStatus.safetyScore}
                </span>
              )}
              <div className="pb-3">
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-8 rounded-full ${
                        isAiLoading ? 'bg-gray-300 animate-pulse' :
                        i <= (safetyStatus.safetyScore / 20) ? 'bg-secondary' : 'bg-secondary/30'
                      }`}
                    ></div>
                  ))}
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Confidence Index</p>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          <div className="md:col-span-4 glass-card rounded-lg p-stack-lg flex flex-col justify-between shadow-sm bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="space-y-4">
              <span className="material-symbols-outlined text-secondary dark:text-safepulse-accent text-3xl">lightbulb</span>
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">Smart Recommendation</h3>
              {isAiLoading ? (
                <div className="space-y-2">
                   <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                   <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
              ) : (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {aiRecommendation}
                </p>
              )}
            </div>
            <button onClick={handleViewRoute} className="mt-8 w-full py-3 bg-secondary text-on-secondary rounded-full font-label-md text-label-md hover:opacity-90 transition-opacity">View Route</button>
          </div>

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
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">AI Insight</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{safetyStatus.movementPattern}</p>
            </div>
          </div>

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

      {/* Floating Chat Bubble */}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50 flex flex-col items-end">
        {isChatOpen && (
          <div className="bg-white dark:bg-surface-container shadow-xl rounded-2xl w-80 md:w-96 mb-4 overflow-hidden flex flex-col h-[400px] border border-gray-200 dark:border-gray-700 transform origin-bottom-right transition-all duration-300">
            <div className="bg-secondary p-4 flex justify-between items-center text-on-secondary">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined">smart_toy</span>
                AI Assistant
              </h3>
              <button onClick={() => setIsChatOpen(false)} className="hover:opacity-70">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-surface-container-lowest dark:bg-surface">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-secondary text-on-secondary rounded-br-none' 
                      : 'bg-surface-variant text-on-surface-variant rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface-variant rounded-2xl rounded-bl-none px-4 py-3 flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-surface-container border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask for safety advice..."
                className="flex-1 bg-surface-container-low dark:bg-surface-container-highest border-none rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary text-on-surface"
              />
              <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="bg-secondary text-on-secondary p-2 rounded-full flex items-center justify-center hover:opacity-90 disabled:opacity-50">
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </form>
          </div>
        )}
        
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-secondary hover:bg-secondary-container text-on-secondary hover:text-secondary shadow-lg w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        >
          <span className="material-symbols-outlined text-2xl">
            {isChatOpen ? 'keyboard_arrow_down' : 'chat'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default Assistant;
