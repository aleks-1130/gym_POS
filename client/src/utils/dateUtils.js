/**
 * Date utility functions
 */

/**
 * Format date as relative time (Today, Yesterday, X days ago, etc.)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted relative time
 */
export function formatRelativeTime(date) {
    const targetDate = new Date(date);
    const now = new Date();
    const diffMs = now - targetDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Format date with options
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
export function formatDate(date, options = {}) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', options);
}
