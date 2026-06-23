import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MapComponent from '../components/Map';
import { getSocket } from '../socket';

const SafeZoneCard = ({ zone, onToggleActive, onDelete }) => {
  return (
    <div className="bg-surface-container-lowest dark:bg-surface-container/20 rounded-xl overflow-hidden mb-4 border border-surface-container dark:border-white/10 shadow-sm relative group">
      <div className="h-24 w-full relative bg-gradient-to-br from-secondary/20 to-primary/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,var(--tw-gradient-stops))] from-secondary/10 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
        <div className="absolute bottom-2 left-3 right-3 flex justify-between items-end">
          <h3 className="font-headline-sm text-lg font-bold text-white tracking-tight drop-shadow-md">{zone.name}</h3>
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/30">
            <span className="material-symbols-outlined text-[14px] text-white">radar</span>
            <span className="font-label-sm text-[11px] text-white font-bold">{zone.radius}m</span>
          </div>
        </div>
      </div>
      
      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <p className="font-body-sm text-[13px] text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">location_on</span>
            {zone.address || `Lat: ${Number(zone.latitude).toFixed(4)}, Lng: ${Number(zone.longitude).toFixed(4)}`}
          </p>
          <button 
            onClick={() => onDelete(zone._id || zone.id)}
            className="text-error/70 hover:text-error transition-colors p-1 rounded-full hover:bg-error/10 flex items-center justify-center"
            title="Delete Safe Zone"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
        
        <div className="flex justify-between items-center mt-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-outline">groups</span>
            <span className="font-label-sm text-[11px] text-on-surface-variant">Trusted contacts notified on arrival</span>
          </div>
          <button 
            onClick={() => onToggleActive(zone._id || zone.id)}
            className="flex items-center gap-2 focus:outline-none"
          >
            <span className="font-label-sm text-[12px] text-on-surface-variant">Alerts</span>
            <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${zone.active ? 'bg-secondary dark:bg-safepulse-accent' : 'bg-surface-container-high'}`}>
              <div className={`absolute top-0.5 bottom-0.5 bg-white rounded-full w-4 h-4 transition-transform duration-200 shadow-sm ${zone.active ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const SafeZones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Create flow states
  const [isCreating, setIsCreating] = useState(false);
  const [createStep, setCreateStep] = useState('location'); // 'location', 'radius', 'details'
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(200);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // View mode: 'my_zones' | 'track_friend'
  const [viewMode, setViewMode] = useState('my_zones');

  // Friend tracking state
  const [iTrackContacts, setITrackContacts] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [selectedFriendName, setSelectedFriendName] = useState('');
  const [friendLocation, setFriendLocation] = useState(null);
  const [friendGeofences, setFriendGeofences] = useState([]);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const userId = localStorage.getItem('userId');
  const socketRef = useRef(null);

  // Initialize socket
  useEffect(() => {
    socketRef.current = getSocket();
  }, []);

  // Create state reset
  const resetCreateForm = () => {
    setIsCreating(false);
    setCreateStep('location');
    setName('');
    setAddress('');
    setRadius(200);
    setLatitude('');
    setLongitude('');
  };

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/geofences/list/${userId}`);
      if (res.data.success) {
        setZones(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load safe zones');
      }
    } catch (err) {
      console.error('Error fetching safe zones:', err);
      setError('Could not connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchZones();
  }, [userId]);

  // Fetch iTrack contacts (users I am watching)
  useEffect(() => {
    if (!userId) return;
    const fetchContacts = async () => {
      try {
        const res = await axios.get('/api/auth/contacts');
        const allContacts = res.data.data || [];
        const currentUserId = localStorage.getItem('userId');
        const iTrack = allContacts.filter(c => {
          if (c.status !== 'accepted') return false;
          return String(c.requestedBy) === String(currentUserId);
        });
        setITrackContacts(iTrack.map(c => ({
          userId: c.user?._id || c.userId,
          name: c.user?.name || c.name || 'Contact',
          online: c.user?.status === 'Online',
        })));
      } catch (err) {
        console.error('Error fetching contacts for friend tracking:', err);
      }
    };
    fetchContacts();
  }, [userId]);

  // When a friend is selected, fetch their data and subscribe to socket room
  useEffect(() => {
    if (!selectedFriendId) {
      setFriendLocation(null);
      setFriendGeofences([]);
      return;
    }

    const fetchFriendData = async () => {
      setFriendLoading(true);
      setFriendError(null);
      try {
        const res = await axios.get(`/api/geofences/track-friend/${selectedFriendId}`);
        if (res.data.success) {
          const { location, geofences } = res.data.data;
          if (location) {
            setFriendLocation([location.latitude, location.longitude]);
          } else {
            setFriendLocation(null);
          }
          setFriendGeofences(geofences);
        } else {
          setFriendError(res.data.message || 'Failed to load friend data');
        }
      } catch (err) {
        console.error('Error fetching friend data:', err);
        setFriendError(err.response?.data?.message || 'Failed to load friend tracking data');
        setFriendLocation(null);
        setFriendGeofences([]);
      } finally {
        setFriendLoading(false);
      }
    };

    fetchFriendData();

    // Subscribe to friend's tracking room for real-time updates
    const socket = socketRef.current;
    if (socket) {
      socket.emit('subscribe_to_friend', selectedFriendId);

      const handleFriendLocation = (data) => {
        if (data.userId === selectedFriendId) {
          setFriendLocation([data.latitude, data.longitude]);
        }
      };

      const handleFriendZoneEvent = (eventType) => (data) => {
        if (data.userId === selectedFriendId && data.geofenceName) {
          const verb = eventType === 'safeZoneEntry' ? 'entered' : 'left';
          setFriendError(`${data.userName} ${verb} ${data.geofenceName}`);
          setTimeout(() => setFriendError(null), 5000);
        }
      };

      socket.on('friend_location_update', handleFriendLocation);
      socket.on('safeZoneEntry', handleFriendZoneEvent('safeZoneEntry'));
      socket.on('safeZoneExit', handleFriendZoneEvent('safeZoneExit'));

      return () => {
        socket.off('friend_location_update', handleFriendLocation);
        socket.off('safeZoneEntry', handleFriendZoneEvent('safeZoneEntry'));
        socket.off('safeZoneExit', handleFriendZoneEvent('safeZoneExit'));
        socket.emit('unsubscribe_from_friend', selectedFriendId);
      };
    }
  }, [selectedFriendId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current && selectedFriendId) {
        socketRef.current.emit('unsubscribe_from_friend', selectedFriendId);
      }
    };
  }, []);

  // Re-center when friend location updates
  useEffect(() => {
    if (friendLocation) {
      setRecenterTrigger(t => t + 1);
    }
  }, [friendLocation]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setRecenterTrigger((t) => t + 1);
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert(`Could not get location: ${error.message}. If you are testing in DevTools, please ensure a location is selected in the Sensors tab and not set to 'Location unavailable'.`);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    if (!name.trim() || !radius || !latitude || !longitude) {
      alert('Please fill out all required fields: Name, Radius, Latitude, Longitude.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post('/api/geofences/create', {
        name,
        address,
        radius: Number(radius),
        latitude: Number(latitude),
        longitude: Number(longitude)
      });

      const result = res.data;
      if (result.success) {
        setZones((prev) => [...prev, result.data]);
        resetCreateForm();
      } else {
        alert(result.message || 'Failed to create safe zone.');
      }
    } catch (err) {
      console.error('Error creating safe zone:', err);
      alert('Failed to send request to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      setZones((prev) => 
        prev.map((z) => ((z._id || z.id) === id ? { ...z, active: !z.active } : z))
      );

      const res = await axios.patch(`/api/geofences/toggle/${id}`);
      const result = res.data;
      if (!result.success) {
        fetchZones();
      }
    } catch (err) {
      console.error('Error toggling active status:', err);
      fetchZones();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Safe Zone?')) return;
    try {
      const res = await axios.delete(`/api/geofences/delete/${id}`);
      const result = res.data;
      if (result.success) {
        setZones((prev) => prev.filter((z) => (z._id || z.id) !== id));
      } else {
        alert(result.message || 'Failed to delete safe zone.');
      }
    } catch (err) {
      console.error('Error deleting geofence:', err);
      alert('Server error while deleting safe zone.');
    }
  };

  const handleFriendSelect = (friendId, friendName) => {
    if (friendId === selectedFriendId) {
      setSelectedFriendId(null);
      setSelectedFriendName('');
      return;
    }
    setSelectedFriendId(friendId);
    setSelectedFriendName(friendName);
  };

  return (
    <div className="flex-grow flex flex-col h-[calc(100vh-130px)] bg-surface dark:bg-safepulse-dark relative w-full">
      <div className="px-container-margin pt-20 pb-2">
        <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-1">Safe Zones</h2>
        <p className="font-body-sm text-sm text-on-surface-variant mb-4">
          {viewMode === 'my_zones'
            ? 'Get notified when tracked contacts arrive or leave these locations.'
            : 'Select a contact to view their live location and safe zones.'}
        </p>

        {/* View mode selector */}
        <div className="flex bg-surface-container-low dark:bg-surface-container rounded-lg p-1 mb-4">
          <button
            onClick={() => {
              setViewMode('my_zones');
              setSelectedFriendId(null);
              setSelectedFriendName('');
            }}
            className={`flex-1 py-2 font-label-sm text-label-sm rounded-md transition-all ${
              viewMode === 'my_zones'
                ? 'bg-surface dark:bg-surface-container-high shadow-sm text-primary dark:text-on-primary'
                : 'text-on-surface-variant'
            }`}
          >
            My Safe Zones
          </button>
          <button
            onClick={() => setViewMode('track_friend')}
            className={`flex-1 py-2 font-label-sm text-label-sm rounded-md transition-all ${
              viewMode === 'track_friend'
                ? 'bg-surface dark:bg-surface-container-high shadow-sm text-primary dark:text-on-primary'
                : 'text-on-surface-variant'
            }`}
          >
            Track Friend
          </button>
        </div>

        {/* Friend selector dropdown (only in track_friend mode) */}
        {viewMode === 'track_friend' && (
          <div className="mb-4">
            <div className="relative">
              <select
                value={selectedFriendId || ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    setSelectedFriendId(null);
                    setSelectedFriendName('');
                    return;
                  }
                  const contact = iTrackContacts.find(c => c.userId === e.target.value);
                  handleFriendSelect(contact?.userId, contact?.name);
                }}
                className="w-full h-11 px-3 bg-surface-container-lowest dark:bg-surface-container/40 border border-outline/20 rounded-lg font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all appearance-none"
              >
                <option value="">Select a contact to track...</option>
                {iTrackContacts.map(c => (
                  <option key={c.userId} value={c.userId}>
                    {c.name} {c.online ? '● Online' : '○ Offline'}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant pointer-events-none">
                expand_more
              </span>
            </div>
            {selectedFriendName && (
              <div className="mt-2 flex items-center justify-between">
                <p className="font-label-sm text-label-sm text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  Tracking: <span className="font-bold">{selectedFriendName}</span>
                </p>
                <button
                  onClick={() => {
                    setSelectedFriendId(null);
                    setSelectedFriendName('');
                  }}
                  className="text-xs text-on-surface-variant hover:text-error transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  Clear
                </button>
              </div>
            )}
            {iTrackContacts.length === 0 && (
              <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                No contacts found. Add contacts from the Contacts page to track their safe zones.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-grow relative">
        {isCreating ? (
          <div className="absolute inset-0">
            {/* Interactive Map for Creation */}
            <MapComponent
              center={latitude && longitude ? [Number(latitude), Number(longitude)] : null}
              contacts={[]}
              geofences={[]}
              trackingActive={false}
              recenterTrigger={recenterTrigger}
              onMapClick={(latlng) => {
                if (createStep === 'location') {
                  setLatitude(latlng.lat);
                  setLongitude(latlng.lng);
                }
              }}
              previewZone={latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude), radius: Number(radius) } : null}
            />

            {/* Step 1: Location */}
            {createStep === 'location' && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[400] bg-surface dark:bg-surface-container-high rounded-xl p-4 shadow-xl border border-surface-container-highest dark:border-white/10">
                <p className="font-label-md text-on-surface text-center mb-3">Tap on the map to set zone location.</p>
                <div className="flex gap-2">
                  <button onClick={resetCreateForm} className="flex-1 py-2 font-label-sm text-on-surface bg-surface-container rounded-lg">Cancel</button>
                  <button 
                    onClick={() => setCreateStep('radius')}
                    disabled={!latitude || !longitude}
                    className="flex-1 py-2 font-label-sm text-white bg-secondary rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Radius */}
            {createStep === 'radius' && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[400] bg-surface dark:bg-surface-container-high rounded-xl p-4 shadow-xl border border-surface-container-highest dark:border-white/10">
                <p className="font-label-md text-on-surface text-center mb-2">Adjust Zone Radius: <span className="font-bold text-secondary">{radius}m</span></p>
                <input 
                  className="w-full accent-secondary mb-4" 
                  type="range" min="50" max="1000" step="50" 
                  value={radius} onChange={(e) => setRadius(Number(e.target.value))}
                />
                <div className="flex gap-2">
                  <button onClick={() => setCreateStep('location')} className="flex-1 py-2 font-label-sm text-on-surface bg-surface-container rounded-lg">Back</button>
                  <button onClick={() => setCreateStep('details')} className="flex-1 py-2 font-label-sm text-white bg-secondary rounded-lg">Next</button>
                </div>
              </div>
            )}

            {/* Step 3: Details */}
            {createStep === 'details' && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[400] bg-surface dark:bg-surface-container-high rounded-xl p-4 shadow-xl border border-surface-container-highest dark:border-white/10">
                <p className="font-label-md text-on-surface mb-3">Zone Details</p>
                <input 
                  className="w-full h-11 px-3 mb-3 bg-surface-container-lowest dark:bg-surface-container border border-outline/20 rounded-lg text-sm text-on-surface" 
                  placeholder="Zone Name (e.g. Home)" 
                  value={name} onChange={(e) => setName(e.target.value)}
                />
                <input 
                  className="w-full h-11 px-3 mb-4 bg-surface-container-lowest dark:bg-surface-container border border-outline/20 rounded-lg text-sm text-on-surface" 
                  placeholder="Address (Optional)" 
                  value={address} onChange={(e) => setAddress(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => setCreateStep('radius')} className="flex-1 py-2 font-label-sm text-on-surface bg-surface-container rounded-lg">Back</button>
                  <button 
                    onClick={handleCreateZone}
                    disabled={!name.trim() || submitting}
                    className="flex-1 py-2 font-label-sm text-white bg-secondary rounded-lg flex items-center justify-center disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Zone'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Auto-location button overlay when creating */}
            <button
              onClick={handleGetLocation}
              disabled={gettingLocation}
              className="absolute top-4 right-4 z-[400] w-12 h-12 flex items-center justify-center bg-white/80 dark:bg-surface-container-high/90 backdrop-blur-md text-primary rounded-full shadow-md disabled:opacity-50"
              title="My Location"
            >
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>my_location</span>
            </button>
          </div>
        ) : viewMode === 'my_zones' ? (
          <div className="absolute inset-0 overflow-y-auto px-container-margin pb-24">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center pb-12">
                <span className="material-symbols-outlined text-[48px] animate-spin text-secondary">sync</span>
                <p className="font-body-md text-on-surface-variant mt-2">Loading Safe Zones...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-center pb-12">
                <span className="material-symbols-outlined text-[48px] text-error">error</span>
                <p className="font-body-md text-error mt-2">{error}</p>
                <button 
                  onClick={fetchZones}
                  className="mt-4 px-4 py-2 bg-secondary text-white rounded-full font-label-md hover:opacity-90 transition-opacity"
                >
                  Retry
                </button>
              </div>
            ) : zones.length > 0 ? (
              zones.map(zone => (
                <SafeZoneCard 
                  key={zone._id || zone.id} 
                  zone={zone} 
                  onToggleActive={handleToggleActive} 
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center pb-12">
                <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-on-surface-variant text-[40px]">add_location_alt</span>
                </div>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface mb-2">No Safe Zones</h3>
                <p className="font-body-md text-on-surface-variant max-w-[250px]">Add locations like Home or School to start receiving arrival alerts.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0">
            {/* Friend tracking map */}
            {friendLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <span className="material-symbols-outlined text-[48px] animate-spin text-secondary">sync</span>
                <p className="font-body-md text-on-surface-variant mt-2">Loading friend data...</p>
              </div>
            ) : friendError ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-container-margin">
                <span className="material-symbols-outlined text-[48px] text-error">error</span>
                <p className="font-body-md text-error mt-2">{friendError}</p>
              </div>
            ) : (
              <>
                <MapComponent
                  center={friendLocation}
                  contacts={friendLocation ? [{ id: selectedFriendId, name: selectedFriendName, position: friendLocation, lastSeen: 'Online' }] : []}
                  geofences={friendGeofences}
                  trackingActive={!!friendLocation}
                  recenterTrigger={recenterTrigger}
                />
                {/* Re-center FAB */}
                <button
                  onClick={() => setRecenterTrigger(t => t + 1)}
                  className="absolute bottom-6 right-6 z-30 w-12 h-12 flex items-center justify-center bg-white/80 dark:bg-surface-container-high/90 backdrop-blur-md text-primary rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all border border-white/40"
                  title="Recenter Map"
                >
                  <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>my_location</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating Add Button — only show in my_zones mode and not creating */}
      {viewMode === 'my_zones' && !isCreating && (
        <div className="absolute bottom-24 right-6 z-30">
          <button 
            onClick={() => {
              setIsCreating(true);
              setCreateStep('location');
              handleGetLocation(); // Attempt to center on user location initially
            }}
            className="w-14 h-14 rounded-full bg-secondary dark:bg-safepulse-accent text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default SafeZones;