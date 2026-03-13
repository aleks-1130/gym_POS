import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/common/DataTable';

const Suppliers = () => {
    const navigate = useNavigate();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
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
            const res = await axios.get('/api/suppliers', {
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
                await axios.put(`/api/suppliers/${editingId}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/suppliers', formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setShowModal(false);
            setFormData({ name: '', contact: '', email: '', address: '', notes: '' });
            setEditingId(null);
            fetchSuppliers();
        } catch (error) {
            await showAlert({ title: 'Save Failed', message: 'Operation failed. Please try again.', type: 'danger' });
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
        const confirmed = await showConfirm({ title: 'Delete Supplier?', message: 'Delete this supplier? Suppliers with linked products cannot be deleted.', confirmLabel: 'Delete', type: 'danger' });
        if (!confirmed) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/suppliers/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchSuppliers();
        } catch (error) {
            await showAlert({ title: 'Delete Failed', message: 'Failed to delete supplier. It may have linked products.', type: 'danger' });
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Supplier',
            accessor: (supplier) => (
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center border border-white/10">
                        <span className="material-icons-round text-primary text-xl">local_shipping</span>
                    </div>
                    <div>
                        <p className="font-bold text-white group-hover:text-primary transition-colors">{supplier.name}</p>
                        <p className="text-xs text-text-muted">ID: #{supplier.id}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Contact Info',
            accessor: (supplier) => (
                <div className="space-y-1">
                    {supplier.contact && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <span className="material-icons-round text-primary/50 text-[14px]">phone</span>
                            {supplier.contact}
                        </div>
                    )}
                    {supplier.email && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <span className="material-icons-round text-primary/50 text-[14px]">email</span>
                            {supplier.email}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Address',
            accessor: (supplier) => (
                <div className="flex items-center gap-2 text-sm text-text-secondary max-w-[200px]">
                    {supplier.address && (
                        <>
                            <span className="material-icons-round text-primary/50 text-[14px] shrink-0">place</span>
                            <span className="truncate">{supplier.address}</span>
                        </>
                    )}
                </div>
            )
        },
        {
            header: 'Stats',
            accessor: (supplier) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate('/inventory?tab=products');
                    }}
                    className="text-xs font-bold text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-primary hover:border-primary transition-colors cursor-pointer"
                >
                    {supplier._count?.products || 0} Products
                </button>
            )
        }
    ], [navigate]);

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

            <DataTable
                columns={columns}
                data={suppliers}
                isLoading={loading}
                emptyMessage="No suppliers found."
                onRowClick={(supplier) => handleEdit(supplier)}
                actions={(supplier) => (
                    <div className="flex items-center justify-end gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(supplier); }} className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-primary text-white rounded-lg border border-white/10 transition-colors" title="Edit Supplier">
                            <span className="material-icons-round text-[18px]">edit</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(supplier.id); }} className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-red-500 text-white rounded-lg border border-white/10 transition-colors" title="Delete Supplier">
                            <span className="material-icons-round text-[18px]">delete</span>
                        </button>
                    </div>
                )}
            />

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
