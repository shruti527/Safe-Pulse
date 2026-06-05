import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

// Recenter helper component: MapContainer center is immutable after mount, 
// so we need this helper to update the view when coordinates change.
const RecenterMap = ({ center, trackingActive, recenterTrigger }) => {
  const map = useMap();
  useEffect(() => {
    if (center && trackingActive) {
      map.panTo(center);
    }
  }, [center, map, trackingActive]);

  // Manual recenter: fly to location smoothly when trigger fires
  useEffect(() => {
    if (center && recenterTrigger) {
      map.flyTo(center, 16, { animate: true, duration: 0.8 });
    }
  }, [recenterTrigger, map, center]);

  return null;
};

// Custom DIV Icon for current user (pulsing radar effect)
const userIcon = L.divIcon({
  className: 'user-radar-marker',
  html: `
    <div class="relative flex items-center justify-center w-10 h-10">
      <div class="absolute w-10 h-10 bg-secondary/30 rounded-full animate-ping"></div>
      <div class="absolute w-6 h-6 bg-secondary/50 rounded-full animate-pulse"></div>
      <div class="z-10 w-4.5 h-4.5 bg-secondary border-2 border-white rounded-full shadow-lg"></div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

// Custom DIV Icon for contact user icons on map
const contactIcon = (name, isOnline = true) => L.divIcon({
  className: 'contact-user-marker',
  html: `
    <div class="flex flex-col items-center select-none" style="transform: translate(-50%, -50%);">
      <!-- User Icon Circle -->
      <div class="relative flex items-center justify-center w-10 h-10 bg-primary text-white rounded-full shadow-lg border-2 border-white transition-all transform hover:scale-110">
        <span class="material-symbols-outlined text-[20px] font-bold">person</span>
        <!-- Status dot -->
        <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-gray-400'}"></span>
      </div>
      <!-- Label with Name -->
      <div class="mt-1 px-3 py-0.5 bg-white/95 dark:bg-surface-container-high/95 backdrop-blur-sm border border-black/5 dark:border-white/10 rounded-full shadow-md whitespace-nowrap">
        <span class="text-[11px] font-extrabold text-on-surface">${name}</span>
      </div>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0]
});

const MapComponent = ({ center, contacts = [], geofences = [], trackingActive = true, recenterTrigger }) => {
  const defaultCenter = center || [37.7749, -122.4194]; // SF fallback
  const zoom = 15;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={zoom} 
        zoomControl={false} // Disable default zoom control to keep UI clean
        className="w-full h-full"
      >
        {/* OpenStreetMap Tile Layer - sleek clean look */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User Marker */}
        {center && (
          <Marker position={center} icon={userIcon}>
            <Popup>
              <div className="text-center font-label-md text-on-surface">
                <p className="font-bold">You</p>
                <p className="text-xs text-outline">Live Tracking Active</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Tracked Contacts Map Pins */}
        {contacts.map((contact, idx) => {
          const isOnline = contact.lastSeen === 'Online';
          return (
            <Marker 
              key={contact.id || idx} 
              position={contact.position} 
              icon={contactIcon(contact.name, isOnline)}
            >
              <Popup>
                <div className="font-body-sm text-on-surface">
                  <p className="font-bold">{contact.name}</p>
                  <p className="text-xs text-outline">{contact.lastSeen || 'Active now'}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Geofences Circle Overlays */}
        {geofences.map((zone) => {
          if (zone.latitude && zone.longitude && zone.active) {
            return (
              <Circle
                key={zone._id || zone.id}
                center={[zone.latitude, zone.longitude]}
                radius={zone.radius || 200}
                pathOptions={{
                  fillColor: '#8257e5',
                  fillOpacity: 0.15,
                  color: '#8257e5',
                  weight: 1.5,
                  dashArray: '5, 5'
                }}
              >
                <Popup>
                  <div className="font-body-sm text-on-surface">
                    <p className="font-bold">{zone.name}</p>
                    <p className="text-xs text-outline">Safe Zone ({zone.radius}m)</p>
                  </div>
                </Popup>
              </Circle>
            );
          }
          return null;
        })}

        {/* Auto Recenter Map */}
        <RecenterMap center={center} trackingActive={trackingActive} recenterTrigger={recenterTrigger} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;
