import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const CurrencyContext = createContext();

export function useCurrency() {
    return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }) {
    const [rate, setRate] = useState(58); // Default fallback rate (1 USD = 58 PHP)
    const [currency, setCurrency] = useState('PHP');
    const [loading, setLoading] = useState(true);

    const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

    useEffect(() => {
        const fetchRate = async () => {
            try {
                const res = await axios.get(API_URL);
                if (res.data && res.data.rates && res.data.rates.PHP) {
                    setRate(res.data.rates.PHP);
                }
            } catch (error) {
                console.warn("Failed to fetch currency rate, using fallback:", rate);
            } finally {
                setLoading(false);
            }
        };

        fetchRate();
        // Refresh rate every hour
        const interval = setInterval(fetchRate, 3600000);
        return () => clearInterval(interval);
    }, []);

    // Helper to format price
    // Assumes input price is in USD
    const formatPrice = (amountInUSD) => {
        if (amountInUSD === undefined || amountInUSD === null) return '₱0.00';
        const converted = amountInUSD * rate;

        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(converted);
    };

    const value = {
        rate,
        currency,
        formatPrice,
        loading
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}
