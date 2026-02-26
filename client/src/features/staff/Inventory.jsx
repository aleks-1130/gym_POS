import React, { useState, useEffect } from 'react';
import { PRODUCT_CATEGORIES } from '../../constants/categories'; // Added import
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import axios from 'axios';
import DataTable from '../../components/common/DataTable';

export default function Inventory() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]); // New state for suppliers
    const [loading, setLoading] = useState(false);

    // Product Form State
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', category: PRODUCT_CATEGORIES.SUPPLEMENT, price: '', stock: '', minStock: '5', imageUrl: '', supplyCost: '', supplierId: ''
    });

    // Restock Modal State
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [restockProduct, setRestockProduct] = useState(null);
    const [restockData, setRestockData] = useState({
        quantity: '',
        notes: ''
    });

    useEffect(() => {
        fetchProducts();
        fetchSuppliers();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/products');
            setProducts(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/suppliers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
        } catch (error) {
            console.error("Failed to fetch suppliers", error);
        }
    };

    // --- Product CRUD ---
    const handleEdit = (product) => {
        setEditingId(product.id);
        setFormData({
            name: product.name,
            category: product.category,
            price: product.price.toFixed(2),
            stock: product.stock,
            minStock: product.minStock,
            imageUrl: product.imageUrl || '',
            supplyCost: product.supplyCost.toFixed(2),
            supplierId: product.supplierId || ''
        });
        setShowForm(true);
        setShowRestockModal(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setFormData({ name: '', category: PRODUCT_CATEGORIES.SUPPLEMENT, price: '', stock: '', minStock: '5', imageUrl: '', supplyCost: '', supplierId: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            price: parseFloat(formData.price) || 0,
            stock: parseInt(formData.stock) || 0,
            minStock: parseInt(formData.minStock) || 0,
            supplyCost: parseFloat(formData.supplyCost) || 0,
            supplierId: formData.supplierId ? parseInt(formData.supplierId) : null
        };

        try {
            if (editingId) {
                // UPDATE
                await axios.put(`/api/products/${editingId}`, payload);
            } else {
                // CREATE
                await axios.post('/api/products', payload);
            }
            resetForm();
            fetchProducts();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.error || "Operation failed");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this product?")) return;
        try {
            await axios.delete(`/api/products/${id}`);
            fetchProducts();
        } catch (e) {
            alert("Failed to delete");
        }
    };

    // --- Restock Logic ---
    const openRestock = (product) => {
        setRestockProduct(product);
        setRestockData({ quantity: '', notes: '' });
        setShowRestockModal(true);
    };

    const handleRestockSubmit = async (e) => {
        e.preventDefault();
        if (!restockData.quantity) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/inventory/restock', {
                productId: restockProduct.id,
                quantity: parseInt(restockData.quantity),
                notes: restockData.notes
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert('Restock successful! Expense recorded.');
            setShowRestockModal(false);
            setRestockProduct(null);
            fetchProducts();
        } catch (error) {
            console.error("Restock failed", error);
            alert('Restock failed');
        }
    };


    // --- Filter Logic ---
    const [searchParams] = useSearchParams();
    const [selectedSupplier, setSelectedSupplier] = useState('ALL');

    useEffect(() => {
        const supplierId = searchParams.get('supplierId');
        if (supplierId) {
            setSelectedSupplier(supplierId);
        }
    }, [searchParams]);

    const filteredProducts = products.filter(product => {
        if (selectedSupplier === 'ALL') return true;
        return product.supplierId === parseInt(selectedSupplier);
    });

    return (
        <div className="space-y-6 relative">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventory Management</h1>
                    <p className="text-text-muted mt-1">Track stock levels and manage catalog</p>
                </div>

                <div className="flex gap-4">
                    {/* Supplier Filter */}
                    <select
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="bg-surface border border-white/10 text-white text-sm rounded-xl px-4 py-2 focus:border-primary outline-none"
                    >
                        <option value="ALL">All Suppliers</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => {
                            if (showForm) resetForm();
                            else setShowForm(true);
                        }}
                        className={`font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-2 ${showForm ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-primary hover:bg-orange-600 text-white shadow-lg shadow-primary/20'}`}
                    >
                        <span className="material-icons-round">{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancel' : 'Add Product'}
                    </button>
                </div>
            </header>

            {/* Product Form */}
            {showForm && (
                <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm animate-fade-in-down mb-6">
                    <h3 className="text-xl font-bold text-white mb-4">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* ... Existing Form Fields ... */}
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Product Name</label>
                            <input required className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Whey Protein" />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Category</label>
                            <select className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                <option value={PRODUCT_CATEGORIES.SUPPLEMENT}>Supplement</option>
                                <option value={PRODUCT_CATEGORIES.DRINK}>Drink</option>
                                <option value={PRODUCT_CATEGORIES.MERCH}>Merchandise</option>
                                <option value={PRODUCT_CATEGORIES.EQUIPMENT}>Equipment</option>
                                <option value={PRODUCT_CATEGORIES.OTHER}>Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Price (PHP)</label>
                            <input required type="number" step="0.01" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Stock</label>
                                <input
                                    required
                                    type="number"
                                    disabled={!!editingId}
                                    className={`w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    value={formData.stock}
                                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                    placeholder="0"
                                />
                                {editingId && <p className="text-[10px] text-orange-400 mt-1">*Use 'Restock' to update</p>}
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Low Alert</label>
                                <input required type="number" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                    value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: e.target.value })} />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-text-secondary mb-1">Image URL (Optional)</label>
                            <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:col-span-2 border-t border-dashed border-white/10 pt-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Supplier <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                    value={formData.supplierId}
                                    onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                                >
                                    <option value="">-- Select Supplier --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-text-muted mt-1">Product linked strictly to this supplier.</p>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Supply Cost (PHP) <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                    value={formData.supplyCost}
                                    onChange={e => setFormData({ ...formData, supplyCost: e.target.value })}
                                    placeholder="0.00"
                                />
                                <p className="text-[10px] text-text-muted mt-1">Cost per unit used for expenses.</p>
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3">
                            <button type="button" onClick={resetForm} className="text-text-muted hover:text-white font-bold px-6 py-3">
                                Cancel
                            </button>
                            <button type="submit" className="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                                {editingId ? 'Update Product' : 'Save Product'}
                            </button>
                        </div>
                    </form>
                </div >
            )
            }

            {/* Inventory Table */}
            <DataTable
                columns={[
                    {
                        header: 'Product',
                        accessor: (product) => (
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/5 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                                            <span className="material-icons-round text-sm">image</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-white font-bold">{product.name}</p>
                                    <p className="text-xs text-text-muted">SKU: {product.id.toString().padStart(4, '0')}</p>
                                </div>
                            </div>
                        )
                    },
                    {
                        header: 'Category',
                        accessor: (product) => (
                            <span className="px-3 py-1 bg-white/5 text-text-secondary rounded-lg text-[10px] font-bold border border-white/10 uppercase tracking-wider">
                                {product.category}
                            </span>
                        )
                    },
                    {
                        header: 'Price',
                        accessor: (product) => formatPrice(product.price),
                        className: 'text-center',
                        cellClassName: 'text-white font-mono font-bold text-center'
                    },
                    {
                        header: 'Stock Level',
                        accessor: (product) => {
                            const isLowStock = product.stock <= product.minStock;
                            return (
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 max-w-[140px] bg-white/10 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${isLowStock ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'}`} style={{ width: `${Math.min(100, (product.stock / (product.minStock * 4)) * 100)}%` }}></div>
                                    </div>
                                    <span className={`font-mono font-bold text-sm min-w-[30px] text-right ${isLowStock ? 'text-red-500' : 'text-emerald-400'}`}>
                                        {product.stock}
                                    </span>
                                </div>
                            );
                        }
                    }
                ]}
                data={filteredProducts}
                actions={(product) => (
                    <div className="flex items-center justify-end gap-3 font-mono">
                        <button
                            onClick={() => openRestock(product)}
                            className="bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-emerald-500/20 transition-all uppercase tracking-tighter"
                        >
                            Restock
                        </button>
                        <button onClick={() => handleEdit(product)} className="text-text-muted hover:text-white transition-colors">
                            <span className="material-icons-round text-lg">edit</span>
                        </button>
                        {user?.role === 'ADMIN' && (
                            <button onClick={() => handleDelete(product.id)} className="text-text-muted hover:text-red-500 transition-colors">
                                <span className="material-icons-round text-lg">delete</span>
                            </button>
                        )}
                    </div>
                )}
                isLoading={loading}
                emptyMessage="No products in inventory. Click 'Add Product' to start."
            />

            {/* Restock Modal */}
            {
                showRestockModal && restockProduct && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-surface w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up">
                            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white">Restock Inventory</h3>
                                <button onClick={() => setShowRestockModal(false)} className="text-text-muted hover:text-white">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                            <form onSubmit={handleRestockSubmit} className="p-6 space-y-4">
                                <div className="bg-white/5 rounded-xl p-4 flex items-center gap-4">
                                    <span className="material-icons-round text-emerald-500 text-3xl">inventory_2</span>
                                    <div>
                                        <p className="text-text-muted text-xs uppercase tracking-wider">Restocking</p>
                                        <p className="text-white font-bold text-lg">{restockProduct.name}</p>
                                        <p className="text-text-secondary text-sm">Current Stock: {restockProduct.stock}</p>
                                    </div>
                                </div>

                                {/* Read-Only Info Card */}
                                <div className="grid grid-cols-2 gap-4 bg-white/5 rounded-xl p-4 border border-white/5">
                                    <div>
                                        <p className="text-xs text-text-muted">Assigned Supplier</p>
                                        <p className="text-white font-bold">
                                            {suppliers.find(s => s.id === restockProduct.supplierId)?.name || <span className="text-red-400">Not Assigned</span>}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-muted">Fixed Supply Cost</p>
                                        <p className="text-white font-bold">{formatPrice(restockProduct.supplyCost || 0)}</p>
                                    </div>
                                </div>

                                {(!restockProduct.supplierId) && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm flex items-center gap-2">
                                        <span className="material-icons-round text-sm">error</span>
                                        Please edit product to link a supplier first.
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs text-text-secondary mb-1">Quantity to Add</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                        value={restockData.quantity}
                                        onChange={e => setRestockData({ ...restockData, quantity: e.target.value })}
                                        disabled={!restockProduct.supplierId}
                                    />
                                </div>

                                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                                    <div className="flex justify-between items-center">
                                        <span className="text-emerald-500 font-medium">Total Cost</span>
                                        <span className="text-emerald-400 font-bold text-xl">
                                            {formatPrice((parseInt(restockData.quantity) || 0) * (restockProduct.supplyCost || 0))}
                                        </span>
                                    </div>
                                    <p className="text-xs text-center mt-2 text-emerald-500/70">
                                        *Will be recorded as Operational Expense
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <label className="block text-xs text-text-secondary mb-1">Notes (Optional)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                        value={restockData.notes}
                                        onChange={e => setRestockData({ ...restockData, notes: e.target.value })}
                                        placeholder="e.g. Batch #1234"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowRestockModal(false)}
                                        className="flex-1 py-3 rounded-xl font-bold text-text-muted hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!restockData.quantity || !restockProduct.supplierId}
                                        className="flex-1 py-3 rounded-xl font-bold bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Confirm Restock
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
