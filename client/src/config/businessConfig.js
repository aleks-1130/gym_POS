/**
 * Shared business configuration and constants.
 */

export const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash', icon: 'payments' },
    { value: 'GCASH', label: 'GCash', icon: 'account_balance_wallet' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: 'account_balance' },
    { value: 'PAYMAYA', label: 'PayMaya', icon: 'style' },
    { value: 'LOYALTY_POINTS', label: 'Loyalty Points', icon: 'star' },
    { value: 'CARD', label: 'Card', icon: 'credit_card' }
];

export const TAX_CONFIG = {
    DEFAULT_VAT_RATE: 12,
    VAT_TYPE: 'VAT' // 'VAT' or 'NON-VAT'
};

export const LOYALTY_CONFIG = {
    POINTS_PER_CURRENCY_UNIT: 0.1, // e.g., 10% back in points
    MIN_CASH_OUT_POINTS: 100,
    POINT_TO_CURRENCY_RATIO: 1 // 1 point = 1 unit of currency
};

export default {
    PAYMENT_METHODS,
    TAX_CONFIG,
    LOYALTY_CONFIG
};
