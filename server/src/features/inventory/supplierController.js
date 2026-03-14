const prisma = require('../../config/prisma');
const { logAudit } = require('../../services/auditService');

const getAllSuppliers = async (req, res) => {
    try {
        const suppliers = await prisma.supplier.findMany({
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
        const supplier = await prisma.supplier.create({
            data: { name, contact, email, address, notes }
        });
        await logAudit("CREATE_SUPPLIER", req.user.email, `Supplier: ${supplier.name}`, "Created new supplier");
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to create supplier" });
    }
};

const updateSupplier = async (req, res) => {
    const { id } = req.params;
    const { name, contact, email, address, notes } = req.body;
    try {
        const supplier = await prisma.supplier.update({
            where: { id: Number(id) },
            data: { name, contact, email, address, notes }
        });
        await logAudit("UPDATE_SUPPLIER", req.user.email, `Supplier: ${supplier.name}`, "Updated details");
        res.json(supplier);
    } catch (e) {
        res.status(500).json({ error: "Failed to update supplier" });
    }
};

const deleteSupplier = async (req, res) => {
    const { id } = req.params;
    try {
        const linkedProducts = await prisma.product.count({ where: { supplierId: Number(id) } });
        if (linkedProducts > 0) {
            return res.status(400).json({ error: "Cannot delete supplier with linked products" });
        }

        await prisma.supplier.delete({ where: { id: Number(id) } });
        await logAudit("DELETE_SUPPLIER", req.user.email, `Supplier ID: ${id}`, "Deleted supplier");
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
