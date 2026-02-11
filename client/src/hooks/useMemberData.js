import { useState, useEffect, useCallback } from 'react';
import { memberService } from '../services/memberService';

/**
 * Custom hook for managing member data
 * @param {number} id - Member ID
 * @returns {Object} { member, loading, error, refetch }
 */
export function useMemberData(id) {
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMember = useCallback(async () => {
        if (!id) return;

        setLoading(true);
        setError(null);

        try {
            const data = await memberService.getMemberById(id);
            setMember(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch member');
            console.error('Error fetching member:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchMember();
    }, [fetchMember]);

    return {
        member,
        loading,
        error,
        refetch: fetchMember
    };
}
