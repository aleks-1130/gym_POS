import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { withApiBase } from '../config/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || sessionStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Configure axios defaults
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    useEffect(() => {
        if (token) {
            // Decode token or fetch user profile if endpoint exists
            // For now, we trust the token presence or add a /me endpoint later
            // Simulating user restore from localstorage partial data if stored
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error("Failed to restore user session", e);
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                }
            }
        }
        setLoading(false);
    }, [token]);

    const login = async (email, password) => {
        try {
            const res = await axios.post(withApiBase('/api/auth/login'), { email, password });
            const { token, user } = res.data;

            setToken(token);
            setUser(user);
            localStorage.setItem('token', token);
            sessionStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.setItem('user', JSON.stringify(user));
            localStorage.removeItem('pwa_install_dismissed');
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            return true;
        } catch (e) {
            console.error(e);
            // Prevent stale sessions after failed login attempts.
            setToken(null);
            setUser(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            delete axios.defaults.headers.common['Authorization'];
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
