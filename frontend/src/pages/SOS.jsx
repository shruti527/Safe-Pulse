import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSocket } from '../socket';

const SOS = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);
  const [isActive, setIsActive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [addressName, setAddressName] = useState('Determining location...');
  const [alertId, setAlertId] = useState(null);
  const [contacts, setContacts] = useState([]);         // real accepted contacts
  const [alertedIds, setAlertedIds] = useState(new Set()); // track who has been notified

  const userId = localStorage.getItem('userId');

  // Fetch real accepted contacts
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const { data } = await axios.get('/api/auth/contacts');
        const accepted = (data.data || []).filter(c => c.status === 'accepted' && c.user);
        setContacts(accepted);
      } catch (err) {
        console.error('[SOS] Failed to load contacts:', err);
      }
    };
    fetchContacts();
  }, []);

  // Socket: listen for when a contact marks us as safe
  useEffect(() => {
    const socket = getSocket();
    const handleUserSafe = (data) => {
      if (data.userId?.toString() === userId) {
        navigate('/');
      }
    };
    socket.on('userSafe', handleUserSafe);
    return () => socket.off('userSafe', handleUserSafe);
  }, [userId, navigate]);

  // Track which contacts have been alerted once SOS is active
  useEffect(() => {
    if (isActive && alertId) {
      setAlertedIds(new Set(contacts.map(c => c.user._id)));
    }
  }, [isActive, alertId]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setGpsCoords({ latitude: lat, longitude: lng });
          setAddressName(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
        },
        (error) => {
          console.error('Error getting location:', error);
          setAddressName('Location Access Denied');
        },
        { enableHighAccuracy: true }
      );
    } else {
      setAddressName('Geolocation unsupported');
    }
  }, []);

  const triggerSOS = async () => {
    // Bail out if a request is already in-flight to prevent flooding
    if (isSending) return;

    // Require GPS coords before submitting — warn if unavailable
    if (!gpsCoords) {
      console.warn('SOS triggered but GPS coordinates are not yet available.');
      return;
    }

    if (!userId) {
      console.warn('Cannot trigger SOS without a valid user ID');
      setIsSending(false);
      return;
    }

    setIsSending(true); // disable button immediately
    try {
      const res = await axios.post('/api/sos/trigger', {
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        message: 'SOS Emergency triggered via SafePulse Web App!'
      });
      if (res.data.success) {
        setAlertId(res.data.data._id);
        console.log('SOS triggered successfully, alertId:', res.data.data._id);
      }
    } catch (err) {
      console.error('Error triggering SOS:', err);
    } finally {
      setIsSending(false); // re-enable only after request settles
    }
  };

  useEffect(() => {
    let timer;
    if (countdown > 0 && !isActive) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0 && !isActive && gpsCoords) {
      setIsActive(true);
      triggerSOS();
    }
    return () => clearTimeout(timer);
  }, [countdown, isActive, gpsCoords]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] text-on-primary selection:bg-error selection:text-white font-body-md overflow-hidden flex flex-col">
      {/* Emergency Overlay Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="scanline"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(186,26,26,0.15)_0%,_transparent_70%)]"></div>
      </div>

      {/* Top Navigation (Custom for SOS) */}
      <header className="relative z-10 flex justify-between items-center w-full px-container-margin py-base max-w-7xl mx-auto mt-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-error" style={{fontVariationSettings: "'FILL' 1"}}>shield_with_heart</span>
          <span className="font-headline-md text-headline-md font-bold tracking-tight text-white">SafePulse</span>
        </div>
        <div className="flex items-center gap-2 bg-error/10 border border-error/20 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
          <span className="font-label-md text-label-md text-error">EMERGENCY MODE</span>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center relative z-10 px-container-margin max-w-3xl mx-auto w-full">
        {/* Countdown Section */}
        <div className="text-center mb-stack-lg">
          <p className="font-label-md text-label-md text-outline uppercase tracking-[0.2em] mb-stack-sm">Initiating Rescue Protocol</p>
          <h1 className="font-display-lg text-display-lg text-white mb-2">
            {isActive ? 'SOS ACTIVATED' : `Sending SOS in `}
            {!isActive && <span className="text-error">0{countdown}</span>}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
            {isActive ? 'Live location and audio are broadcasting.' : 'Hold the button to cancel immediately. Your live location and audio are being prepared for broadcast.'}
          </p>
        </div>

        {/* Massive SOS Button Container */}
        <div className="relative flex items-center justify-center w-full aspect-square max-w-[320px] mb-section-gap">
          {/* Pulsing Rings */}
          <div className="absolute inset-0 border-2 border-error/20 rounded-full animate-[ping_3s_infinite]"></div>
          <div className="absolute inset-0 border-2 border-error/40 rounded-full animate-[ping_3s_infinite_1s]"></div>
          
          {/* Main Button */}
          <button 
            onClick={() => {
              if (!isActive && !isSending && gpsCoords) {
                setCountdown(0);
                setIsActive(true);
                triggerSOS();
              }
            }}
            disabled={isSending || !gpsCoords}
            aria-busy={isSending}
            className="emergency-pulse relative w-64 h-64 bg-error rounded-full flex flex-col items-center justify-center group active:scale-90 transition-transform duration-300 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[80px] text-white mb-2" style={{fontVariationSettings: "'FILL' 1"}}>emergency_share</span>
            <span className="font-headline-lg text-headline-lg text-white font-black tracking-tighter">
              {isSending ? 'Sending...' : 'SOS'}
            </span>
          </button>
        </div>

        {/* Emergency Contacts Status */}
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-stack-lg space-y-stack-md mt-6">
          <div className="flex justify-between items-center border-b border-white/10 pb-stack-sm">
            <h3 className="font-label-md text-label-md text-white">Alerting Trusted Contacts</h3>
            <span className="font-label-sm text-label-sm text-error">
              {contacts.length > 0 ? `${contacts.length} Recipient${contacts.length > 1 ? 's' : ''}` : 'No contacts yet'}
            </span>
          </div>
          
          {contacts.length === 0 ? (
            <p className="font-label-sm text-label-sm text-on-surface-variant text-center py-2">
              No trusted contacts found. Add contacts to alert them during an SOS.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
              {contacts.map((c) => (
                <div key={c._id} className="flex items-center gap-stack-md bg-white/5 p-stack-sm rounded-lg border border-white/5">
                  <div className="w-10 h-10 rounded-full border border-white/20 bg-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>person</span>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-label-md text-label-md text-white truncate">{c.user?.name || 'Contact'}</p>
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-error animate-pulse' : 'bg-outline/40'}`} />
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        {isActive ? 'Alerted ✓' : 'Queuing alert...'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-center gap-4 pt-stack-sm opacity-60">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">local_police</span>
              <span className="font-label-sm text-label-sm">Local Authorities</span>
            </div>
            <div className="w-1 h-1 bg-white/30 rounded-full"></div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">medical_services</span>
              <span className="font-label-sm text-label-sm">EMS Services</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Action */}
      <footer className="relative z-10 w-full p-container-margin pb-12 max-w-3xl mx-auto">
        <button 
          onClick={async () => {
            if (isActive && alertId) {
              try {
                await axios.post(`/api/sos/resolve/${alertId}`);
              } catch (err) {
                console.error('Failed to resolve alert:', err);
              }
            }
            navigate('/');
          }}
          className="w-full py-5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 group"
        >
          <span className="material-symbols-outlined text-white transition-transform group-hover:scale-110">close</span>
          <span className="font-label-md text-label-md text-white uppercase tracking-widest">
            {isActive ? 'End Emergency Request' : 'Cancel Emergency Request'}
          </span>
        </button>
        {!isActive && (
          <p className="text-center mt-4 font-label-sm text-label-sm text-outline">You have {countdown} seconds to cancel before live broadcasting begins.</p>
        )}
      </footer>

      {/* Map Context Hint (Floating Glass) */}
      <div className="fixed bottom-32 right-container-margin z-20 hidden md:block">
        <div className="bg-surface-container-highest/10 backdrop-blur-2xl border border-white/10 p-4 rounded-lg w-64 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-secondary">location_on</span>
            <p className="font-label-md text-label-md text-white">Current Location</p>
          </div>
          <div className="h-24 w-full rounded bg-surface-dim overflow-hidden relative grayscale brightness-50">
            <img 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3tIxlN63KjdkEqR9qptWXyrcfTCTQ9IoRaT9DKTznweCDoJKxFvfkgK7OoZo_HuuGtuOpcaEqEZzRi-gHmzHtWbX9qZtr36YJ7P_V3Ik8haxHFAewlraNhb0cTYTTrDYc_U_lGoxl2FvqJjo0boZ3IrP-NeRFjdUJDY7645I0gw9nJECthvZm96kSmOgELSvP__Ir70tBQmGWBXWaplqyYSgsp7zPq4zQVHxxBHsJy-io5s3ULDPzLwnZaTwbfXWxbBVyXqIM_cA"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 bg-error rounded-full animate-ping"></div>
              <div className="absolute w-2 h-2 bg-error rounded-full"></div>
            </div>
          </div>
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-2">{addressName}</p>
        </div>
      </div>
    </div>
  );
};

export default SOS;
