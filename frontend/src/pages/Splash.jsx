import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/onboarding');
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-container via-[#0d1124] to-black overflow-hidden z-[100] fixed inset-0">
      {/* Background Ambient Effects */}
      <div className="absolute inset-0 splash-overlay pointer-events-none"></div>
      
      {/* Animated Pulse Rings */}
      <div className="absolute flex items-center justify-center pointer-events-none">
        <div className="w-[300px] h-[300px] rounded-full border border-secondary/10 opacity-40 animate-pulse"></div>
        <div className="absolute w-[450px] h-[450px] rounded-full border border-secondary/5 opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute w-[600px] h-[600px] rounded-full border border-secondary/[0.02] opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main Content Cluster */}
      <div className="relative z-10 flex flex-col items-center gap-stack-lg">
        {/* Logo Section */}
        <div className="relative group cursor-pointer" onClick={() => navigate('/onboarding')}>
          {/* Inner Glow behind Logo */}
          <div className="absolute inset-0 bg-secondary/20 blur-[60px] rounded-full scale-110"></div>
          {/* Logo Image placeholder/icon */}
          <div className="relative p-8 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 pulse-glow flex items-center justify-center w-32 h-32 md:w-48 md:h-48">
            <span className="material-symbols-outlined text-[64px] md:text-[96px] text-white select-none animate-pulse-sos">
              shield_with_heart
            </span>
          </div>
        </div>

        {/* Typography Section */}
        <div className="flex flex-col items-center text-center gap-stack-sm mt-stack-md">
          <h1 className="font-headline-lg text-headline-lg md:text-display-lg text-on-primary tracking-tighter">
            SafePulse
          </h1>
          <p className="font-body-lg text-body-lg text-on-primary-container opacity-80 tracking-wide uppercase text-sm md:text-base">
            Your AI Safety Companion
          </p>
        </div>
      </div>

      {/* Bottom Loading/Indicator */}
      <div className="absolute bottom-16 flex flex-col items-center gap-stack-md">
        {/* Glassmorphism Progress Bar */}
        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
          <div className="h-full bg-gradient-to-r from-secondary to-secondary-container rounded-full animate-loading-bar"></div>
        </div>
        <span className="font-label-sm text-label-sm text-white/40 tracking-[0.2em] uppercase">
          Initializing Intelligence
        </span>
      </div>
    </div>
  );
};

export default Splash;
