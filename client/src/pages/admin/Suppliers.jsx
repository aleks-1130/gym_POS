import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Suppliers = () => {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contact: '',
        email: '',
        address: '',
        notes: ''
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/suppliers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuppliers(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch suppliers", error);
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            if (editingId) {
                await axios.put(`http://localhost:5000/api/suppliers/${editingId}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('http://localhost:5000/api/suppliers', formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setShowModal(false);
            setFormData({ name: '', contact: '', email: '', address: '', notes: '' });
            setEditingId(null);
            fetchSuppliers();
        } catch (error) {
            alert('Operation failed');
        }
    };

    const handleEdit = (supplier) => {
        setFormData({
            name: supplier.name,
            contact: supplier.contact || '',
            email: supplier.email || '',
            address: supplier.address || '',
            notes: supplier.notes || ''
        });
        setEditingId(supplier.id);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this supplier?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/suppliers/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchSuppliers();
        } catch (error) {
            alert('Failed to delete (Supplier may have linked products)');
        }
    };

    return (
        <div className="p-8 relative z-10 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
                        Supplier Management
                    </h1>
                    <p className="text-text-muted text-lg">
                        Manage vendor relationships and supply chains
                    </p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ name: '', contact: '', email: '', address: '', notes: '' });
                        setEditingId(null);
                        setShowModal(true);
                    }}
                    className="bg-primary hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/25 transition-all transform hover:scale-105 flex items-center gap-2"
                >
                    <span className="material-icons-round">add_business</span>
                    Add Supplier
                </button>
            </div>

            {/* Suppliers Grid */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <span className="material-icons-round animate-spin text-4xl text-primary">loop</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {suppliers.map(supplier => (
                        <div key={supplier.id} className="group bg-surface hover:bg-surfaceHighlight border border-white/5 rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1 relative overflow-hidden">
                            {/* Action Buttons (Visible on Hover) */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(supplier)} className="p-2 bg-white/10 hover:bg-primary text-white rounded-xl transition-colors">
                                    <span className="material-icons-round text-sm">edit</span>
                                </button>
                                <button onClick={() => handleDelete(supplier.id)} className="p-2 bg-white/10 hover:bg-red-500 text-white rounded-xl transition-colors">
                                    <span className="material-icons-round text-sm">delete</span>
                                </button>
                            </div>

                            {/* Card Content */}
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                    <span className="material-icons-round text-primary text-2xl">local_shipping</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                                        {supplier.name}
                                    </h3>
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-text-muted border border-white/5 inline-block mt-2">
                                        ID: #{supplier.id}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                {supplier.contact && (
                                    <div className="flex items-center gap-3 text-sm text-text-secondary">
                                        <span className="material-icons-round text-primary/50 text-base">phone</span>
                                        {supplier.contact}
                                    </div>
                                )}
                                {supplier.email && (
                                    <div className="flex items-center gap-3 text-sm text-text-secondary">
                                        <span className="material-icons-round text-primary/50 text-base">email</span>
                                        {supplier.email}
                                    </div>
                                )}
                                {supplier.address && (
                                    <div className="flex items-center gap-3 text-sm text-text-secondary">
                                        <span className="material-icons-round text-primary/50 text-base">place</span>
                                        <span className="truncate">{supplier.address}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-xs text-text-muted">Active Vendor</span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/inventory?supplierId=${supplier.id}`);
                                    }}
                                    className="text-xs font-bold text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-primary hover:border-primary transition-colors cursor-pointer"
                                >
                                    {supplier._count?.products || 0} Products
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Empty State Add Card */}
                    <button
                        onClick={() => {
                            setFormData({ name: '', contact: '', email: '', address: '', notes: '' });
                            setEditingId(null);
                            setShowModal(true);
                        }}
                        className="border-2 border-dashed border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center text-text-muted hover:text-white hover:border-primary/50 hover:bg-white/5 transition-all min-h-[280px] group"
                    >
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <span className="material-icons-round text-3xl">add</span>
                        </div>
                        <span className="font-bold">Register New Supplier</span>
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h2 className="text-2xl font-bold text-white">
                                {editingId ? 'Edit Supplier' : 'New Supplier'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-white transition-colors">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Company Name</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-text-muted material-icons-round text-sm">business</span>
                                    <input
                                        required
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-white/20"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Acme Fitness Co."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Contact Phone</label>
                                    <input
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                        value={formData.contact}
                                        onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                        placeholder="0917..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="contact@..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Address</label>
                                <input
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Warehouse Access..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-1.5 uppercase tracking-wider">Notes</label>
                                <textarea
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-colors min-h-[100px]"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Delivery schedules, payment terms, etc."
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 rounded-xl font-bold text-text-muted hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 rounded-xl font-bold bg-primary text-white hover:bg-orange-600 shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5"
                                >
                                    {editingId ? 'Save Changes' : 'Create Supplier'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Suppliers;
