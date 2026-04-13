import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/common/DataTable';

const Suppliers = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contact: '',
        email: '',
        address: '',
        notes: ''
    });
    const [editingId, setEditingId] = useState(null);

    const { data: suppliers = [], isLoading: loading } = useQuery({
        queryKey: ['adminSuppliers'],
        queryFn: async () => {
            const res = await axios.get('/api/suppliers');
            return res.data;
        }
    });

    const saveSupplierMutation = useMutation({
        mutationFn: async (payload) => {
            if (payload.isEdit) {
                return axios.put(`/api/suppliers/${payload.id}`, payload.data);
            } else {
                return axios.post('/api/suppliers', payload.data);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSuppliers'] });
            setShowModal(false);
            setFormData({ name: '', contact: '', email: '', address: '', notes: '' });
            setEditingId(null);
        },
        onError: (error) => {
            showAlert({ title: 'Save Failed', message: error.response?.data?.error || 'Operation failed. Please try again.', type: 'danger' });
        }
    });

    const deleteSupplierMutation = useMutation({
        mutationFn: async (id) => axios.delete(`/api/suppliers/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminSuppliers'] }),
        onError: (error) => showAlert({ title: 'Delete Failed', message: error.response?.data?.error || 'Failed to delete supplier. It may have linked products.', type: 'danger' })
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        saveSupplierMutation.mutate({ isEdit: !!editingId, id: editingId, data: formData });
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
        deleteSupplierMutation.mutate(id);
    };

    const columns = useMemo(() => [
        {
            header: 'Supplier',
            accessor: (supplier) => (
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center border border-white/10">
                        <span className="material-icons-round text-primary text-xl">local_shipping</span>
                    </div>
                    <div>
                        <p className="font-bold text-white">{supplier.name}</p>
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
        <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-surface p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-white font-semibold">Supplier Directory</p>
                        <p className="text-xs text-text-muted mt-1">
                            Maintain vendor records and linked product sources.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setFormData({ name: '', contact: '', email: '', address: '', notes: '' });
                            setEditingId(null);
                            setShowModal(true);
                        }}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-background transition-colors hover:bg-orange-600"
                    >
                        + Add Supplier
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-surface shadow-sm overflow-hidden">
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
            </div>

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
