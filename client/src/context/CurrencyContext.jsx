import React, { createContext, useContext, useState } from 'react';

const CurrencyContext = createContext();

export function useCurrency() {
    return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }) {
    // Current application uses PHP only. 
    // We keep the structure for compatibility but remove conversion logic.
    const [rate] = useState(1);
    const [currency] = useState('PHP');

    // Helper to format price
    const formatPrice = (amount) => {
        if (amount === undefined || amount === null) return '₱0.00';

        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
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
