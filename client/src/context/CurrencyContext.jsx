import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext();

export function useCurrency() {
    return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }) {
    const { user } = useAuth();
    const gym = user?.gym;
    
    const [rate] = useState(1);
    const currency = gym?.currency || 'PHP';

    // Helper to format price
    const formatPrice = (amount) => {
        if (amount === undefined || amount === null) return currency === 'PHP' ? '₱0.00' : `${currency} 0.00`;

        const locale = currency === 'SGD' ? 'en-SG' : (currency === 'PHP' ? 'en-PH' : 'en-US');
        
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const value = {
        rate,
        currency,
        formatPrice,
        loading: false
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}
