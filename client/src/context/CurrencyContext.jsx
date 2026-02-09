import React, { createContext, useContext, useState } from 'react';

const CurrencyContext = createContext();

export function useCurrency() {
    return useContext(CurrencyContext);
}

export function CurrencyProvider({ children }) {
<<<<<<< HEAD
    const [rate] = useState(1); // 1:1 Rate since we are using PHP directly
=======
    // RAW PHP MODE: Rate is always 1. Input 500 = ₱500.
    const [rate] = useState(1);
>>>>>>> 5d624b7d422135ad0a5d3556806a69ae2c59ae62
    const [currency] = useState('PHP');
    const [loading] = useState(false);

    // Helper to format price
<<<<<<< HEAD
    // Assumes input is already in PHP (No conversion)
=======
>>>>>>> 5d624b7d422135ad0a5d3556806a69ae2c59ae62
    const formatPrice = (amount) => {
        if (amount === undefined || amount === null) return '₱0.00';

        let num = amount;
        if (typeof amount === 'object') {
            // Handle Prisma Decimal or other objects
            num = parseFloat(amount.toString()) || 0;
        } else if (typeof amount === 'string') {
            num = parseFloat(amount);
        }

        if (isNaN(num)) return '₱0.00';

        // Direct formatting, no conversion logic needed
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
<<<<<<< HEAD
        }).format(amount);
=======
        }).format(num);
>>>>>>> 5d624b7d422135ad0a5d3556806a69ae2c59ae62
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
