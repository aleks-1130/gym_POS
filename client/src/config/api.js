import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Configure global axios default to send httpOnly cookies automatically
axios.defaults.withCredentials = true;

const BRANCH_SWITCH_ROLES = new Set(['OWNER']);
const BRANCH_LOCKED_ROLES = new Set(['STAFF', 'TRAINER']);

const parseStoredUser = () => {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const normalizeGymId = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const collectResponseGymIds = (payload) => {
    const ids = new Set();
    const add = (value) => {
        const normalized = normalizeGymId(value);
        if (normalized !== null) ids.add(normalized);
    };

    if (!payload) return ids;

    const inspectItem = (item) => {
        if (!item || typeof item !== 'object') return;
        add(item.gymId);
        add(item?.gym?.id);
    };

    if (Array.isArray(payload)) {
        payload.forEach(inspectItem);
        return ids;
    }

    inspectItem(payload);
    if (Array.isArray(payload?.data)) {
        payload.data.forEach(inspectItem);
    }

    return ids;
};

// Add x-gym-id interceptor for OWNER branch switching
axios.interceptors.request.use(config => {
    // Only add the header if the request is going to our API BASE URL or is a relative path
    const isInternal = !config.url || config.url.startsWith('/') || config.url.startsWith(API_BASE_URL);
    if (isInternal) {
        const user = parseStoredUser();
        const role = String(user?.role || '').toUpperCase();
        const activeGymId = normalizeGymId(localStorage.getItem('activeGymId'));

        if (BRANCH_SWITCH_ROLES.has(role) && activeGymId !== null) {
            config.headers = config.headers || {};
            config.headers['x-gym-id'] = String(activeGymId);
        }
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// Defense-in-depth warning for branch-locked roles
axios.interceptors.response.use((response) => {
    const user = parseStoredUser();
    const role = String(user?.role || '').toUpperCase();
    if (!BRANCH_LOCKED_ROLES.has(role)) return response;

    const activeGymId = normalizeGymId(localStorage.getItem('activeGymId'));
    if (activeGymId === null) return response;

    const gymIds = collectResponseGymIds(response?.data);
    for (const gymId of gymIds) {
        if (gymId !== activeGymId) {
            console.warn(`[TENANT] Response gymId mismatch: ${gymId} vs active: ${activeGymId}`);
            break;
        }
    }

    return response;
}, (error) => Promise.reject(error));

export const withApiBase = (path) => {
    if (!path) return API_BASE_URL;
    if (/^https?:\/\//i.test(path)) return path;
    if (!API_BASE_URL) return path;
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
};

