import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getSocket } from '../socket';

const STATUS_COLORS = {
  triggered: 'border-l-red-500',
  escalated: 'border-l-orange-500',
  resolved: 'border-l-emerald-500',
  missed: 'border-l-amber-500',
};

const STATUS_LABELS = {
  triggered: { text: 'Active', bg: 'bg-red-100', color: 'text-red-600' },
  escalated: { text: 'Escalated', bg: 'bg-orange-100', color: 'text-orange-600' },
  resolved: { text: 'Resolved', bg: 'bg-emerald-100', color: 'text-emerald-600' },
  missed: { text: 'Missed', bg: 'bg-amber-100', color: 'text-amber-600' },
};

const Notifications = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAlerts = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError('');
      const alertsRes = await axios.get(`/api/sos/alerts/${userId}`);
      setAlerts(alertsRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch alerts', err);
      setError('Failed to load activity. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    // Real-time: prepend new incoming alerts without re-fetching
    const socket = getSocket();
    const handleNewAlert = (alertData) => {
      setAlerts(prev => {
        // Avoid duplicates
        if (prev.some(a => a._id === alertData.alertId)) return prev;
        return [{ _id: alertData.alertId, ...alertData, status: 'triggered', createdAt: alertData.time || new Date() }, ...prev];
      });
    };
    const handleUserSafe = (data) => {
      setAlerts(prev => prev.map(a => a._id === data.alertId ? { ...a, status: 'resolved' } : a));
    };

    socket.on('emergencyAlert', handleNewAlert);
    socket.on('userSafe', handleUserSafe);

    return () => {
      socket.off('emergencyAlert', handleNewAlert);
      socket.off('userSafe', handleUserSafe);
    };
  }, [fetchAlerts]);

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (alert) => {
    const status = alert.status || 'triggered';
    const s = STATUS_LABELS[status] || STATUS_LABELS.triggered;
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
        {s.text}
      </span>
    );
  };

  return (
    <main className="max-w-3xl mx-auto px-container-margin mt-stack-lg flex-grow overflow-y-auto pb-32 pt-16">
      {/* Header Section */}
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-1">Activity</h2>
        <p className="font-body-md text-on-surface-variant">Stay updated with your pulse network's safety status.</p>
      </div>

      <section>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-lg p-stack-md flex gap-stack-md animate-pulse">
                <div className="w-12 h-12 rounded-full bg-surface-container flex-shrink-0" />
                <div className="flex-grow space-y-2">
                  <div className="h-4 bg-surface-container rounded w-1/2" />
                  <div className="h-3 bg-surface-container rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            role="button"
            onClick={fetchAlerts}
            className="text-center py-10 font-body-md text-error bg-error/5 rounded-lg p-6 cursor-pointer hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-4xl block mb-2">wifi_off</span>
            {error}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-10 font-body-md text-on-surface-variant bg-surface-container/30 rounded-lg p-6">
            <span className="material-symbols-outlined text-4xl block mb-2 text-outline">notifications_off</span>
            No recent safety activity updates or emergency alerts found.
          </div>
        ) : (
          <div className="space-y-gutter">
            {alerts.map((alert) => {
              const borderColor = STATUS_COLORS[alert.status] || STATUS_COLORS.triggered;
              const isEmergency = alert.status === 'triggered' || alert.status === 'escalated';
              return (
                <div
                  key={alert._id}
                  className={`glass-card rounded-lg p-stack-md flex gap-stack-md border-l-4 ${borderColor}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isEmergency ? 'bg-red-100' : 'bg-emerald-100'}`}>
                    <span className={`material-symbols-outlined ${isEmergency ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isEmergency ? 'warning' : 'check_circle'}
                    </span>
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h3 className="font-label-md text-label-md text-primary truncate">
                        {alert.message || `SOS Alert`}
                      </h3>
                      <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap flex-shrink-0">
                        {formatTime(alert.timestamp || alert.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(alert)}
                      {alert.escalationLevel > 1 && (
                        <span className="text-[10px] text-orange-600 font-medium">
                          Level {alert.escalationLevel}
                        </span>
                      )}
                    </div>
                    {(alert.latitude && alert.longitude) && (
                      <p className="font-label-sm text-[11px] text-on-surface-variant mt-1">
                        📍 {Number(alert.latitude).toFixed(4)}, {Number(alert.longitude).toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Refresh FAB */}
      <button
        onClick={fetchAlerts}
        className="fixed right-6 bottom-24 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
        title="Refresh"
      >
        <span className="material-symbols-outlined">refresh</span>
      </button>
    </main>
  );
};

export default Notifications;