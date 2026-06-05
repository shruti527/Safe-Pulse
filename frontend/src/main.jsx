import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios';
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'

// Set axios base URL relative to VITE_API_URL (excluding '/api' suffix) or default to localhost:5000
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
axios.defaults.baseURL = apiUrl.replace(/\/api\/?$/, '');

// Global request interceptor — attach JWT Authorization header to every request
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor — auto-logout on 401/403 (token expired or invalid)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      const currentPath = window.location.pathname;
      // Don't redirect if already on public pages to avoid redirect loops
      const publicPaths = ['/login', '/register', '/splash', '/onboarding'];
      if (!publicPaths.includes(currentPath)) {
        console.warn('[AUTH] Token expired or unauthorized. Redirecting to login.');
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
