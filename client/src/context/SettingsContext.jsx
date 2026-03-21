import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState({
        name: 'FitOS Gym',
        address: '123 Fitness Blvd, Gym City',
        phone: '(555) 123-4567',
        email: 'contact@fitos.com',
        website: 'www.fitos.com'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user?.id, user?.gymId]);

    const fetchSettings = async () => {
        try {
            // Check if token exists before robustly failing or handling public fetch (reports might be public?)
            // Actually, reports are viewed by Admin/Owner who are logged in.
            // But 'getSettings' might be public in backend? I made it public/protected?
            // Route was: router.get('/', getSettings); // in Step 3015. It was unprotected (no middleware).
            const res = await axios.get('/api/settings');
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
            const res = await axios.post('/api/settings', newSettings);
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
