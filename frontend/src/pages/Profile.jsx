import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/* ─── helpers ─── */
const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const memberSinceFromId = (id) => {
  try {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

/* ─── tiny sub-components ─── */
const Toggle = ({ enabled, onToggle, colorClass = 'bg-secondary-container' }) => (
  <button
    role="switch"
    aria-checked={enabled}
    onClick={onToggle}
    className={`w-12 h-6 rounded-full relative p-1 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary ${
      enabled ? colorClass : 'bg-surface-container-highest'
    }`}
  >
    <span
      className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);

const SettingRow = ({ icon, label, subtitle, right, onClick, border = true }) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    onClick={onClick}
    className={`flex items-center justify-between p-4 transition-colors ${
      onClick ? 'cursor-pointer hover:bg-white/50 focus:outline-none focus:bg-white/50' : ''
    } ${border ? 'border-b border-black/5' : ''}`}
  >
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="font-label-md text-label-md text-on-surface leading-snug">{label}</p>
        {subtitle && (
          <p className="font-label-sm text-label-sm text-on-surface-variant leading-snug mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    <div className="shrink-0 ml-4">{right}</div>
  </div>
);

const SectionCard = ({ title, children }) => (
  <div className="space-y-2">
    <h3 className="px-4 font-label-md text-label-md text-outline uppercase tracking-wider text-xs">
      {title}
    </h3>
    <div className="glass-card rounded-xl overflow-hidden">{children}</div>
  </div>
);

const ErrorBanner = ({ message, onRetry }) => (
  <div className="mx-auto max-w-xl px-4 pt-20">
    <div className="glass-card rounded-xl p-6 flex flex-col items-center gap-4 text-center">
      <span className="material-symbols-outlined text-error text-4xl">error_outline</span>
      <p className="font-label-md text-label-md text-on-surface">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      )}
    </div>
  </div>
);

const SkeletonPulse = ({ className }) => (
  <div className={`animate-pulse bg-surface-container rounded-md ${className}`} />
);

const ProfileSkeleton = () => (
  <main className="max-w-xl mx-auto px-4 py-stack-lg flex-grow overflow-y-auto pb-32 pt-20">
    <section className="flex flex-col items-center mb-8 mt-16">
      <div className="w-24 h-24 rounded-full bg-surface-container animate-pulse" />
      <SkeletonPulse className="mt-4 w-36 h-5" />
      <SkeletonPulse className="mt-2 w-48 h-4" />
      <SkeletonPulse className="mt-2 w-28 h-3" />
    </section>
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="space-y-2 mb-4">
        <SkeletonPulse className="w-24 h-3 mx-4" />
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 flex items-center gap-4 border-b border-black/5">
            <SkeletonPulse className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="w-32 h-4" />
              <SkeletonPulse className="w-48 h-3" />
            </div>
          </div>
          <div className="p-4 flex items-center gap-4">
            <SkeletonPulse className="w-10 h-10 rounded-full" />
            <SkeletonPulse className="w-40 h-4 flex-1" />
          </div>
        </div>
      </div>
    ))}
  </main>
);

/* ─── Avatar component: simple user icon ─── */
const Avatar = () => {
  return (
    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-surface-container flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-[56px] select-none">
        person
      </span>
    </div>
  );
};

/* ─── main component ─── */
const Profile = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const [ghostMode, setGhostMode] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);

  /* ─── fetch user ─── */
  const fetchUser = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        navigate('/login');
        return;
      }

      const { data } = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        // Reasonable timeout so the skeleton doesn't hang forever
        timeout: 10_000,
      });

      setUser(data.data);
      setGhostMode(data.data.ghostMode ?? false);
      setPushNotifs(data.data.pushNotifications ?? true);
      setStatus('success');
    } catch (err) {
      const httpStatus = err.response?.status;

      if (httpStatus === 401 || httpStatus === 403) {
        // Token invalid / expired – redirect cleanly
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      const msg =
        err.code === 'ECONNABORTED'
          ? 'Request timed out. Check your connection and try again.'
          : err.response?.data?.message || err.message || 'Failed to load profile.';

      setErrorMsg(msg);
      setStatus('error');
      console.error('[Profile] fetchUser error:', err);
    }
  }, [navigate]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  /* ─── actions ─── */
  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  const handleToggleGhostMode = async () => {
    const newVal = !ghostMode;
    setGhostMode(newVal);
    try {
      await axios.put('/api/auth/settings', { ghostMode: newVal });
    } catch (err) {
      console.error('Failed to update ghost mode:', err);
      setGhostMode(ghostMode);
    }
  };

  const handleTogglePushNotifs = async () => {
    const newVal = !pushNotifs;
    setPushNotifs(newVal);
    try {
      await axios.put('/api/auth/settings', { pushNotifications: newVal });
    } catch (err) {
      console.error('Failed to update push notifications:', err);
      setPushNotifs(pushNotifs);
    }
  };

  /* ─── render states ─── */
  if (status === 'loading') return <ProfileSkeleton />;

  if (status === 'error') {
    return (
      <ErrorBanner
        message={errorMsg || 'Something went wrong.'}
        onRetry={fetchUser}
      />
    );
  }

  /* ─── derived values (only after data is available) ─── */
  const memberSince = user._id ? memberSinceFromId(user._id) : '';
  const acceptedContacts = user.contacts?.filter((c) => c.status === 'accepted').length ?? 0;

  return (
    <main className="max-w-xl mx-auto px-4 py-stack-lg flex-grow overflow-y-auto pb-32 pt-20">
      {/* ── Profile Header ── */}
      <section className="flex flex-col items-center mb-8 mt-16" aria-label="Profile header">
        <div className="relative group">
          <Avatar />
        </div>

        <h2 className="mt-4 font-headline-md text-headline-md text-primary">{user.name}</h2>
        <p className="font-label-md text-label-md text-on-surface-variant">{user.email}</p>
        {user.phone && (
          <p className="font-label-sm text-label-sm text-on-surface-variant">{user.phone}</p>
        )}
        {memberSince && (
          <p className="font-label-sm text-label-sm text-outline mt-1">Member since {memberSince}</p>
        )}
      </section>

      <div className="space-y-4">
        {/* ── Privacy & Security ── */}
        <SectionCard title="Privacy & Security">
          <SettingRow
            icon="visibility_off"
            label="Ghost Mode"
            subtitle={ghostMode ? 'Hidden from all contacts' : 'Visible to contacts'}
            onClick={handleToggleGhostMode}
            right={<Toggle enabled={ghostMode} onToggle={handleToggleGhostMode} />}
          />
          <SettingRow
            icon="group"
            label="Trusted Contacts"
            subtitle={`${acceptedContacts} accepted contact${acceptedContacts !== 1 ? 's' : ''}`}
            onClick={() => navigate('/contacts')}
            right={<span className="material-symbols-outlined text-outline">chevron_right</span>}
            border={false}
          />
        </SectionCard>

        {/* ── Alerts ── */}
        <SectionCard title="Alerts">
          <SettingRow
            icon="notifications"
            label="Push Notifications"
            onClick={handleTogglePushNotifs}
            right={<Toggle enabled={pushNotifs} onToggle={handleTogglePushNotifs} />}
          />
          <SettingRow
            icon="emergency_share"
            label="Smart Alerts"
            onClick={() => navigate('/alerts')}
            right={<span className="material-symbols-outlined text-outline">chevron_right</span>}
            border={false}
          />
        </SectionCard>

        {/* ── Information ── */}
        <SectionCard title="Information">
          <SettingRow
            icon="help_center"
            label="Support Center"
            onClick={() => window.open('https://support.example.com', '_blank', 'noopener')}
            right={<span className="material-symbols-outlined text-outline">open_in_new</span>}
          />
          <SettingRow
            icon="policy"
            label="Legal & Privacy Policy"
            onClick={() => {/* navigate('/legal') */}}
            right={<span className="material-symbols-outlined text-outline">chevron_right</span>}
            border={false}
          />
        </SectionCard>

        {/* ── Sign Out ── */}
        <button
          onClick={handleLogout}
          className="w-full mt-4 p-4 glass-card rounded-xl flex items-center justify-center gap-3 hover:bg-error-container/10 transition-colors group focus:outline-none focus:ring-2 focus:ring-error"
          aria-label="Sign out"
        >
          <span className="material-symbols-outlined text-error group-hover:scale-110 transition-transform">
            logout
          </span>
          <span className="font-label-md text-label-md text-error">Sign Out</span>
        </button>

        <p className="text-center font-label-sm text-label-sm text-outline mt-4 pb-4">
          SafePulse v1.0.0
        </p>
      </div>
    </main>
  );
};

export default Profile;