import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/register', formData);
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        // Backend returns user data in res.data.data
        localStorage.setItem('userId', res.data.data?._id || res.data._id);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="bg-mesh min-h-[100dvh] flex flex-col font-body-md text-on-background w-full">
      <main className="relative z-10 flex-grow flex items-center justify-center px-container-margin py-8">
        <div className="w-full max-w-[480px]">
          <div className="text-center mb-stack-lg">
            <h1 className="font-headline-lg text-headline-lg tracking-tight mb-stack-sm">Create Account</h1>
            <p className="font-body-md text-on-surface-variant max-w-[320px] mx-auto">Join SafePulse to stay connected and secure.</p>
          </div>

          <div className="glass-card p-stack-lg rounded-lg border border-white/50 shadow-lg">
            {error && <p className="text-error mb-4 text-center">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-stack-md">
              <div>
                <label className="font-label-md block ml-1 text-on-surface-variant">Full Name</label>
                <input 
                  className="w-full h-14 px-4 bg-surface-container-lowest border-none rounded-DEFAULT focus:ring-2 focus:ring-secondary/20 shadow-sm mt-1" 
                  type="text" required
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="font-label-md block ml-1 text-on-surface-variant">Email</label>
                <input 
                  className="w-full h-14 px-4 bg-surface-container-lowest border-none rounded-DEFAULT focus:ring-2 focus:ring-secondary/20 shadow-sm mt-1" 
                  type="email" required
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="font-label-md block ml-1 text-on-surface-variant">Phone Number</label>
                <input 
                  className="w-full h-14 px-4 bg-surface-container-lowest border-none rounded-DEFAULT focus:ring-2 focus:ring-secondary/20 shadow-sm mt-1" 
                  type="tel" required placeholder="+1 234 567 8900"
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="font-label-md block ml-1 text-on-surface-variant">Password</label>
                <input 
                  className="w-full h-14 px-4 bg-surface-container-lowest border-none rounded-DEFAULT focus:ring-2 focus:ring-secondary/20 shadow-sm mt-1" 
                  type="password" required minLength="6"
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              
              <button className="w-full h-14 bg-secondary text-white rounded-DEFAULT font-label-md mt-4 hover:opacity-90" type="submit">
                Register
              </button>
            </form>
            
            <p className="mt-6 text-center text-label-sm text-on-surface-variant">
              Already have an account? <Link to="/login" className="text-secondary font-bold">Log In</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
