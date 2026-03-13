const { createClient } = require('redis');

// Only create a client if Redis connection string is provided, else it connects to localhost:6379 by default
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
    if (err.message && err.message.includes('ECONNREFUSED')) {
        // Shush connection errors to avoid log spam
    } else {
        console.log('Redis Client Error', err);
    }
});
redisClient.on('connect', () => console.log('Connected to Redis'));

// A wrapper to safely connect it on app startup
const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (error) {
        // Shush connection errors to avoid log spam
    }
};

module.exports = {
    redisClient,
    connectRedis
};
