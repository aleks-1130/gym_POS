const cache = new Map();

/**
 * Set an item in the cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlMs - Time to live in milliseconds (default 5 minutes)
 */
const set = (key, value, ttlMs = 300000) => {
    const expiresAt = Date.now() + ttlMs;
    cache.set(key, { value, expiresAt });
};

/**
 * Get an item from the cache
 * @param {string} key 
 * @returns {any|null} The cached value or null if expired/not found
 */
const get = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    
    return entry.value;
};

/**
 * Delete a specific key from cache
 * @param {string} key 
 */
const del = (key) => {
    cache.delete(key);
};

/**
 * Clear the entire cache
 */
const clear = () => {
    cache.clear();
};

/**
 * Get from cache or fetch via original function if not found
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data if cache miss
 * @param {number} ttlMs - TTL for new fetch
 * @returns {any} The cached or freshly fetched data
 */
const getOrSet = async (key, fetchFn, ttlMs = 300000) => {
    // Respect the environment fallback flag
    if (process.env.ENABLE_CACHE !== 'true') {
        return await fetchFn();
    }

    const cached = get(key);
    if (cached !== null) {
        // Output log for local / dev visibility without flooding production
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[CACHE HIT] ${key}`);
        }
        return cached;
    }

    const data = await fetchFn();
    if (data !== undefined && data !== null) {
        set(key, data, ttlMs);
    }
    return data;
};

module.exports = {
    get,
    set,
    del,
    clear,
    getOrSet
};
