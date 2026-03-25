const prisma = require('../config/prisma');

/**
 * Centralized service for managing member loyalty points and audit trails.
 */
const loyaltyService = {
    /**
     * Awards or deducts points from a member and creates a transaction record.
     * @param {Object} tx - The Prisma transaction client.
     * @param {Object} params - The parameters for the operation.
     * @param {number} params.memberId - The ID of the member.
     * @param {number} params.points - The number of points to add (positive) or subtract (negative).
     * @param {string} params.type - The type of transaction (EARNED, REDEEMED, ADJUSTED, REVERSED).
     * @param {string} params.description - A human-readable description of the transaction.
     * @param {number} params.gymId - The gym ID for scoping.
     * @param {number} params.tenantId - The tenant ID for scoping.
     */
    async recordTransaction(tx, { memberId, points, type, description, gymId, tenantId }) {
        if (!memberId || points === 0) return;

        // 1. Update Member Balance
        await tx.member.update({
            where: { 
                id: Number(memberId),
                tenantId: Number(tenantId)
            },
            data: { points: { increment: points } }
        });

        // 2. Create Audit Record
        return await tx.loyaltyTransaction.create({
            data: {
                memberId: Number(memberId),
                points: points,
                type: type,
                description: description,
                gymId: gymId,
                tenantId: Number(tenantId)
            }
        });
    },

    /**
     * Helper to route point recording with or without an existing transaction
     */
    async recordPoints({ memberId, points, type, description, gymId, tenantId, tx }) {
        if (!memberId || points === 0) return;
        
        if (tx) {
            return await this.recordTransaction(tx, { memberId, points, type, description, gymId, tenantId });
        } else {
            return await prisma.$transaction(async (newTx) => {
                return await this.recordTransaction(newTx, { memberId, points, type, description, gymId, tenantId });
            });
        }
    },

    /**
     * Audits a member's point history and creates a Starting Balance ledger 
     * if their current points exceed their recorded history.
     */
    async reconcileMemberHistory({ memberId }) {
        if (!memberId) return;

        await prisma.$transaction(async (tx) => {
            const member = await tx.member.findUnique({
                where: { id: Number(memberId) },
                select: { id: true, points: true, gymId: true }
            });

            if (!member || !member.points) return;

            const transactions = await tx.loyaltyTransaction.findMany({
                where: { memberId: Number(memberId) },
                select: { points: true, type: true }
            });

            const historySum = transactions.reduce((sum, t) => sum + (t.type === 'REDEEMED' || t.type === 'REVERSED' ? -t.points : t.points), 0);
            
            if (member.points > historySum) {
                const discrepancy = member.points - historySum;
                await tx.loyaltyTransaction.create({
                    data: {
                        memberId: Number(memberId),
                        points: discrepancy,
                        type: 'EARNED',
                        description: 'Starting Balance (System Reconciliation)',
                        gymId: member.gymId
                    }
                });
            }
        });
    }
};

module.exports = loyaltyService;
