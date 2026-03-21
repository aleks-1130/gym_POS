const prisma = require('../config/prisma');

const DEFAULT_DISCOUNT_PRESETS = [
    { id: 'preset_student', name: 'STUDENT', rate: 10, icon: 'school' },
    { id: 'preset_senior', name: 'SENIOR', rate: 20, icon: 'person' },
    { id: 'preset_pwd', name: 'PWD', rate: 20, icon: 'accessible' },
    { id: 'preset_promo', name: 'PROMO', rate: 5, icon: 'local_offer' }
];

async function getPosConfig() {
    let config = await prisma.posConfig.findFirst();
    if (!config) {
        // gymId will be auto-injected by Prisma extension if in context
        config = await prisma.posConfig.create({ 
            data: {
                discountPresets: DEFAULT_DISCOUNT_PRESETS
            } 
        });
    }
    return config;
}

module.exports = {
    getPosConfig,
    DEFAULT_DISCOUNT_PRESETS
};
