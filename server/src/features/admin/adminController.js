const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');
const { syncToNeonAuth } = require('../../services/neonAuthSync');

// Get Audit Logs (Owner Only)
const getAuditLogs = async (req, res) => {
    try {
        const { tenantId, role, gymId } = req.user;
        const where = { tenantId };
        if (role !== 'OWNER') {
            where.gymId = gymId;
        }

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};

// Manage Staff/Admins (List users in branch for Admin, all for Owner)
const getUsers = async (req, res) => {
    const { gymId: filterGymId, page = 1, limit = 10 } = req.query;
    const { role: userRole, gymId: userGymId } = req.user;
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    try {
        const { tenantId } = req.user;
        let where = { tenantId: tenantId };
        
        if (userRole === 'OWNER') {
            if (filterGymId) {
                // Ensure the filtered gym belongs to the owner's tenant
                where.gymId = Number(filterGymId);
            }
        } else {
            where.gymId = userGymId;
        }

        // Get total count for pagination metadata
        const totalUsers = await prisma.user.count({ where });
        const totalPages = Math.ceil(totalUsers / limitNum);

        const users = await prisma.user.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            select: { 
                id: true, 
                name: true, 
                email: true, 
                role: true, 
                createdAt: true, 
                gymId: true,
                gym: { select: { name: true } }
            }
        });

        res.json({
            users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (e) {
        console.error("Pagination Error:", e);
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

// Create a new Staff/Admin (Owner/Admin Only)
const adminCreateUser = async (req, res) => {
    const { name, email, password, role, gymId: targetGymId } = req.body;
    const bcrypt = require('bcryptjs');

    try {
        const { role: creatorRole, gymId: creatorGymId, tenantId } = req.user;

        // Restriction: Admin/Owner can only create users for their own tenant
        const targetGym = await prisma.gym.findFirst({ 
            where: { 
                id: Number(targetGymId),
                tenantId: tenantId
            } 
        });
        if (!targetGym || targetGym.tenantId !== tenantId) {
            return res.status(403).json({ error: "Access denied: Branch belongs to another organization" });
        }

        if (creatorRole === 'ADMIN') {
            if (role !== 'STAFF') return res.status(403).json({ error: "Admins can only create Staff users" });
            if (Number(targetGymId) !== creatorGymId) return res.status(403).json({ error: "Admins can only create users for their own branch" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                gymId: Number(targetGymId),
                tenantId: tenantId,
                status: 'ACTIVE' // Admin created users are active immediately
            }
        });

        await logAudit("USER_CREATE", req.user.email, newUser.email, `Created ${role} for branch ${targetGymId}`, Number(targetGymId), tenantId);

        // Sync to Neon Auth
        try {
            await syncToNeonAuth(name, email, password);
        } catch (syncErr) {
            console.error("Neon Auth Sync Warning:", syncErr.message);
        }

        res.json({ message: "User created successfully", user: { id: newUser.id, email: newUser.email } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || "Failed to create user" });
    }
};

// Update User (Owner/Admin)
const adminUpdateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role, gymId } = req.body;
    const bcrypt = require('bcryptjs');

    try {
        const { role: creatorRole, gymId: creatorGymId, tenantId } = req.user;
        const target = await prisma.user.findFirst({ 
            where: { 
                id: Number(id),
                tenantId: tenantId // Critical: Ensure the user belongs to the same tenant
            } 
        });

        if (!target) return res.status(404).json({ error: "User not found or access denied" });

        // Security: Admin can only update users in their own branch
        if (creatorRole === 'ADMIN' && target.gymId !== creatorGymId) {
            return res.status(403).json({ error: "Access denied: User is in another branch" });
        }

        // Security: Cannot update Owner unless you are Owner
        if (target.role === 'OWNER' && creatorRole !== 'OWNER') {
            return res.status(403).json({ error: "Cannot modify Owner account" });
        }

        // Security: Admin cannot change role to OWNER
        if (role === 'OWNER' && creatorRole !== 'OWNER') {
             return res.status(403).json({ error: "Only Owners can promote to Owner" });
        }

        const updateData = { name, email };
        if (role) updateData.role = role;
        if (gymId) updateData.gymId = Number(gymId);
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData
        });

        // Sync to Neon Auth if critical fields changed
        if (password || email) {
            try {
                // If password changed, we MUST force (re-create) to update hash
                // If email changed, we MUST force (re-create) because the old email record is stale
                const syncName = name || updatedUser.name || target.name;
                const syncEmail = email || updatedUser.email || target.email;
                const syncPassword = password; // If password not provided here, we can't re-sync hash easily without knowing it.
                
                // Only sync if we have a password (either new or we'd need to know the old one - but we don't have it in plain text)
                if (password) {
                    await syncToNeonAuth(syncName, syncEmail, password, true);
                } else if (email) {
                    // Email changed but no new password provided? 
                    // This is a problem because we can't re-create the account without a password.
                    // For now, we skip or show a warning. 
                    console.warn("[AdminUpdate] Email changed without password. Neon Auth will be out of sync.");
                }
            } catch (syncErr) {
                console.error("Neon Auth Sync Warning (Update):", syncErr.message);
            }
        }

        await logAudit("USER_UPDATE", req.user.email, updatedUser.email, `Updated user details`, updatedUser.gymId, tenantId);
        res.json({ message: "User updated successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Delete User (Owner/Admin)
const adminDeleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const { role: creatorRole, gymId: creatorGymId, id: creatorId, tenantId } = req.user;
        const target = await prisma.user.findFirst({ 
            where: { 
                id: Number(id),
                tenantId: tenantId // Critical: Ensure the user belongs to the same tenant
            } 
        });

        if (!target) return res.status(404).json({ error: "User not found or access denied" });

        // Security: Cannot delete yourself
        if (Number(id) === creatorId) {
            return res.status(400).json({ error: "Cannot delete your own account" });
        }

        // Security: Admin can only delete users in their own branch
        if (creatorRole === 'ADMIN' && target.gymId !== creatorGymId) {
            return res.status(403).json({ error: "Access denied: User is in another branch" });
        }

        // Security: Cannot delete Owner
        if (target.role === 'OWNER') {
            return res.status(403).json({ error: "Cannot delete the Owner account" });
        }

        await prisma.user.delete({ where: { id: Number(id) } });

        // Sync to Neon Auth: Force delete from Neon Auth as well
        try {
            // We use name='' because we are just deleting, it won't trigger sign-up if we don't pass password
            // Actually, we should probably add a dedicated delete function to neonAuthSync, 
            // but calling force=true without a password will trigger the delete block and then fail the sign-up (which is fine)
            // Better: I'll just use the delete logic inside neonAuthSync by passing force=true.
            await syncToNeonAuth('', target.email, '', true);
        } catch (syncErr) {
            console.error("Neon Auth Delete Sync Warning:", syncErr.message);
        }

        await logAudit("USER_DELETE", req.user.email, target.email, `Deleted user`, target.gymId, tenantId);
        res.json({ message: "User deleted successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Promote/Demote/Transfer (Owner Only)
const changeUserRole = async (req, res) => {
    const { targetUserId, newRole } = req.body; // newRole: 'ADMIN' or 'STAFF'

    try {
        const target = await prisma.user.findUnique({ where: { id: Number(targetUserId) } });
        if (!target) return res.status(404).json({ error: "User not found" });

        if (newRole === 'OWNER') return res.status(400).json({ error: "Use transfer-ownership endpoint for Owner transfer" });
        if (target.role === 'OWNER') return res.status(403).json({ error: "Cannot change role of (self) Owner via this endpoint" });

        await prisma.user.update({
            where: { id: Number(targetUserId) },
            data: { role: newRole }
        });

        await logAudit("ROLE_CHANGE", req.user.email, target.email, `Changed role to ${newRole}`, target.gymId, req.user.tenantId);
        res.json({ message: `User role updated to ${newRole}` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Transfer Ownership
const transferOwnership = async (req, res) => {
    const { newOwnerId } = req.body;

    try {
        // Transaction: Demote current Owner -> ADMIN, Promote new User -> OWNER
        const currentOwnerId = req.user.id; // From token

        if (currentOwnerId === Number(newOwnerId)) return res.status(400).json({ error: "Already owner" });

        await prisma.$transaction([
            prisma.user.update({
                where: { id: currentOwnerId },
                data: { role: 'ADMIN' }
            }),
            prisma.user.update({
                where: { id: Number(newOwnerId) },
                data: { role: 'OWNER' }
            })
        ]);

        await logAudit("OWNERSHIP_TRANSFER", req.user.email, `User ID ${newOwnerId}`, "Transferred system ownership", req.user.gymId, req.user.tenantId);
        res.json({ message: "Ownership transferred successfully. Please log in again." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Transfer failed" });
    }
};

module.exports = {
    getAuditLogs,
    getUsers,
    changeUserRole,
    transferOwnership,
    adminCreateUser,
    adminUpdateUser,
    adminDeleteUser
};
