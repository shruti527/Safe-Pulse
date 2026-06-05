import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SafeZoneCard = ({ zone, onToggleActive, onDelete }) => {
  // Use a map placeholder image that works beautifully.
  const mapImage = zone.image || `https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=400`;

  return (
    <div className="bg-surface-container-lowest dark:bg-surface-container/20 rounded-xl overflow-hidden mb-4 border border-surface-container dark:border-white/10 shadow-sm relative group">
      {/* Mini Map Preview */}
      <div className="h-24 w-full relative">
        <img src={mapImage} alt={zone.name} className="w-full h-full object-cover" />
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
          <div className="flex -space-x-2">
            <img className="w-6 h-6 rounded-full border border-surface object-cover" src="https://i.pravatar.cc/150?u=1" alt="contact" />
            <img className="w-6 h-6 rounded-full border border-surface object-cover" src="https://i.pravatar.cc/150?u=2" alt="contact" />
            <div className="w-6 h-6 rounded-full border border-surface bg-surface-container-high flex items-center justify-center font-label-sm text-[10px] text-on-surface-variant">+1</div>
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
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(200);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userId = localStorage.getItem('userId');

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

  // Request browser geolocation to prefill coordinates
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location. Please enter manually.');
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
        // Reset form
        setName('');
        setAddress('');
        setRadius(200);
        setLatitude('');
        setLongitude('');
        setIsModalOpen(false);
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
      // Optimistic UI update
      setZones((prev) => 
        prev.map((z) => ((z._id || z.id) === id ? { ...z, active: !z.active } : z))
      );

      const res = await axios.patch(`/api/geofences/toggle/${id}`);
      const result = res.data;
      if (!result.success) {
        // Rollback on failure
        fetchZones();
      }
    } catch (err) {
      console.error('Error toggling active status:', err);
      fetchZones(); // Rollback
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

  return (
    <div className="flex-grow flex flex-col h-[calc(100vh-130px)] bg-surface dark:bg-safepulse-dark relative w-full">
      <div className="px-container-margin pt-4 pb-2">
        <h2 className="font-headline-md text-headline-md font-bold text-on-surface mb-1">Safe Zones</h2>
        <p className="font-body-sm text-sm text-on-surface-variant mb-6">Get notified when tracked contacts arrive or leave these locations.</p>
      </div>

      <div className="flex-grow px-container-margin overflow-y-auto pb-24">
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

      {/* Floating Add Button */}
      <div className="absolute bottom-24 right-6 z-30">
        <button 
          onClick={() => {
            setIsModalOpen(true);
            handleGetLocation(); // Fetch current coordinates immediately on open
          }}
          className="w-14 h-14 rounded-full bg-secondary dark:bg-safepulse-accent text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>

      {/* Glassmorphic Add Geofence Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-container-high rounded-2xl w-full max-w-md p-6 border border-surface-container-highest dark:border-white/10 shadow-2xl relative space-y-4 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex justify-between items-center pb-2 border-b border-outline/10">
              <h3 className="font-headline-sm text-xl font-bold text-on-surface">Add New Safe Zone</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container-highest/50 transition-all flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateZone} className="space-y-4">
              <div className="space-y-1">
                <label className="font-label-sm text-xs text-on-surface-variant block" htmlFor="zoneName">Zone Name *</label>
                <input 
                  className="w-full h-11 px-3 bg-surface-container-lowest dark:bg-surface-container/40 border border-outline/20 rounded-lg font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all" 
                  id="zoneName" 
                  placeholder="e.g. Home, Office, Gym" 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-label-sm text-xs text-on-surface-variant block" htmlFor="zoneAddress">Address (Optional)</label>
                <input 
                  className="w-full h-11 px-3 bg-surface-container-lowest dark:bg-surface-container/40 border border-outline/20 rounded-lg font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all" 
                  id="zoneAddress" 
                  placeholder="e.g. 123 Main St, New York" 
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-xs text-on-surface-variant" htmlFor="zoneRadius">Radius: <span className="font-bold text-secondary">{radius}m</span></label>
                </div>
                <input 
                  className="w-full accent-secondary" 
                  id="zoneRadius" 
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
                <div className="flex justify-between text-[10px] text-outline">
                  <span>50m</span>
                  <span>500m</span>
                  <span>1000m</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-label-sm text-xs text-on-surface-variant block" htmlFor="lat">Latitude *</label>
                  <input 
                    className="w-full h-11 px-3 bg-surface-container-lowest dark:bg-surface-container/40 border border-outline/20 rounded-lg font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all" 
                    id="lat" 
                    placeholder="e.g. 37.7749" 
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-label-sm text-xs text-on-surface-variant block" htmlFor="lng">Longitude *</label>
                  <input 
                    className="w-full h-11 px-3 bg-surface-container-lowest dark:bg-surface-container/40 border border-outline/20 rounded-lg font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all" 
                    id="lng" 
                    placeholder="e.g. -122.4194" 
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={gettingLocation}
                className="w-full h-10 border border-secondary text-secondary rounded-lg font-label-md flex items-center justify-center gap-2 hover:bg-secondary/5 transition-colors disabled:opacity-55"
              >
                <span className="material-symbols-outlined text-[18px]">my_location</span>
                <span>{gettingLocation ? 'Locating...' : 'Detect Current Location'}</span>
              </button>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-12 bg-surface-container-highest text-on-surface rounded-lg font-label-md hover:bg-opacity-90 transition-opacity"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 bg-secondary text-white rounded-lg font-label-md hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Create Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafeZones;
