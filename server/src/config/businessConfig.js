/**
 * Shared business configuration and constants for the server.
 */

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'GCASH', label: 'GCash' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'PAYMAYA', label: 'PayMaya' },
    { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
    { value: 'CARD', label: 'Card' }
];

const LOYALTY_CONFIG = {
    POINTS_PER_CURRENCY_UNIT: 0.1,
    POINT_TO_CURRENCY_RATIO: 1
};

module.exports = {
    PAYMENT_METHODS,
    LOYALTY_CONFIG
};
