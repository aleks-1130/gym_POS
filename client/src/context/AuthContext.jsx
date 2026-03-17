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
    const [loading, setLoading] = useState(true);

    const isAuthClientReady = Boolean(authClient);

    const clearLocalSession = () => {
        setUser(null);
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
    };

    const syncUserWithBackend = async () => {
        try {
            // We need an endpoint that returns the user's role and details from our local DB
            // We can use a new endpoint or repurpose an existing one. 
            // For now, let's assume we can fetch profile or "me" which is standard.
            // If it doesn't exist, we might fail to get the role.

            // NOTE: We are sending the Neon Auth Token to our backend.
            // The backend validates it and returns the local user info (Role, ID, etc.)

            // Ideally creating a /api/auth/me endpoint would be best, 
            // but for now let's try to fetch a safe endpoint or just rely on the token if we can't sync immediately.

            // However, the app relies heavily on `user.role`.
            // So we MUST fetch the role.

            // We will trust the backend to correctly identify the user from the httpOnly cookie.
            const res = await axios.get(withApiBase('/api/auth/me'));

            return res.data; // Should contain { id, role, name, ... }
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

            // 1. Authenticate with Neon Auth
            // Use signIn.email directly to target correct endpoint
            const result = await authClient.signIn.email({
                email,
                password
            });

            if (result.error) {
                console.error("Neon Auth Error:", result.error);
                throw new Error(result.error.message);
            }

            const data = result.data;
            // signIn.email response is different from signInWithPassword
            // It might return { token, user } directly (as per debug script) or { session: { ... } }
            // Let's handle both.
            const authToken = data.token || data.session?.token || data.session?.access_token;

            if (!authToken) {
                console.error("Login Success, but no Access Token found in:", data);
                throw new Error("Authentication failed to provide token");
            }

            // 2. Sync with Backend
            // The backend login endpoint already set the httpOnly cookie, so we just need to get the user info
            // Wait, our backend login endpoint returns the user object directly.
            // Oh, the Neon auth logic here is a bit detached.
            // If Neon Auth is used, the backend needs to know about the session.
            // But we modified the backend /api/auth/login to set the cookie.
            // Is this frontend login function calling /api/auth/login? 
            // No, it handles Neon auth directly. 
            // This is a flaw in the original logic. We need to tell the backend to set the cookie.
            // For now, let's POST to /api/auth/login with the new token or rely on syncUserWithBackend?
            // Actually, the original code doesn't call /api/auth/login. It just sets localStorage and calls /me.
            // To fix this without breaking Neon, we MUST send the Neon token to the backend so the backend can set the cookie.
            // BUT wait, our backend `/api/auth/login` expects `email` and `password` !
            // It seems Neon Auth is being used but maybe dual-written?
            // Let's modify this to ensure the backend sets the cookie. We will pass the token to a new endpoint or just use /api/auth/login directly.
            // Actually, if we just call the regular backend login, it will set the cookie.
            const backendLoginRes = await axios.post(withApiBase('/api/auth/login'), { email, password });
            const backendUser = backendLoginRes.data.user;

            if (!backendUser) {
                // Determine layout/role based on failure or fallback?
                // For now, we logout if we can't identify the user role, 
                // OR we can allow them as a generic "MEMBER" if that's safe.
                // But strict security implies we should fail.
                throw new Error("Failed to retrieve user role from system.");
            }

            setUser(backendUser);
            localStorage.setItem('user', JSON.stringify(backendUser));

            return true;
        } catch (e) {
            console.error("Login Failed:", e);
            // Cleanup
            logout();
            return false;
        }
    };

    const register = async (name, email) => {
        try {
            // We ONLY create the user in our local DB (Prisma) on waitlist
            // Neon Auth account is only created upon activation later.
            try {
                await axios.post(withApiBase('/api/auth/register'), {
                    name,
                    email
                });
            } catch (apiError) {
                // Extract error message from backend response
                const msg = apiError.response?.data?.error || apiError.message;
                throw new Error(msg);
            }

            return true;
        } catch (e) {
            console.error("Registration Failed:", e);
            throw e; // Rethrow so component can display the error
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

            // Verify session entirely using the backend cookie automatically
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
        <AuthContext.Provider value={{ user, login, register, logout, logoutAllSessions, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
