const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const { syncToNeonAuth, deleteFromNeonAuth } = require('../../services/neonAuthSync');
const { DEFAULT_RECEIPT_SETTINGS } = require('../../services/receiptSettingsService');
const { DEFAULT_DISCOUNT_PRESETS } = require('../../services/configService');

/**
 * SuperAdmin Tenant Management Controller
 */

// List all tenants with gym counts
const listTenants = async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany({
            where: { isActive: true }, // Filter out soft-deleted tenants by default
            include: {
                gyms: {
                    select: { id: true, name: true, companyId: true, isActive: true }
                },
                _count: {
                    select: { gyms: true, users: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tenants);
    } catch (error) {
        console.error('[TenantController] List failed:', error);
        res.status(500).json({ error: 'Failed to fetch tenants' });
    }
};

// Create a new tenant with default gym and owner
const createTenant = async (req, res) => {
    const { name, tenantId, adminEmail, adminPassword, gymName } = req.body;

    if (!name || !tenantId || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: 'Name, Tenant ID, Admin Email, and Admin Password are required' });
    }

    try {
        // 1. Check if tenantId already exists
        const existingTenant = await prisma.tenant.findUnique({
            where: { tenantId }
        });

        if (existingTenant) {
            return res.status(400).json({ error: 'Tenant ID already exists' });
        }

        // 2. Check if adminEmail already exists (globally unique)
        const existingUser = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Admin email is already in use by another account.' });
        }

        // 3. Atomically create everything
        const result = await prisma.$transaction(async (tx) => {
            // A. Create Tenant
            const tenant = await tx.tenant.create({
                data: { name, tenantId }
            });

            // B. Create Default Gym
            const finalGymName = gymName || `${name} - Branch 1`;
            const gym = await tx.gym.create({
                data: {
                    name: finalGymName,
                    companyId: `${tenantId}-1`, // Default slug
                    tenantId: tenant.id,
                    receiptSettings: {
                        create: {
                            settings: {
                                ...DEFAULT_RECEIPT_SETTINGS,
                                businessName: finalGymName
                            }
                        }
                    },
                    posConfigs: {
                        create: {
                            discountPresets: DEFAULT_DISCOUNT_PRESETS
                        }
                    },
                    // Create default financial institutions (essential for POS external refs)
                    financialInstitutions: {
                        create: [
                            { label: 'CASH', method: 'CASH', financialInstitutionId: 'EXTERNAL', isActive: true },
                            { label: 'CARD', method: 'CARD', financialInstitutionId: 'EXTERNAL', isActive: true },
                            { label: 'GCASH', method: 'GCASH', financialInstitutionId: 'EXTERNAL', isActive: true },
                            { label: 'PAYMAYA', method: 'PAYMAYA', financialInstitutionId: 'EXTERNAL', isActive: true }
                        ]
                    }
                }
            });

            // C. Create Initial Owner User
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            const user = await tx.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    name: `${name} - Owner`,
                    role: 'OWNER',
                    tenantId: tenant.id,
                    gymId: gym.id,
                    status: 'ACTIVE'
                }
            });
            
            // D. Clone Global Plans for the new Tenant
            const globalPlans = await tx.plan.findMany({ where: { isGlobal: true, deletedAt: null } });
            if (globalPlans.length > 0) {
                await tx.plan.createMany({
                    data: globalPlans.map(p => ({
                        name: p.name,
                        price: p.price,
                        duration: p.duration,
                        includedClassSessions: p.includedClassSessions,
                        includesClasses: p.includesClasses,
                        freezeLimitCount: p.freezeLimitCount,
                        guestPassEnabled: p.guestPassEnabled,
                        guestPassLimitCount: p.guestPassLimitCount,
                        tenantId: tenant.id,
                        gymId: gym.id,
                        isGlobal: false,
                        isActive: true
                    }))
                });
            }

            // E. Clone Global Class Session Packages for the new Tenant
            const globalPackages = await tx.classSessionPackage.findMany({ where: { isGlobal: true, deletedAt: null } });
            if (globalPackages.length > 0) {
                await tx.classSessionPackage.createMany({
                    data: globalPackages.map(p => ({
                        name: p.name,
                        sessions: p.sessions,
                        price: p.price,
                        tenantId: tenant.id,
                        gymId: gym.id,
                        isGlobal: false,
                        isActive: true
                    }))
                });
            }

            return { tenant, gym, user };
        });

        // 4. Sync new owner to Neon Auth (for login capability)
        try {
            await syncToNeonAuth(result.user.name, adminEmail, adminPassword);
            console.log(`[TenantLaunch] Successfully synced admin "${adminEmail}" to Neon Auth.`);
        } catch (syncErr) {
            console.error('[TenantLaunch] Neon Auth Sync Failed (Proceeding anyway):', syncErr.message);
        }

        res.status(201).json({
            message: 'Tenant launched successfully with default branch and admin.',
            tenant: result.tenant,
            adminEmail: adminEmail
        });
    } catch (error) {
        console.error('[TenantController] Launch failed:', error);
        res.status(500).json({ error: 'Failed to launch tenant environment: ' + error.message });
    }
};

// Update a tenant
const updateTenant = async (req, res) => {
    const { id } = req.params;
    const { name, tenantId } = req.body;

    try {
        const tenant = await prisma.tenant.update({
            where: { id: parseInt(id) },
            data: { name, tenantId }
        });
        res.json(tenant);
    } catch (error) {
        console.error('[TenantController] Update failed:', error);
        res.status(500).json({ error: 'Failed to update tenant' });
    }
};

// Delete a tenant (Soft Delete for Production Safety)
const deleteTenant = async (req, res) => {
    const { id: rawId } = req.params;
    const id = parseInt(rawId);

    try {
        console.log(`[TenantController] Soft-deleting tenant ${id}...`);
        
        // Use soft-delete: set isActive=false and record deletion time
        await prisma.tenant.update({
            where: { id: id },
            data: { 
                isActive: false, 
                deletedAt: new Date() 
            }
        });

        // Optional: We could also flag associated Gyms as inactive here
        await prisma.gym.updateMany({
            where: { tenantId: id },
            data: { isActive: false }
        });

        res.json({ message: 'Tenant soft-deleted successfully (data preserved)' });
    } catch (error) {
        console.error('[TenantController] Soft Delete failed:', error);
        res.status(500).json({ error: 'Failed to soft delete tenant: ' + error.message });
    }
};

module.exports = {
    listTenants,
    createTenant,
    updateTenant,
    deleteTenant
};
