/**
 * Member-related constants
 */

export const MEMBER_STATUS = {
    ACTIVE: 'ACTIVE',
    FREEZED: 'FREEZED',
    EXPIRED: 'EXPIRED'
};

export const PAYMENT_METHODS = {
    CASH: 'CASH',
    GCASH: 'GCASH',
    CARD: 'CARD'
};

export const ACTIVITY_FILTERS = {
    SEVEN_DAYS: '7days',
    THIRTY_DAYS: '30days',
    ALL: 'all'
};

export const TABS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'activity', label: 'Activity', icon: 'history' },
    { id: 'payments', label: 'Payments', icon: 'receipt_long' },
    { id: 'notes', label: 'Notes', icon: 'description' }
];

// Attendance thresholds (visits per week)
export const ATTENDANCE_THRESHOLDS = {
    HIGH: 4,
    MEDIUM: 2
};

export const ATTENDANCE_LABELS = {
    HIGH: { label: 'High', color: 'emerald', icon: 'trending_up' },
    MEDIUM: { label: 'Medium', color: 'amber', icon: 'trending_flat' },
    LOW: { label: 'Low', color: 'red', icon: 'trending_down' }
};
