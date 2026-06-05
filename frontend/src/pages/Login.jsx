import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', formData);
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        // Backend returns user data in res.data.data
        localStorage.setItem('userId', res.data.data?._id || res.data._id);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="bg-mesh min-h-screen flex flex-col font-body-md text-on-background selection:bg-secondary-fixed w-full h-[calc(100vh-130px)] pt-4 pb-24 overflow-y-auto relative">
      {/* Hero/Background Visual Area */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-tertiary-fixed-dim/10 blur-[150px]"></div>
      </div>

      {/* Main Content Canvas */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-container-margin py-8">
        <div className="w-full max-w-[480px]">
          {/* Branding Header */}
          <div className="text-center mb-stack-lg">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-white dark:bg-surface-container-high shadow-sm mb-stack-md border border-white/40">
              <span className="material-symbols-outlined text-[40px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary dark:text-on-primary tracking-tight mb-stack-sm">SafePulse</h1>
            <p className="font-body-md text-on-surface-variant max-w-[320px] mx-auto">Enter your mobile number to securely access your safety dashboard.</p>
          </div>

          {/* Login Card */}
          <div className="glass-card p-stack-lg rounded-lg shadow-[0_40px_80px_rgba(0,0,0,0.04)] border border-white/50 bg-white/70 dark:bg-surface-container/70">
            {error && <p className="text-error mb-4 text-center">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-stack-md">
              <div>
                <label className="font-label-md block ml-1 text-on-surface-variant">Email</label>
                <input 
                  className="w-full h-14 px-4 bg-surface-container-lowest border-none rounded-DEFAULT focus:ring-2 focus:ring-secondary/20 shadow-sm mt-1" 
                  type="email" required
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="font-label-md block ml-1 text-on-surface-variant">Password</label>
                <input 
                  className="w-full h-14 px-4 bg-surface-container-lowest border-none rounded-DEFAULT focus:ring-2 focus:ring-secondary/20 shadow-sm mt-1" 
                  type="password" required
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              {/* Action Button */}
              <button 
                className="w-full h-14 mt-4 bg-gradient-to-r from-secondary to-on-secondary-fixed-variant text-on-secondary rounded-DEFAULT font-label-md text-label-md inner-glow shadow-lg hover:shadow-secondary/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2" 
                type="submit"
              >
                <span>Log In</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-grow bg-outline/10"></div>
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">or</span>
                <div className="h-px flex-grow bg-outline/10"></div>
              </div>

              {/* Social/Alternative */}
              <div className="grid grid-cols-2 gap-stack-md">
                <button 
                  onClick={() => navigate('/')}
                  className="flex items-center justify-center h-12 bg-white dark:bg-surface-container border border-black/5 rounded-DEFAULT font-label-md text-label-md text-on-surface hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors gap-2" 
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                  <span>Biometric</span>
                </button>
                <button 
                  onClick={() => navigate('/')}
                  className="flex items-center justify-center h-12 bg-white dark:bg-surface-container border border-black/5 rounded-DEFAULT font-label-md text-label-md text-on-surface hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors gap-2" 
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">key</span>
                  <span>Passkey</span>
                </button>
              </div>
            </form>

            <p className="mt-6 text-center text-label-sm text-on-surface-variant">
              Don't have an account? <Link to="/register" className="text-secondary font-bold">Register</Link>
            </p>
          </div>

          {/* Trust Badge */}
          <div className="mt-stack-lg flex items-center justify-center gap-stack-md opacity-60">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-on-surface">lock</span>
              <span className="font-label-sm text-label-sm text-on-surface">End-to-End Encrypted</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-outline/30"></div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-on-surface">verified_user</span>
              <span className="font-label-sm text-label-sm text-on-surface">GDPR Compliant</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
