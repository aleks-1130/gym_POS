const prisma = require('../config/prisma');

const DEFAULT_DISCOUNT_PRESETS = [
    { id: 'preset_student', name: 'STUDENT', rate: 10, icon: 'school' },
    { id: 'preset_senior', name: 'SENIOR', rate: 20, icon: 'person' },
    { id: 'preset_pwd', name: 'PWD', rate: 20, icon: 'accessible' },
    { id: 'preset_promo', name: 'PROMO', rate: 5, icon: 'local_offer' }
];

async function getPosConfig(gymId, tenantId) {
    if (!gymId) {
        return {
            id: null,
            voidPinHash: null,
            returnPinHash: null,
            discountPresets: DEFAULT_DISCOUNT_PRESETS,
            loyaltyPointsRate: 0.1,
            gymId: null,
            tenantId: tenantId ? Number(tenantId) : 1
        };
    }

    const normalizedGymId = Number(gymId);
    const normalizedTenantId = tenantId ? Number(tenantId) : 1;

    let config = await prisma.posConfig.findFirst({
        where: { 
            gymId: normalizedGymId,
            tenantId: normalizedTenantId
        }
    });

    if (config) return config;

    config = await prisma.posConfig.create({
        data: {
            gymId: normalizedGymId,
            tenantId: normalizedTenantId,
            discountPresets: DEFAULT_DISCOUNT_PRESETS,
            loyaltyPointsRate: 0.1
        }
    });

    return config;
}

module.exports = {
    getPosConfig,
    DEFAULT_DISCOUNT_PRESETS
};
