const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

const getAllSuppliers = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const suppliers = await prisma.supplier.findMany({
            where: { tenantId },
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
        const tenantId = req.tenantId;
        const supplier = await prisma.supplier.create({
            data: { name, contact, email, address, notes, tenantId }
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
        const tenantId = req.tenantId;
        const supplier = await prisma.supplier.update({
            where: { id: Number(id), tenantId },
            data: { name, contact, email, address, notes }
        });
        await logAudit("UPDATE_SUPPLIER", req.user.email, `Supplier: ${supplier.name}`, "Updated details", req.user.gymId, req.user.tenantId);
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to update supplier" });
    }
};

const deleteSupplier = async (req, res) => {
    const { id } = req.params;
    try {
        const tenantId = req.tenantId;
        const supplierId = Number(id);

        const linkedProducts = await prisma.product.count({ 
            where: { supplierId, tenantId } 
        });
        if (linkedProducts > 0) {
            return res.status(400).json({ error: "Cannot delete supplier with linked products" });
        }

        const supplier = await prisma.supplier.findFirst({
            where: { id: supplierId, tenantId }
        });
        if (!supplier) {
            return res.status(404).json({ error: "Supplier not found" });
        }

        await prisma.supplier.deleteMany({ 
            where: { id: supplierId, tenantId } 
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
