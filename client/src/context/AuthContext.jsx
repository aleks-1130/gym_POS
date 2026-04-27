import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { withApiBase } from '../config/api';
import { createAuthClient } from '@neondatabase/neon-js/auth';

const AuthContext = createContext();

// Initialize Neon Auth Client
// We use the URL from environment variables
const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_API_URL || import.meta.env.VITE_NEON_AUTH_URL;
let authClient = null;
let authClientInitError = null;

try {
    if (!neonAuthUrl) {
        console.error("Missing Neon Auth URL. Set VITE_NEON_AUTH_API_URL or VITE_NEON_AUTH_URL.");
    } else {
        authClient = createAuthClient(neonAuthUrl);
    }
} catch (error) {
    authClientInitError = error;
    console.error("Failed to initialize Neon Auth client:", error);
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [activeGymId, setActiveGymId] = useState(localStorage.getItem('activeGymId') || null);
    const [loading, setLoading] = useState(true);

    const isAuthClientReady = Boolean(authClient);

    const clearLocalSession = () => {
        setUser(null);
        setActiveGymId(null);
        localStorage.removeItem('user');
        localStorage.removeItem('activeGymId');
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('user');
    };

    const syncUserWithBackend = async () => {
        try {
            const res = await axios.get(withApiBase('/api/auth/me'));
            return res.data; 
        } catch (e) {
            // 401 is expected when no session exists (e.g. initial page load before login)
            if (e.response?.status !== 401) {
                console.error("Failed to sync user with backend. Error data:", e.response?.data);
                console.error("Error Message:", e.message);
            }
            return null;
        }
    };

    const login = async (email, password) => {
        try {
            if (!isAuthClientReady) {
                throw new Error("Authentication client is not available on this browser.");
            }

            const result = await authClient.signIn.email({
                email,
                password
            });

            if (result.error) {
                console.error("Neon Auth Error:", result.error);
                throw new Error(result.error.message);
            }

            const data = result.data;
            const authToken = data.token || data.session?.token || data.session?.access_token;

            if (!authToken) {
                console.error("Login Success, but no Access Token found in:", data);
                throw new Error("Authentication failed to provide token");
            }

            try {
                const backendLoginRes = await axios.post(withApiBase('/api/auth/login'), { 
                    email, 
                    password,
                    neonToken: authToken 
                });
                const backendUser = backendLoginRes.data.user;
                const backendToken = backendLoginRes.data.token;

                if (!backendUser) {
                    throw new Error("Failed to retrieve user role from system.");
                }

                // Store token for cross-domain Bearer auth (cookie won't work cross-domain)
                if (backendToken) {
                    localStorage.setItem('authToken', backendToken);
                }

                // Store token for cross-domain Bearer auth (cookie won't work cross-domain)
                if (backendToken) {
                    localStorage.setItem('authToken', backendToken);
                }

                const role = String(backendUser.role || '').toUpperCase();
                setUser(backendUser);
                localStorage.setItem('user', JSON.stringify(backendUser));

                // Restore the intended flow: login first, then branch selection
                // for switchable roles.
                if (role === 'OWNER' || role === 'MEMBER') {
                    setActiveGymId(null);
                    localStorage.removeItem('activeGymId');
                } else {
                    const gymId = backendUser?.gymId ? String(backendUser.gymId) : null;
                    setActiveGymId(gymId);
                    if (gymId) {
                        localStorage.setItem('activeGymId', gymId);
                    } else {
                        localStorage.removeItem('activeGymId');
                    }
                }
                return true;
            } catch (backendErr) {
                const errorMsg = backendErr.response?.data?.error || backendErr.message;
                throw new Error(errorMsg);
            }
        } catch (e) {
            console.error("Login Failed:", e);
            logout();
            throw e; // Re-throw to let the UI handle the specific message
        }
    };

    const register = async (name, email) => {
        try {
            try {
                await axios.post(withApiBase('/api/auth/register'), {
                    name,
                    email
                });
            } catch (apiError) {
                const msg = apiError.response?.data?.error || apiError.message;
                throw new Error(msg);
            }

            return true;
        } catch (e) {
            console.error("Registration Failed:", e);
            throw e; 
        }
    };

    const logout = async () => {
        try {
            if (isAuthClientReady) {
                await authClient.signOut();
            }
        } catch (e) {
            console.warn("Neon signOut failed", e);
        }
        try {
            await axios.post(withApiBase('/api/auth/logout'));
        } catch (serverErr) {
            console.warn("Server logout failed", serverErr);
        }
        clearLocalSession();
    };

    const logoutAllSessions = async () => {
        await axios.post(withApiBase('/api/auth/logout-all'));

        try {
            if (isAuthClientReady) {
                await authClient.signOut();
            }
        } catch (e) {
            console.warn("Neon signOut failed", e);
        }

        clearLocalSession();
    };

    const switchBranch = async (gymId) => {
        const role = String(user?.role || '').toUpperCase();
        if (role !== 'OWNER' && role !== 'MEMBER') {
            return false;
        }

        if (!gymId) {
            localStorage.removeItem('activeGymId');
            setActiveGymId(null);
        } else {
            const idString = String(gymId);
            localStorage.setItem('activeGymId', idString);
            setActiveGymId(idString);
        }
        
        // Re-sync user to get updated gym context from backend
        const updatedUser = await syncUserWithBackend();
        if (updatedUser) {
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return true;
        }
        return false;
    };

    // Initialize session check
    useEffect(() => {
        const initSession = async () => {
            // If offline, we trust the localStorage version we already loaded in useState
            if (!navigator.onLine) {
                setLoading(false);
                return;
            }

            if (!isAuthClientReady) {
                if (authClientInitError) {
                    console.error("Skipping session restore because auth client failed to initialize.", authClientInitError);
                }
                setLoading(false);
                return;
            }

            try {
                const backendUser = await syncUserWithBackend();
                if (backendUser) {
                    setUser(backendUser);
                    localStorage.setItem('user', JSON.stringify(backendUser));
                } else {
                    // Only clear if the server explicitly says "No User" AND we are definitely online
                    // Status 0 means network failure/CORS/offline, so we don't logout
                    if (navigator.onLine) {
                        clearLocalSession();
                    }
                }
            } catch (e) {
                // If it's a 401, the session is definitely invalid
                if (e.response?.status === 401) {
                    console.log("Session expired (401). Logging out.");
                    logout();
                } else {
                    // For network errors (status 0), timeouts, or 500s, 
                    // we stay logged in locally to support offline mode.
                    console.warn("Session restoration deferred due to network or server error:", e.message);
                }
            }
            setLoading(false);
        };

        initSession();

        // Listen for return to online status to re-sync
        const handleOnline = () => {
            console.log("Internet restored. Re-syncing session...");
            initSession();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [isAuthClientReady]);

    return (
        <AuthContext.Provider value={{ user, activeGymId, login, register, logout, logoutAllSessions, switchBranch, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
