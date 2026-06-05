import React from 'react';
import { useNavigate } from 'react-router-dom';

const Onboarding = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col items-center justify-center p-container-margin overflow-y-auto relative w-full h-[calc(100vh-130px)] pt-4 pb-24">
      {/* Background Decorative Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[100px] -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/5 rounded-full blur-[100px] -z-10"></div>

      {/* Onboarding Container */}
      <main className="max-w-[440px] w-full flex flex-col items-center relative">
        {/* Abstract Illustration Area */}
        <div className="w-full aspect-square mb-stack-lg relative flex items-center justify-center">
          {/* Background Decorative Glows */}
          <div className="absolute inset-0 bg-gradient-to-tr from-secondary/10 to-tertiary/5 rounded-full blur-3xl opacity-50 scale-125"></div>
          <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
            <img 
              alt="AI Safety Visual" 
              className="w-4/5 h-4/5 object-contain rounded-xl shadow-lg border border-white/20" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBpDtwcNAoxHuwY17wjfQuU0um-CctmX7r2l_cOIjDIMRWGeUcv6DNE3mqR3us00Dg9VMk30Q9XqzHY8Ztk7lzN1Dew79mrAQKdwlBCOJoEhOfnkZv6szIrrgJwTiuE5Ej5cVNbNNPBSWbZszg0ffN8mGmc7eWetiY-RZrZpHTzTk-D_at-zFCe5yKC587J7j6I_lg8c0EdpCcQAj0H8s5JL2QzGjQDYbPJ5An-OdI9BPaEGekm1U0Pyx7F5AJUNJ6JbLQLUr7hdEQ"
            />
            {/* Overlay "Safety Pulse" Indicator */}
            <div className="absolute bottom-10 right-10 bg-white/80 dark:bg-surface-container/80 backdrop-blur-md p-4 rounded-lg shadow-xl border border-white/50 dark:border-white/10 flex items-center gap-3">
              <div className="w-3 h-3 bg-secondary rounded-full concentric-pulse relative">
                <span className="absolute -inset-1.5 rounded-full border-2 border-secondary/40 animate-ping"></span>
              </div>
              <span className="font-label-md text-label-md text-secondary dark:text-safepulse-accent">Vigilance Active</span>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="glass-card p-stack-lg rounded-lg w-full flex flex-col items-center text-center">
          {/* Headlines */}
          <div className="space-y-stack-sm mb-stack-lg">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg tracking-tight text-primary dark:text-on-primary">
              AI Safety Protection
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-[320px] mx-auto">
              Experience calm vigilance with predictive intelligence that monitors your environment in real-time.
            </p>
          </div>

          {/* Feature Grid (Subtle) */}
          <div className="grid grid-cols-2 gap-stack-md w-full mb-stack-lg">
            <div className="flex flex-col items-center p-stack-md bg-surface-container-low dark:bg-surface-container-high rounded-DEFAULT border border-black/5 dark:border-white/5">
              <span className="material-symbols-outlined text-secondary dark:text-safepulse-accent mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
              <span className="font-label-md text-label-md text-on-surface">Secure Shield</span>
            </div>
            <div className="flex flex-col items-center p-stack-md bg-surface-container-low dark:bg-surface-container-high rounded-DEFAULT border border-black/5 dark:border-white/5">
              <span className="material-symbols-outlined text-secondary dark:text-safepulse-accent mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>my_location</span>
              <span className="font-label-md text-label-md text-on-surface">Arrival Alerts</span>
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex gap-2 mb-stack-lg">
            <div className="w-8 h-1.5 rounded-full bg-secondary"></div>
            <div className="w-2 h-1.5 rounded-full bg-outline-variant"></div>
            <div className="w-2 h-1.5 rounded-full bg-outline-variant"></div>
          </div>

          {/* Action Button */}
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-gradient-to-r from-secondary to-secondary-container text-on-secondary py-5 px-stack-lg rounded-lg font-label-md text-label-md glow-button hover:opacity-90 transition-all active:scale-[0.98] shadow-md"
          >
            Next
          </button>
          
          {/* Secondary Action */}
          <button 
            onClick={() => navigate('/login')}
            className="mt-stack-md font-label-md text-label-md text-outline hover:text-primary dark:hover:text-on-primary transition-colors"
          >
            Skip Introduction
          </button>
        </div>

        {/* Footer Identity */}
        <div className="mt-stack-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary dark:text-on-primary" style={{ fontSize: '20px' }}>shield_with_heart</span>
          <span className="font-label-md text-label-md font-extrabold tracking-widest text-primary dark:text-on-primary uppercase">SafePulse</span>
        </div>
      </main>
    </div>
  );
};

export default Onboarding;
