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
    const [user, setUser] = useState(null);
    const [activeGymId, setActiveGymId] = useState(localStorage.getItem('activeGymId') || null);
    const [loading, setLoading] = useState(true);

    const isAuthClientReady = Boolean(authClient);

    const clearLocalSession = () => {
        setUser(null);
        setActiveGymId(null);
        localStorage.removeItem('user');
        localStorage.removeItem('activeGymId');
        sessionStorage.removeItem('user');
    };

    const syncUserWithBackend = async () => {
        try {
            const res = await axios.get(withApiBase('/api/auth/me'));
            return res.data; 
        } catch (e) {
            console.error("Failed to sync user with backend. Error data:", e.response?.data);
            console.error("Error Message:", e.message);
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

                if (!backendUser) {
                    throw new Error("Failed to retrieve user role from system.");
                }

                setUser(backendUser);
                localStorage.setItem('user', JSON.stringify(backendUser));
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
        if (role !== 'OWNER') {
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
                } else {
                    setUser(null);
                }
            } catch (e) {
                console.error("Session restoration failed:", e);
                logout();
            }
            setLoading(false);
        };

        initSession();
    }, [isAuthClientReady]);

    return (
        <AuthContext.Provider value={{ user, activeGymId, login, register, logout, logoutAllSessions, switchBranch, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
