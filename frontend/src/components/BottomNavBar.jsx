import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/',         icon: 'home',              label: 'Home',     fill: true },
  { path: '/tracking', icon: 'near_me',           label: 'Tracking', fill: true },
  { path: '/contacts', icon: 'group',             label: 'Contacts', fill: true },
  { path: '/zones',    icon: 'share_location',    label: 'Zones',    fill: true },
  { path: '/alerts',   icon: 'notifications',     label: 'Alerts',   hasBadge: true },
  { path: '/profile',  icon: 'person',            label: 'Profile' },
];

const BottomNavBar = () => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-white/70 dark:bg-surface-container-highest/70 backdrop-blur-2xl border-t border-white/40 dark:border-white/5 shadow-[0_-4px_40px_rgba(0,0,0,0.04)] rounded-t-lg pb-safe">
      <div className="mx-auto max-w-md w-full flex justify-around items-center px-2 pt-2 pb-2 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-3 py-1 cursor-pointer transition-colors duration-300 ease-out active:scale-90 ${
                isActive
                  ? 'text-secondary dark:text-secondary-fixed bg-secondary-container/10 rounded-xl'
                  : 'text-on-surface-variant dark:text-outline hover:text-secondary dark:hover:text-secondary-fixed'
              }`
            }
          >
            {({ isActive }) => (
              <div className="relative flex flex-col items-center justify-center">
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: isActive && item.fill ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="font-label-sm text-label-sm text-[10px]">{item.label}</span>
                {item.hasBadge && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full" />
                )}
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNavBar;
