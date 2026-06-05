import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TemporarySharing = () => {
  const navigate = useNavigate();
  const [activeDuration, setActiveDuration] = useState('1 Hour');
  const [customRange, setCustomRange] = useState(150); // minutes (2h 30m)

  const handleConfirm = () => {
    alert(`Temporary location sharing active for ${activeDuration === 'Custom' ? formatMinutes(customRange) : activeDuration}!`);
    navigate('/');
  };

  const formatMinutes = (mins) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return hrs > 0 ? `${hrs}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
  };

  const handleCustomChange = (e) => {
    setActiveDuration('Custom');
    setCustomRange(parseInt(e.target.value));
  };

  return (
    <div className="bg-background text-on-background min-h-screen w-full h-[calc(100vh-130px)] pt-4 pb-24 overflow-y-auto">
      <main className="max-w-7xl mx-auto px-container-margin">
        {/* Header Section */}
        <header className="mb-8">
          <h1 className="font-headline-lg text-headline-lg text-primary dark:text-on-primary mb-stack-sm">Share Location</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Choose how long you want your trusted contacts to see your real-time location. Access automatically expires for your privacy.
          </p>
        </header>

        {/* Main Interaction Area: Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg mt-8">
          {/* Selection Panel (8 Columns) */}
          <div className="md:col-span-8 space-y-stack-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              {/* 15 Minutes */}
              <button 
                onClick={() => setActiveDuration('15 Minutes')}
                className={`glass-card group flex flex-col items-start p-stack-lg rounded-lg border text-left transition-all active:scale-95 duration-200 ${
                  activeDuration === '15 Minutes'
                    ? 'border-secondary bg-secondary-container/5'
                    : 'border-black/5 dark:border-white/5 hover:border-secondary'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-stack-md transition-colors ${
                  activeDuration === '15 Minutes'
                    ? 'bg-secondary text-white'
                    : 'bg-secondary/10 text-secondary'
                }`}>
                  <span className="material-symbols-outlined">timer</span>
                </div>
                <span className="font-headline-md text-headline-md text-primary dark:text-on-primary">15 Minutes</span>
                <span className="font-label-md text-label-md text-on-surface-variant">Quick trip or walk</span>
              </button>

              {/* 1 Hour */}
              <button 
                onClick={() => setActiveDuration('1 Hour')}
                className={`glass-card group flex flex-col items-start p-stack-lg rounded-lg border text-left transition-all active:scale-95 duration-200 relative ${
                  activeDuration === '1 Hour'
                    ? 'border-secondary bg-secondary-container/5'
                    : 'border-black/5 dark:border-white/5 hover:border-secondary'
                }`}
              >
                {activeDuration === '1 Hour' && (
                  <div className="absolute top-4 right-4 text-secondary">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                )}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-stack-md transition-colors ${
                  activeDuration === '1 Hour'
                    ? 'bg-secondary text-white'
                    : 'bg-secondary/10 text-secondary'
                }`}>
                  <span className="material-symbols-outlined">schedule</span>
                </div>
                <span className="font-headline-md text-headline-md text-primary dark:text-on-primary">1 Hour</span>
                <span className="font-label-md text-label-md text-on-surface-variant">Standard security window</span>
              </button>

              {/* 4 Hours */}
              <button 
                onClick={() => setActiveDuration('4 Hours')}
                className={`glass-card group flex flex-col items-start p-stack-lg rounded-lg border text-left transition-all active:scale-95 duration-200 ${
                  activeDuration === '4 Hours'
                    ? 'border-secondary bg-secondary-container/5'
                    : 'border-black/5 dark:border-white/5 hover:border-secondary'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-stack-md transition-colors ${
                  activeDuration === '4 Hours'
                    ? 'bg-secondary text-white'
                    : 'bg-secondary/10 text-secondary'
                }`}>
                  <span className="material-symbols-outlined">nightlight</span>
                </div>
                <span className="font-headline-md text-headline-md text-primary dark:text-on-primary">4 Hours</span>
                <span className="font-label-md text-label-md text-on-surface-variant">Night out or long travel</span>
              </button>

              {/* Always */}
              <button 
                onClick={() => setActiveDuration('Always')}
                className={`glass-card group flex flex-col items-start p-stack-lg rounded-lg border text-left transition-all active:scale-95 duration-200 ${
                  activeDuration === 'Always'
                    ? 'border-secondary bg-secondary-container/5'
                    : 'border-black/5 dark:border-white/5 hover:border-secondary'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-stack-md transition-colors ${
                  activeDuration === 'Always'
                    ? 'bg-secondary text-white'
                    : 'bg-secondary/10 text-secondary'
                }`}>
                  <span className="material-symbols-outlined">all_inclusive</span>
                </div>
                <span className="font-headline-md text-headline-md text-primary dark:text-on-primary">Always</span>
                <span className="font-label-md text-label-md text-on-surface-variant">Permanent trusted circle</span>
              </button>
            </div>

            {/* Custom Duration Card */}
            <div className="glass-card p-stack-lg rounded-lg border border-black/5 dark:border-white/5 bg-white/70 dark:bg-surface-container/70">
              <div className="flex items-center justify-between mb-stack-md">
                <h3 className="font-headline-md text-headline-md text-primary dark:text-on-primary">Custom Duration</h3>
                <span className="material-symbols-outlined text-on-surface-variant">more_time</span>
              </div>
              <div className="flex items-center gap-stack-md">
                <input 
                  className="flex-grow accent-secondary h-2 bg-surface-container rounded-full appearance-none cursor-pointer" 
                  type="range"
                  min="15"
                  max="480"
                  step="15"
                  value={customRange}
                  onChange={handleCustomChange}
                />
                <span className="font-label-md text-label-md text-secondary bg-secondary/10 px-3 py-1 rounded-full whitespace-nowrap min-w-[70px] text-center">
                  {formatMinutes(customRange)}
                </span>
              </div>
            </div>
          </div>

          {/* Contextual Visualization (4 Columns) */}
          <div className="md:col-span-4 space-y-stack-lg">
            {/* Privacy Visualization Card */}
            <div className="glass-card p-stack-lg rounded-lg border border-black/5 dark:border-white/5 flex flex-col items-center text-center bg-white/70 dark:bg-surface-container/70">
              <div className="relative w-48 h-48 mb-stack-lg flex items-center justify-center">
                {/* Pulsing concentric rings */}
                <div className="absolute inset-0 rounded-full border-2 border-secondary/10 animate-pulse"></div>
                <div className="absolute inset-4 rounded-full border-2 border-secondary/20 animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center safety-pulse relative z-10">
                  <span className="material-symbols-outlined text-white text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                </div>
              </div>
              
              <div className="space-y-stack-sm">
                <h4 class="font-headline-md text-headline-md text-primary dark:text-on-primary">Active Protection</h4>
                <p className="font-label-md text-label-md text-on-surface-variant">Sharing ends at 11:45 PM</p>
              </div>
              {/* Privacy chip */}
              <div className="mt-stack-lg bg-surface-container-high dark:bg-surface-container-highest px-4 py-2 rounded-full flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">End-to-End Encrypted</span>
              </div>
            </div>

            {/* AI Insight Card */}
            <div className="bg-primary-container p-stack-lg rounded-lg text-white">
              <div className="flex items-center gap-2 mb-stack-md">
                <span className="material-symbols-outlined text-secondary-fixed">auto_awesome</span>
                <span className="font-label-md text-label-md text-secondary-fixed">AI Suggestion</span>
              </div>
              <p className="font-body-md text-body-md text-on-primary opacity-90">
                Based on your routine "Late Night Walk Home," a <strong>45-minute</strong> window is usually sufficient.
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-stack-md">
          <button 
            onClick={handleConfirm}
            className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-secondary to-[#8257e5] text-white rounded-full font-label-md text-label-md inner-glow shadow-lg hover:opacity-90 transition-opacity active:scale-95 duration-200"
          >
            Confirm Sharing
          </button>
          <button 
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-10 py-4 bg-transparent text-on-surface-variant border border-outline-variant rounded-full font-label-md text-label-md hover:bg-surface-container dark:hover:bg-surface-container-highest transition-colors active:scale-95 duration-200"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
};

export default TemporarySharing;
