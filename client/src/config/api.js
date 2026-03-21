import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Configure global axios default to send httpOnly cookies automatically
axios.defaults.withCredentials = true;

// Add x-gym-id interceptor for Owners/Admins to switch branch context
axios.interceptors.request.use(config => {
    const gymId = localStorage.getItem('activeGymId');
    if (gymId) {
        config.headers['x-gym-id'] = gymId;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

export const withApiBase = (path) => {
    if (!path) return API_BASE_URL;
    if (/^https?:\/\//i.test(path)) return path;
    if (!API_BASE_URL) return path;
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
};
