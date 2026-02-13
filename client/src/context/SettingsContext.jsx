import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        name: 'FitOS Gym',
        address: '123 Fitness Blvd, Gym City',
        phone: '(555) 123-4567',
        email: 'contact@fitos.com',
        website: 'www.fitos.com'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            // Check if token exists before robustly failing or handling public fetch (reports might be public?)
            // Actually, reports are viewed by Admin/Owner who are logged in.
            // But 'getSettings' might be public in backend? I made it public/protected?
            // Route was: router.get('/', getSettings); // in Step 3015. It was unprotected (no middleware).
            const res = await axios.get('http://localhost:5000/api/settings');
            if (res.data) {
                setSettings(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch settings, using defaults", error);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (newSettings) => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const res = await axios.post('http://localhost:5000/api/settings', newSettings, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSettings(res.data);
            return true;
        } catch (error) {
            console.error("Failed to update settings", error);
            return false;
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
