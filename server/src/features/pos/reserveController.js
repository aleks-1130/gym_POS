const { redisClient } = require('../../config/redisClient');
const prisma = require('../../config/prisma');

const getReservations = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

        const tenantId = req.user?.tenantId || 1;
        const data = await redisClient.hGetAll(`cart:reserve:${tenantId}:${sessionId}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ error: 'Failed to fetch reservations' });
    }
};

const reserveStock = async (req, res) => {
    try {
        const { sessionId, productId, quantity } = req.body;

        if (!sessionId || !productId || quantity === undefined) {
            return res.status(400).json({ error: 'sessionId, productId, and quantity required' });
        }

        const qty = Number(quantity);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'valid quantity required' });
        }

        const tenantId = req.user?.tenantId || 1;
        // Check global stock hold across all carts FOR THIS TENANT
        const allKeys = await redisClient.keys(`cart:reserve:${tenantId}:*`);
        let globalHold = 0;
        let myCurrentHold = 0;

        for (const key of allKeys) {
            const hdata = await redisClient.hGetAll(key);
            if (hdata[productId]) {
                const heldQty = Number(hdata[productId]);
                globalHold += heldQty;
                if (key === `cart:reserve:${tenantId}:${sessionId}`) {
                    myCurrentHold = heldQty;
                }
            }
        }

        const gymId = req.user?.gymId || req.gymId;

        // Product's actual stock in DB (Check branch first)
        const product = await prisma.product.findUnique({
            where: { 
                id: Number(productId),
                tenantId: Number(tenantId)
            },
            include: {
                stocks: gymId ? { where: { gymId: Number(gymId) } } : false
            }
        });

        if (!product) return res.status(404).json({ error: 'Product not found' });

        // Prioritize branch-specific stock, fall back to global
        const currentDbStock = (product.stocks && product.stocks.length > 0)
            ? product.stocks[0].quantity
            : product.stock;

        // Calculate available stock taking into account all global holds,
        // EXCEPT we give back the hold we currently have on this product for this session
        // so that we can accurately assess if we can increase to the new requested qty.
        const availableStock = currentDbStock - (globalHold - myCurrentHold);

        if (availableStock < qty) {
            return res.status(400).json({ 
                error: 'Not enough available stock',
                available: availableStock
            });
        }

        // Create or update the reservation mapped to this sessionId
        await redisClient.hSet(`cart:reserve:${tenantId}:${sessionId}`, productId, qty.toString());
        // Auto-expire cart contents dynamically in 15 minutes (900s)
        await redisClient.expire(`cart:reserve:${tenantId}:${sessionId}`, 900);

        res.json({ message: 'Stock reserved', productId, reservedQuantity: qty });
    } catch (error) {
        console.error('Error reserving stock:', error);
        res.status(500).json({ error: 'Failed to reserve stock' });
    }
};

const removeReservationItem = async (req, res) => {
    try {
        const { sessionId, productId } = req.params;
        
        const tenantId = req.user?.tenantId || 1;
        await redisClient.hDel(`cart:reserve:${tenantId}:${sessionId}`, productId);
        
        res.json({ message: 'Item reservation removed' });
    } catch (error) {
        console.error('Error removing reservation:', error);
        res.status(500).json({ error: 'Failed to remove item reservation' });
    }
};

const clearSessionReservations = async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const tenantId = req.user?.tenantId || 1;
        await redisClient.del(`cart:reserve:${tenantId}:${sessionId}`);
        
        res.json({ message: 'Cart reservations cleared' });
    } catch (error) {
        console.error('Error clearing cart reservations:', error);
        res.status(500).json({ error: 'Failed to clear reservations' });
    }
};

module.exports = {
    getReservations,
    reserveStock,
    removeReservationItem,
    clearSessionReservations
};
