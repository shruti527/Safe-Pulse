import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/alerts',  icon: 'notifications',   hasBadge: true },
  { path: '/profile', icon: 'person'},
];


const TopAppBar = () => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/70 dark:bg-surface-container/70 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-sm pt-safe">
      <div className="flex justify-between items-center w-full px-container-margin py-base max-w-7xl mx-auto h-16">
        <div className="flex items-center gap-stack-sm">
          <span className="material-symbols-outlined text-primary dark:text-on-primary text-headline-md">shield_with_heart</span>
          <span className="font-headline-md text-headline-md font-bold tracking-tight text-primary dark:text-on-primary">SafePulse</span>
        </div>
        <div className="flex items-center gap-stack-md">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center px-2 py-1 cursor-pointer transition-colors duration-300 ease-out active:scale-90 rounded-xl ${
                  isActive
                    ? 'text-secondary dark:text-secondary-fixed bg-secondary-container/10'
                    : 'text-on-surface-variant dark:text-outline hover:text-secondary dark:hover:text-secondary-fixed'
                }`
              }
            >
              {({ isActive }) => (
                <div className="relative flex flex-col items-center justify-center">
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
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
      </div>
    </header>
  );
};

export default TopAppBar;
