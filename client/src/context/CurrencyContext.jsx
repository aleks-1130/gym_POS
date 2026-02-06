import React, { createContext, useContext, useState } from 'react';

const CurrencyContext = createContext();

export function useCurrency() {
    return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }) {
    const [rate] = useState(1); // 1:1 Rate since we are using PHP directly
    const [currency] = useState('PHP');
    const [loading] = useState(false);

    // Helper to format price
    // Assumes input is already in PHP (No conversion)
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
        loading
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}
