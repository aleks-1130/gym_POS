const { createClient } = require('redis');

/**
 * InMemoryRedis - A simple fallback for when Redis is unavailable.
 */
class InMemoryRedis {
    constructor() {
        this.storage = new Map();
        this.isOpen = true;
    }
    async connect() { return Promise.resolve(); }
    on() { return this; }
    async hGetAll(key) {
        return this.storage.get(key) || {};
    }
    async hSet(key, field, value) {
        if (!this.storage.has(key)) this.storage.set(key, {});
        this.storage.get(key)[field] = value;
        return 1;
    }
    async hDel(key, field) {
        if (this.storage.has(key)) {
            delete this.storage.get(key)[field];
        }
        return 1;
    }
    async del(key) {
        this.storage.delete(key);
        return 1;
    }
    async keys(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        return Array.from(this.storage.keys()).filter(k => regex.test(k));
    }
    async expire(key, seconds) {
        setTimeout(() => this.storage.delete(key), seconds * 1000);
        return 1;
    }
    async quit() { this.isOpen = false; }
}

const realClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            // Quietly search for Redis every 30 seconds in the background
            return 30000;
        }
    }
});

const fallbackClient = new InMemoryRedis();
// Start in fallback mode until we actually hear from Redis
let useFallback = true;
let isFirstConnectionAttempt = true;

realClient.on('error', (err) => {
    // Only log once when we are sure it's a connectivity issue
    if (!useFallback && (err.message?.includes('ECONNREFUSED') || err.message?.includes('Socket'))) {
        console.log('Redis connection lost. Using In-Memory fallback.');
        useFallback = true;
    }
});

realClient.on('connect', () => {
    console.log('Connected to Redis! System is now using live storage.');
    useFallback = false;
    isFirstConnectionAttempt = false;
});

// Proxy to handle dynamic switching
const redisClient = new Proxy({}, {
    get(target, prop) {
        if (prop === 'on') return (...args) => realClient.on(...args);
        if (prop === 'connect') return () => connectRedis();
        if (prop === 'isOpen') return useFallback ? true : realClient.isOpen;

        // If fallback is active OR real client is not ready, use fallback
        if (useFallback || !realClient.isOpen) {
            if (fallbackClient[prop]) {
                return typeof fallbackClient[prop] === 'function' 
                    ? fallbackClient[prop].bind(fallbackClient) 
                    : fallbackClient[prop];
            }
            return async () => ({}); 
        }

        // Use real client
        if (typeof realClient[prop] === 'function') {
            return async (...args) => {
                try {
                    return await realClient[prop].bind(realClient)(...args);
                } catch (err) {
                    if (!useFallback) {
                        console.log('Redis link interrupted. Switching to In-Memory.');
                        useFallback = true;
                    }
                    if (fallbackClient[prop]) {
                        return fallbackClient[prop].bind(fallbackClient)(...args);
                    }
                    return {};
                }
            };
        }
        return realClient[prop];
    }
});

const connectRedis = async () => {
    // We don't await the connect call because it might hang if Redis is down
    // node-redis v4 connect() resolves only when connected or when retries are exhausted.
    // Our reconnectStrategy is infinite (every 30s), so we MUST not block.
    console.log('Searching for Redis in background...');
    realClient.connect().catch((err) => {
        // This captures immediate failures but doesn't stop the background search
        if (isFirstConnectionAttempt) {
            console.log('Redis not found on startup. Using In-Memory fallback.');
            isFirstConnectionAttempt = false;
        }
        useFallback = true;
    });
};

module.exports = {
    redisClient,
    connectRedis
};
