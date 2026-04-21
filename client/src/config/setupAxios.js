import axios from 'axios';
import { API_BASE_URL, withApiBase } from './api';

const LOCAL_API_PREFIX = '';

if (API_BASE_URL) {
    axios.defaults.baseURL = API_BASE_URL;
    axios.defaults.withCredentials = true;
}

axios.interceptors.request.use((config) => {
    if (typeof config.url === 'string' && config.url.startsWith(LOCAL_API_PREFIX)) {
        const relative = config.url.slice(LOCAL_API_PREFIX.length);
        config.url = withApiBase(relative);
    }

    // Attach Bearer token for cross-domain auth (Vercel → Railway)
    // Cookies don't work cross-domain, so we use Authorization header instead
    const token = localStorage.getItem('authToken');
    if (token && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
});
