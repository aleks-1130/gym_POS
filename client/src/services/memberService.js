import axios from 'axios';
import { withApiBase } from '../config/api';

/**
 * Member service - handles all member-related API calls
 */

export const memberService = {
    /**
     * Get member by ID
     * @param {number} id - Member ID
     * @returns {Promise<Object>} Member data
     */
    async getMemberById(id) {
        const response = await axios.get(withApiBase(`/api/members/${id}`));
        return response.data;
    },

    /**
     * Update member details
     * @param {number} id - Member ID
     * @param {Object} data - Updated member data
     * @returns {Promise<Object>} Updated member
     */
    async updateMember(id, data) {
        const response = await axios.put(withApiBase(`/api/members/${id}`), data);
        return response.data;
    },

    /**
     * Renew membership
     * @param {number} id - Member ID
     * @param {Object} renewData - Renewal data (planId, duration, amount, method, etc.)
     * @returns {Promise<Object>} Renewal result
     */
    async renewMembership(id, renewData) {
        const response = await axios.post(withApiBase(`/api/members/${id}/renew`), renewData);
        return response.data;
    },

    /**
     * Update member status
     * @param {number} id - Member ID
     * @param {string} status - New status (ACTIVE, FREEZED, etc.)
     * @param {Object} extraData - Additional data (freeze dates, etc.)
     * @returns {Promise<Object>} Updated member
     */
    async updateMemberStatus(id, status, extraData = {}) {
        const response = await axios.post(withApiBase(`/api/members/${id}/status`), {
            status,
            ...extraData
        });
        return response.data;
    },

    /**
     * Set member password
     * @param {string} email - Member email
     * @param {string} password - New password
     * @returns {Promise<Object>} Result
     */
    async setMemberPassword(email, password) {
        const response = await axios.post(withApiBase('/api/auth/member-setup'), {
            email,
            password
        });
        return response.data;
    },

    /**
     * Get member notes
     * @param {number} id - Member ID
     * @returns {Promise<Array>} Array of notes
     */
    async getMemberNotes(id) {
        const response = await axios.get(withApiBase(`/api/members/${id}/notes`));
        return response.data;
    },

    /**
     * Add member note
     * @param {number} id - Member ID
     * @param {string} content - Note content
     * @returns {Promise<Object>} Created note
     */
    async addMemberNote(id, content) {
        const response = await axios.post(withApiBase(`/api/members/${id}/notes`), {
            content
        });
        return response.data;
    },

    /**
     * Get member payments
     * @param {number} id - Member ID
     * @returns {Promise<Array>} Array of payments
     */
    async getMemberPayments(id) {
        const response = await axios.get(withApiBase(`/api/members/${id}/payments`));
        return response.data;
    }
};
