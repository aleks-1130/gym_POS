import axios from 'axios';
import { withApiBase } from '../config/api';

/**
 * Plan service - handles plan-related API calls
 */

export const planService = {
    /**
     * Get all plans
     * @returns {Promise<Array>} Array of plans
     */
    async getAllPlans() {
        const response = await axios.get(withApiBase('/api/plans'));
        return response.data;
    }
};
