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
    const [token, setToken] = useState(localStorage.getItem('token') || sessionStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const isAuthClientReady = Boolean(authClient);

    // Configure axios defaults when token changes
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    const syncUserWithBackend = async (authToken) => {
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

            // We will trust the backend to correctly identify the user from the token.
            const res = await axios.get(withApiBase('/api/auth/me'), {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            return res.data; // Should contain { id, role, name, ... }
        } catch (e) {
            console.error("Failed to sync user with backend:", e);
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

            // 2. Set Token immediately
            setToken(authToken);
            localStorage.setItem('token', authToken);

            // 3. Sync with Backend to get Role
            const backendUser = await syncUserWithBackend(authToken);

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
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
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

            // Check if we have a token
            const storedToken = localStorage.getItem('token');
            if (!storedToken) {
                setLoading(false);
                return;
            }

            // Verify if session is valid with Neon (optional but good)
            try {
                const result = await authClient.getSession();

                if (result.error || !result.data || !result.data.session) {
                    throw new Error("Session expired or invalid");
                }

                const { session } = result.data;

                // Refresh token if needed
                // Fallback to storedToken if session doesn't explicitly return a new token string
                const newToken = result.data.token || session?.token || session?.access_token || storedToken;

                if (newToken && newToken !== storedToken) {
                    setToken(newToken);
                    localStorage.setItem('token', newToken);
                }

                // Sync User
                const backendUser = await syncUserWithBackend(newToken);
                if (backendUser) {
                    setUser(backendUser);
                } else {
                    // Fallback to stored user if offline or sync fails?
                    const storedUser = localStorage.getItem('user');
                    if (storedUser) setUser(JSON.parse(storedUser));
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
        <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
