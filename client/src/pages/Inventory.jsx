import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Inventory() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '', category: 'SUPPLEMENT', price: '', stock: '', minStock: '5', imageUrl: ''
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/products');
            setProducts(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (product) => {
        setEditingId(product.id);
        setFormData({
            name: product.name,
            category: product.category,
            price: product.price,
            stock: product.stock,
            minStock: product.minStock,
            imageUrl: product.imageUrl || ''
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setFormData({ name: '', category: 'SUPPLEMENT', price: '', stock: '', minStock: '5', imageUrl: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            price: parseFloat(formData.price) || 0,
            stock: parseInt(formData.stock) || 0,
            minStock: parseInt(formData.minStock) || 0
        };

        try {
            if (editingId) {
                // UPDATE
                await axios.put(`http://localhost:5000/api/products/${editingId}`, payload);
            } else {
                // CREATE
                await axios.post('http://localhost:5000/api/products', payload);
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
            await axios.delete(`http://localhost:5000/api/products/${id}`);
            fetchProducts();
        } catch (e) {
            alert("Failed to delete");
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventory Management</h1>
                    <p className="text-text-muted mt-1">Track stock levels and manage catalog</p>
                </div>
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
            </header>

            {/* Form */}
            {showForm && (
                <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm animate-fade-in-down">
                    <h3 className="text-xl font-bold text-white mb-4">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Product Name</label>
                            <input required className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Whey Protein" />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Category</label>
                            <select className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                <option value="SUPPLEMENT">Supplement</option>
                                <option value="DRINK">Drink</option>
                                <option value="MERCH">Merchandise</option>
                                <option value="EQUIPMENT">Equipment</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Price ($)</label>
                            <input required type="number" step="0.01" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Stock</label>
                                <input required type="number" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                    value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
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
                        <div className="md:col-span-2 flex justify-end gap-3">
                            <button type="button" onClick={resetForm} className="text-text-muted hover:text-white font-bold px-6 py-3">
                                Cancel
                            </button>
                            <button type="submit" className="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20">
                                {editingId ? 'Update Product' : 'Save Product'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Inventory Table */}
            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-text-muted text-sm bg-white/5">
                                <th className="p-6 font-medium">Product</th>
                                <th className="p-6 font-medium">Category</th>
                                <th className="p-6 font-medium">Price</th>
                                <th className="p-6 font-medium">Stock Level</th>
                                <th className="p-6 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {products.map(product => {
                                const isLowStock = product.stock <= product.minStock;
                                return (
                                    <tr key={product.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-6">
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
                                        </td>
                                        <td className="p-6">
                                            <span className="px-3 py-1 bg-white/5 text-text-secondary rounded-full text-xs font-medium border border-white/10">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="p-6 text-white font-mono font-bold">
                                            ${product.price.toFixed(2)}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 bg-white/10 h-2 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${isLowStock ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (product.stock / 50) * 100)}%` }}></div>
                                                </div>
                                                <span className={`font-bold ${isLowStock ? 'text-red-500' : 'text-text-secondary'}`}>
                                                    {product.stock} {isLowStock && <span className="text-xs ml-1">(Low!)</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleEdit(product)} className="text-text-muted hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary/10">
                                                    <span className="material-icons-round">edit</span>
                                                </button>
                                                {user?.role === 'ADMIN' && (
                                                    <button onClick={() => handleDelete(product.id)} className="text-text-muted hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10">
                                                        <span className="material-icons-round">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {products.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-text-muted">
                                        No products in inventory. Click "Add Product" to start.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
