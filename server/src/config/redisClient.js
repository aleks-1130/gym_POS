const { createClient } = require('redis');

// Only create a client if Redis connection string is provided, else it connects to localhost:6379 by default
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

// A wrapper to safely connect it on app startup
const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
    }
};

module.exports = {
    redisClient,
    connectRedis
};
