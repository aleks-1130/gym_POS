import axios from 'axios';
import { API_BASE_URL, withApiBase } from './api';

const LOCAL_API_PREFIX = '';

if (API_BASE_URL) {
    axios.defaults.baseURL = API_BASE_URL;
}

axios.interceptors.request.use((config) => {
    if (typeof config.url === 'string' && config.url.startsWith(LOCAL_API_PREFIX)) {
        const relative = config.url.slice(LOCAL_API_PREFIX.length);
        config.url = withApiBase(relative);
    }
    return config;
});
