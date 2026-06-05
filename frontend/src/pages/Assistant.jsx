import React from 'react';

const Assistant = () => {
  return (
    <div className="bg-background text-on-background min-h-screen w-full h-[calc(100vh-130px)] pt-4 pb-24 overflow-y-auto">
      <main className="max-w-7xl mx-auto px-container-margin">
        {/* Hero Section: AI Orb & Status */}
        <section className="flex flex-col items-center justify-center py-stack-md text-center">
          <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center mb-stack-lg">
            {/* Concentric Pulsing Rings */}
            <div className="absolute inset-0 rounded-full border-2 border-secondary/20 scale-110 opacity-40 animate-pulse"></div>
            <div className="absolute inset-4 rounded-full border border-secondary/30 scale-105 opacity-60 animate-pulse" style={{ animationDelay: '1s' }}></div>
            {/* Main Glowing Orb */}
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr from-secondary via-secondary-container to-on-tertiary-container shadow-[0_0_50px_rgba(33,112,228,0.4)] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent"></div>
              <span className="material-symbols-outlined text-white text-[64px] font-thin animate-pulse">neurology</span>
            </div>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-primary dark:text-on-primary mb-stack-sm">AI Guardian Active</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">Monitoring your surroundings in real-time. Everything appears safe for your current route.</p>
        </section>

        {/* Bento Grid Insights */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg mt-8">
          {/* Route Safety Score (Large Card) */}
          <div className="md:col-span-8 glass-card rounded-lg p-stack-lg flex flex-col justify-between shadow-sm relative overflow-hidden bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="flex justify-between items-start mb-stack-lg relative z-10">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary dark:text-on-primary mb-1">Route Safety Score</h3>
                <p className="font-label-md text-label-md text-on-surface-variant">Analysis based on current time &amp; location</p>
              </div>
              <div className="bg-secondary-container/10 px-4 py-2 rounded-full border border-secondary/20">
                <span className="font-label-md text-label-md text-secondary dark:text-safepulse-accent">Optimal</span>
              </div>
            </div>
            
            <div className="flex items-end gap-stack-md relative z-10 mt-6">
              <span className="text-[80px] font-extrabold leading-none tracking-tighter text-primary dark:text-on-primary">98</span>
              <div className="pb-3">
                <div className="flex gap-1 mb-2">
                  <div className="w-2 h-8 bg-secondary rounded-full"></div>
                  <div className="w-2 h-8 bg-secondary rounded-full"></div>
                  <div className="w-2 h-8 bg-secondary rounded-full"></div>
                  <div className="w-2 h-8 bg-secondary/30 rounded-full"></div>
                  <div className="w-2 h-8 bg-secondary/30 rounded-full"></div>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Confidence Index</p>
              </div>
            </div>
            {/* Abstract Gradient Background for Card */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          {/* Smart Recommendation (Small Card) */}
          <div className="md:col-span-4 glass-card rounded-lg p-stack-lg flex flex-col justify-between shadow-sm bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="space-y-4">
              <span className="material-symbols-outlined text-secondary dark:text-safepulse-accent text-3xl">lightbulb</span>
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">Smart Recommendation</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">The path via 5th Ave is currently better lit. Consider this alternate route for your return walk.</p>
            </div>
            <button className="mt-8 w-full py-3 bg-secondary text-on-secondary rounded-full font-label-md text-label-md hover:opacity-90 transition-opacity">View Route</button>
          </div>

          {/* Unusual Movement (Medium Card) */}
          <div className="md:col-span-6 glass-card rounded-lg p-stack-lg flex items-center gap-stack-lg shadow-sm border-l-4 border-secondary bg-white/70 dark:bg-surface-container/70 border-y border-r border-white/50">
            <div className="w-16 h-16 rounded-full bg-secondary-container/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary text-headline-md" style={{ fontVariationSettings: "'FILL' 1" }}>directions_run</span>
            </div>
            <div>
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">Movement Pattern</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Consistent pace detected. No unusual stops or deviations observed in the last 15 minutes.</p>
            </div>
          </div>

          {/* Lighting Analysis (Medium Card) */}
          <div className="md:col-span-6 glass-card rounded-lg p-stack-lg flex items-center gap-stack-lg shadow-sm bg-white/70 dark:bg-surface-container/70 border border-white/50">
            <div className="w-16 h-16 rounded-full bg-surface-container-high dark:bg-surface-container-highest flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant text-headline-md">wb_sunny</span>
            </div>
            <div>
              <h3 className="font-label-md text-label-md text-primary dark:text-on-primary font-bold">Ambient Insights</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Area lighting is rated 'Excellent'. 84% of street lamps are functional on your current block.</p>
            </div>
          </div>

          {/* Map View (Large Card) */}
          <div className="md:col-span-12 h-64 rounded-lg overflow-hidden shadow-sm relative border border-white/20">
            <img 
              alt="Route Map" 
              className="w-full h-full object-cover grayscale opacity-80 dark:invert" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDSyE3wxaCJxBaARIz_itJOBOq_vmQwEK_7Ur-4QF0Yze0GmGY25gGFXPHZo8FWhzsCi6Af-j-ynGCNfcIvPdXmX3d_vy2-RnVg5jGl4MMNExScRM3PLPBOCGQXv6Sa7Z2-k_C1vQCMESGl3GcrQhAftojDFt53IuJFRaW2Rjjou2sPt1uBIRbx1JiORx0NdxAEkXCGa-3l-5DHTiZn_XLNo9EBCOvRblQZHPgWtO2Ul3yyNYKP_P_NiRl42v3vNYfuid9feX7XGoM"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-4 glass-card px-4 py-2 rounded-full flex items-center gap-2 border border-white/40">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div>
              <span className="font-label-sm text-label-sm text-primary dark:text-on-primary">Live Tracking: Mission District</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Assistant;
