import { useMemo } from 'react';
import {
    calculateDaysRemaining,
    calculateMembershipProgress,
    getAttendanceScore,
    getLastActive,
    getCombinedPlanLabel
} from '../utils/memberUtils';

/**
 * Custom hook for calculating member statistics
 * @param {Object} member - Member object
 * @returns {Object} Calculated stats
 */
export function useMemberStats(member) {
    const stats = useMemo(() => {
        if (!member) {
            return {
                daysRemaining: 0,
                progress: 0,
                attendanceScore: { label: 'Low', color: 'red', icon: 'trending_down' },
                lastActive: 'Never',
                combinedPlanLabel: 'No Plan',
                isExpiringSoon: false,
                isExpired: false
            };
        }

        const daysRemaining = calculateDaysRemaining(member.expiryDate);
        const progress = calculateMembershipProgress(member.startDate, member.expiryDate);
        const attendanceScore = getAttendanceScore(member.accessLogs);
        const lastActive = getLastActive(member.accessLogs);
        const combinedPlanLabel = getCombinedPlanLabel(member);
        const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
        const isExpired = daysRemaining < 0;

        return {
            daysRemaining,
            progress,
            attendanceScore,
            lastActive,
            combinedPlanLabel,
            isExpiringSoon,
            isExpired
        };
    }, [member]);

    return stats;
}
