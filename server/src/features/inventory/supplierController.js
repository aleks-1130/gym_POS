const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

const getAllSuppliers = async (req, res) => {
    try {
        const { tenantId, gymId } = req.user;
        const suppliers = await prisma.supplier.findMany({
            where: { 
                tenantId,
                OR: [
                    { isGlobal: true },
                    { gymId: Number(gymId) }
                ]
            },
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(suppliers);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch suppliers" });
    }
};

const createSupplier = async (req, res) => {
    const { name, contact, email, address, notes } = req.body;
    try {
        const { tenantId, gymId } = req.user;
        const supplier = await prisma.supplier.create({
            data: { 
                name, contact, email, address, notes, 
                tenantId,
                gymId: Number(gymId),
                isGlobal: false // Default to branch-specific
            }
        });
        await logAudit("CREATE_SUPPLIER", req.user.email, `Supplier: ${supplier.name}`, "Created new supplier", req.user.gymId, req.user.tenantId);
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to create supplier" });
    }
};

const updateSupplier = async (req, res) => {
    const { id } = req.params;
    const { name, contact, email, address, notes } = req.body;
    try {
        const { tenantId, gymId } = req.user;
        const supplier = await prisma.supplier.updateMany({
            where: { 
                id: Number(id), 
                tenantId,
                gymId: Number(gymId) // Only allow updating branch-specific ones
            },
            data: { name, contact, email, address, notes }
        });
        if (supplier.count === 0) return res.status(404).json({ error: "Supplier not found or access denied" });
        await logAudit("UPDATE_SUPPLIER", req.user.email, `Supplier: ${supplier.name}`, "Updated details", req.user.gymId, req.user.tenantId);
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to update supplier" });
    }
};

const deleteSupplier = async (req, res) => {
    const { id } = req.params;
    try {
        const { tenantId, gymId } = req.user;
        const supplierId = Number(id);

        const supplier = await prisma.supplier.findFirst({
            where: { id: supplierId, tenantId, gymId: Number(gymId) }
        });
        if (!supplier) {
            return res.status(404).json({ error: "Supplier not found or access denied" });
        }

        const linkedProducts = await prisma.product.count({ 
            where: { supplierId, tenantId } 
        });
        if (linkedProducts > 0) {
            return res.status(400).json({ error: "Cannot delete supplier with linked products" });
        }

        await prisma.supplier.deleteMany({ 
            where: { id: supplierId, tenantId, gymId: Number(gymId) } 
        });
        await logAudit("DELETE_SUPPLIER", req.user.email, `Supplier ID: ${id}`, "Deleted supplier", req.user.gymId, req.user.tenantId);
        res.json({ message: "Supplier deleted" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = {
    getAllSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier
};
