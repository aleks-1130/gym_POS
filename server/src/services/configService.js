const prisma = require('../config/prisma');

const DEFAULT_DISCOUNT_PRESETS = [
    { id: 'preset_student', name: 'STUDENT', rate: 10, icon: 'school' },
    { id: 'preset_senior', name: 'SENIOR', rate: 20, icon: 'person' },
    { id: 'preset_pwd', name: 'PWD', rate: 20, icon: 'accessible' },
    { id: 'preset_promo', name: 'PROMO', rate: 5, icon: 'local_offer' }
];

async function getPosConfig(gymId, tenantId) {
    if (!gymId) return null;
    let config = await prisma.posConfig.findFirst({
        where: { 
            gymId: Number(gymId),
            tenantId: tenantId ? Number(tenantId) : undefined
        }
    });
    if (!config) {
        config = await prisma.posConfig.create({ 
            data: {
                gymId: Number(gymId),
                tenantId: tenantId ? Number(tenantId) : 1,
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
