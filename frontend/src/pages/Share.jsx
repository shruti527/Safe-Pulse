import React from 'react';

const Share = () => {
  return (
    <main className="flex-grow relative w-full h-[calc(100vh-130px)] overflow-hidden">
      {/* Interactive Map Base */}
      <div className="absolute inset-0 w-full h-full bg-surface-container-lowest">
        <img className="w-full h-full object-cover opacity-60 dark:opacity-30 dark:invert" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAaabN-8hzt0QbEso1stfo0XScgZci5un6fqM755ND1zcJsCAHqR1AHB4cDW4COKFg_wqTgtsco5gK-09I31uAftlWk2AUAF_zyPku8mcEZT3NlgISgmyNGewtrILqnOnnqCooK56BUfuY--5SzFFe31oOj3hEb3mTVPpbsgw7XGecQafoAt-ZWp66BZihgUfGkKCwM7wJwwHiw4ikvLfVtQIcarFmww0bMCo8obr4X3om54ySr95tFjh8aygdJVw-ktyh-hBV0Ov4" alt="Map" />
        <div className="absolute inset-0 map-gradient-overlay dark:opacity-50"></div>

        {/* Map Markers */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Tracking Node */}
          <div className="relative">
            <div className="absolute -inset-12 pulse-ring rounded-full bg-secondary/10 pointer-events-none"></div>
            <div className="w-16 h-16 rounded-full glass-card flex items-center justify-center border border-secondary/30 shadow-lg relative z-10">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-secondary">
                <img alt="Tracked Person" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFNvRaWZD72TbOYPOVXGFh-WuErXyrAy49Oom1mf5lrYl2VeZnTfq5Gfp1kCVl1xbqTO_BUf7-mipfz9-wsJLn_MQbOodIOGGfJU_8wgksiDyFaJC8Fc7A-tRyn1qoqL312t2UT1N8Nj77ghOiXskVFzqfQ6uQLZnINaWIPU6rMCGnypN8px52y5B3hYrB_1bM-0wqXhjZJxEp96fNi2hvQqfWrZRd_2tkkqu64RHYoxKVnGFXGX3xTCVBP_jDZ_LFI8Z2J2Z5DKk" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Float Controls */}
      <div className="absolute top-gutter right-gutter flex flex-col gap-stack-md z-20">
        <button className="w-12 h-12 rounded-full glass-card flex items-center justify-center shadow-md border border-white/40 text-primary active:scale-95 transition-all">
          <span className="material-symbols-outlined">my_location</span>
        </button>
        <button className="w-12 h-12 rounded-full glass-card flex items-center justify-center shadow-md border border-white/40 text-primary active:scale-95 transition-all">
          <span className="material-symbols-outlined">layers</span>
        </button>
      </div>

      {/* Bottom ETA Card Container */}
      <div className="absolute bottom-6 left-0 w-full px-container-margin z-30 flex justify-center pb-24">
        <div className="w-full max-w-lg glass-card rounded-lg p-stack-lg shadow-[0_-4px_40px_rgba(0,0,0,0.04)] border border-white/50 bg-white/70 dark:bg-surface-container/70">
          <div className="flex justify-between items-start mb-stack-lg">
            <div className="space-y-base">
              <div className="flex items-center gap-stack-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"></span>
                <span className="font-label-md text-label-md text-emerald-600 dark:text-emerald-400">AI Safety Monitor: Active</span>
              </div>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tight text-primary dark:text-on-primary">Arriving in 12 mins</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Destination: Home (Sunset Blvd)</p>
            </div>
            <div className="flex flex-col items-end gap-stack-sm">
              <div className="flex items-center gap-stack-sm bg-surface-container-high dark:bg-surface-container-highest px-stack-md py-base rounded-full">
                <span className="material-symbols-outlined text-secondary text-[18px]">speed</span>
                <span className="font-label-md text-label-md text-on-surface">15 km/h</span>
              </div>
              <div className="flex items-center gap-stack-sm bg-surface-container-high dark:bg-surface-container-highest px-stack-md py-base rounded-full">
                <span className="material-symbols-outlined text-emerald-500 text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>battery_full</span>
                <span className="font-label-md text-label-md text-on-surface">82%</span>
              </div>
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="relative h-1 bg-surface-container-high dark:bg-surface-container-highest rounded-full overflow-hidden mb-stack-md">
            <div className="absolute left-0 top-0 h-full w-[65%] bg-gradient-to-r from-secondary to-secondary-container rounded-full"></div>
          </div>
          <div className="flex justify-between items-center font-label-sm text-label-sm text-outline">
            <span>Departed 4:15 PM</span>
            <span className="text-secondary font-bold">6.2 km to go</span>
            <span>ETA 4:42 PM</span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-stack-md mt-stack-lg">
            <button className="bg-surface-container-high dark:bg-surface-container-highest text-on-surface-variant py-3 rounded-full font-label-md text-label-md flex items-center justify-center gap-stack-sm hover:bg-surface-dim transition-colors">
              <span className="material-symbols-outlined text-[20px]">call</span>
              Contact
            </button>
            <button className="bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md flex items-center justify-center gap-stack-sm shadow-md hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-[20px]">share_location</span>
              Share Live
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Share;
