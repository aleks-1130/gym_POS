import { ATTENDANCE_THRESHOLDS, ATTENDANCE_LABELS, ACTIVITY_FILTERS } from '../constants/memberConstants';
import { formatRelativeTime } from './dateUtils';

/**
 * Member utility functions
 */

export const formatPlanDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString();
};

export const calculatePlanProgress = (startDate, endDate, now = new Date()) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

export const calculateDaysRemaining = (endDate, now = new Date()) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return null;
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};



/**
 * Calculate membership progress percentage
 * @param {Date|string} startDate - Membership start date
 * @param {Date|string} expiryDate - Membership expiry date
 * @returns {number} Progress percentage (0-100)
 */
export function calculateMembershipProgress(startDate, expiryDate) {
    if (!startDate || !expiryDate) return 0;
    const total = new Date(expiryDate) - new Date(startDate);
    const elapsed = new Date() - new Date(startDate);
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/**
 * Get attendance score based on access logs
 * @param {Array} accessLogs - Array of access log objects
 * @returns {Object} Score object with label, color, and icon
 */
export function getAttendanceScore(accessLogs = []) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentLogs = accessLogs.filter(log => new Date(log.checkIn) >= thirtyDaysAgo);

    const visitsPerWeek = (recentLogs.length / 30) * 7;

    if (visitsPerWeek >= ATTENDANCE_THRESHOLDS.HIGH) return ATTENDANCE_LABELS.HIGH;
    if (visitsPerWeek >= ATTENDANCE_THRESHOLDS.MEDIUM) return ATTENDANCE_LABELS.MEDIUM;
    return ATTENDANCE_LABELS.LOW;
}

/**
 * Get last active time from access logs
 * @param {Array} accessLogs - Array of access log objects
 * @returns {string} Formatted last active time
 */
export function getLastActive(accessLogs = []) {
    if (accessLogs.length === 0) return 'Never';
    const lastLog = accessLogs[0];
    return formatRelativeTime(lastLog.checkIn);
}

/**
 * Filter logs by time period
 * @param {Array} logs - Array of log objects
 * @param {string} filter - Filter type (7days, 30days, all)
 * @returns {Array} Filtered logs
 */
export function getFilteredLogs(logs = [], filter) {
    if (filter === ACTIVITY_FILTERS.ALL) return logs;

    const now = new Date();
    const days = filter === ACTIVITY_FILTERS.SEVEN_DAYS ? 7 : 30;
    const limitDate = new Date(now.setDate(now.getDate() - days));

    return logs.filter(log => new Date(log.checkIn) >= limitDate);
}

/**
 * Group logs by date
 * @param {Array} logs - Array of log objects
 * @returns {Object} Logs grouped by date
 */
export function getGroupedLogs(logs = []) {
    const grouped = {};

    logs.forEach(log => {
        const date = new Date(log.checkIn).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(log);
    });

    return grouped;
}

/**
 * Get combined plan label from member and active periods
 * @param {Object} member - Member object
 * @returns {string} Combined plan label
 */
export function getCombinedPlanLabel(member) {
    if (!member) return 'No Plan';

    const now = new Date();
    const activePeriods = (member.membershipPeriods || []).filter(p => new Date(p.endDate) >= now);

    const planNames = [
        member.plan?.name,
        ...activePeriods.map(p => p.plan?.name)
    ]
        .filter(Boolean)
        .reduce((acc, name) => (acc.includes(name) ? acc : [...acc, name]), []);

    return planNames.join(' + ') || 'No Plan';
}
