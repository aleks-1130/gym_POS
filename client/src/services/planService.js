import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Plan service - handles plan-related API calls
 */

export const planService = {
    /**
     * Get all plans
     * @returns {Promise<Array>} Array of plans
     */
    async getAllPlans() {
        const response = await axios.get(`${API_BASE_URL}/plans`);
        return response.data;
    }
};
