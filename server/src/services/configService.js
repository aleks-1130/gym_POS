const prisma = require('../config/prisma');

async function getPosConfig() {
    let config = await prisma.posConfig.findFirst();
    if (!config) {
        config = await prisma.posConfig.create({ data: {} });
    }
    return config;
}

module.exports = {
    getPosConfig
};
