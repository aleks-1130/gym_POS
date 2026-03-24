import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { withApiBase } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';

/**
 * TenantManagement - SuperAdmin page to manage tenants (CRUD).
 * Clean, modern table with glassmorphism effects.
 */
export default function TenantManagement() {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTenant, setEditingTenant] = useState(null);
    const [formData, setFormData] = useState({ name: '', tenantId: '', adminEmail: '', adminPassword: '', gymName: '' });
    const [expandedTenants, setExpandedTenants] = useState(new Set());
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const { confirm } = useConfirm();

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const res = await axios.get(withApiBase('/api/superadmin/tenants'));
            setTenants(res.data);
        } catch (err) {
            console.error('Failed to fetch tenants:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const handleOpenModal = (tenant = null) => {
        setError(null);
        if (tenant) {
            setEditingTenant(tenant);
            setFormData({ name: tenant.name, tenantId: tenant.tenantId });
        } else {
            setEditingTenant(null);
            setFormData({ name: '', tenantId: '', adminEmail: '', adminPassword: '', gymName: '' });
        }
        setModalOpen(true);
    };

    const toggleExpand = (id) => {
        const next = new Set(expandedTenants);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedTenants(next);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            if (editingTenant) {
                await axios.put(withApiBase(`/api/superadmin/tenants/${editingTenant.id}`), formData);
            } else {
                await axios.post(withApiBase('/api/superadmin/tenants'), formData);
            }
            setModalOpen(false);
            fetchTenants();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (tenant) => {
        const ok = await confirm({
            title: 'Archive Tenant',
            message: `Are you sure you want to archive "${tenant.name}"? This will suspend all access for this tenant and its gyms, but their data will be preserved in the database for safety and recovery.`,
            confirmText: 'Archive',
            type: 'warning'
        });

        if (ok) {
            try {
                await axios.delete(withApiBase(`/api/superadmin/tenants/${tenant.id}`));
                fetchTenants();
            } catch (err) {
                alert(err.response?.data?.error || 'Failed to delete tenant');
            }
        }
    };

    if (loading && tenants.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="mt-4 text-text-muted font-bold text-sm">Loading tenants...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">Tenants</h2>
                    <p className="text-text-muted mt-1 font-medium">Manage and monitor all platform instances.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-black font-black rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                >
                    <span className="material-icons-round">add</span>
                    <span>Add Tenant</span>
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-white/5 rounded-3xl p-6 shadow-xl">
                    <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold mb-1">Total Tenants</p>
                    <p className="text-3xl font-black text-white">{tenants.length}</p>
                </div>
                <div className="bg-surface border border-white/5 rounded-3xl p-6 shadow-xl">
                    <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold mb-1">Active Gyms</p>
                    <p className="text-3xl font-black text-primary">
                        {tenants.reduce((sum, t) => sum + (t._count?.gyms || 0), 0)}
                    </p>
                </div>
                <div className="bg-surface border border-white/5 rounded-3xl p-6 shadow-xl">
                    <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold mb-1">Total Users</p>
                    <p className="text-3xl font-black text-white">
                        {tenants.reduce((sum, t) => sum + (t._count?.users || 0), 0)}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/5">
                            <th className="px-6 py-5 text-[10px] uppercase tracking-widest font-black text-text-muted">Tenant Name</th>
                            <th className="px-6 py-5 text-[10px] uppercase tracking-widest font-black text-text-muted">ID / Slug</th>
                            <th className="px-6 py-5 text-[10px] uppercase tracking-widest font-black text-text-muted">Gyms</th>
                            <th className="px-6 py-5 text-[10px] uppercase tracking-widest font-black text-text-muted text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {tenants.map((tenant) => (
                            <React.Fragment key={tenant.id}>
                                <tr className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleExpand(tenant.id)}
                                                className={`p-1 hover:bg-white/10 rounded transition-transform ${expandedTenants.has(tenant.id) ? 'rotate-90' : ''}`}
                                            >
                                                <span className="material-icons-round text-lg text-text-muted">chevron_right</span>
                                            </button>
                                            <div className="w-8 h-8 rounded-lg bg-surfaceHighlight flex items-center justify-center font-bold text-xs text-primary border border-white/5">
                                                {tenant.name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-sm text-white">{tenant.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <code className="text-xs bg-white/5 px-2 py-1 rounded text-primary">{tenant.tenantId}</code>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-medium text-text-muted group-hover:text-white transition-colors">
                                        {tenant._count?.gyms || 0} Gyms
                                    </td>
                                    <td className="px-6 py-5 text-right space-x-2">
                                        <button
                                            onClick={() => handleOpenModal(tenant)}
                                            className="p-2 text-text-muted hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                        >
                                            <span className="material-icons-round text-lg">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tenant)}
                                            className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <span className="material-icons-round text-lg">delete</span>
                                        </button>
                                    </td>
                                </tr>

                                {/* Expansion Row */}
                                {expandedTenants.has(tenant.id) && (
                                    <tr className="bg-white/[0.01]">
                                        <td colSpan="4" className="px-14 py-6 border-b border-white/5">
                                            <div className="max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
                                                    {tenant.gyms?.length > 0 ? (
                                                        tenant.gyms.map(gym => (
                                                            <div key={gym.id} className="bg-surfaceHighlight border border-white/5 rounded-2xl p-4 flex items-center justify-between group/gym hover:border-primary/30 transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="material-icons-round text-primary text-sm">business</span>
                                                                    <div>
                                                                        <p className="text-xs font-black text-white">{gym.name}</p>
                                                                        <p className="text-[10px] text-text-muted font-bold leading-tight">{gym.companyId}</p>
                                                                    </div>
                                                                </div>
                                                                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider ${gym.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                    {gym.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-text-muted font-bold italic col-span-full">No branches launched yet.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] shadow-2xl p-8 relative animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setModalOpen(false)}
                            className="absolute top-6 right-6 p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-full"
                        >
                            <span className="material-icons-round">close</span>
                        </button>

                        <h3 className="text-2xl font-black text-white mb-2">{editingTenant ? 'Edit' : 'Add'} Tenant</h3>
                        <p className="text-text-muted text-sm mb-8 font-medium">New platform instances get their own scope.</p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-black text-text-muted px-1">Instance Name</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Iron Paradise"
                                    className="w-full bg-surfaceHighlight border border-white/5 rounded-2xl py-4 px-5 text-white placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-medium"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-black text-text-muted px-1">Unique Slug (ID)</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. iron-paradise"
                                    className="w-full bg-surfaceHighlight border border-white/5 rounded-2xl py-4 px-5 text-white placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-medium"
                                    value={formData.tenantId}
                                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value.replace(/\s+/g, '-') })}
                                />
                            </div>

                            {!editingTenant && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest font-black text-text-muted px-1">Initial Gym Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Branch 1 (Optional)"
                                            className="w-full bg-surfaceHighlight border border-white/5 rounded-2xl py-4 px-5 text-white placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-medium"
                                            value={formData.gymName}
                                            onChange={(e) => setFormData({ ...formData, gymName: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase tracking-widest font-black text-text-muted px-1">Owner Email</label>
                                            <input
                                                required
                                                type="email"
                                                placeholder="owner@example.com"
                                                className="w-full bg-surfaceHighlight border border-white/5 rounded-2xl py-4 px-5 text-white placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-medium"
                                                value={formData.adminEmail}
                                                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase tracking-widest font-black text-text-muted px-1">Owner Password</label>
                                            <input
                                                required
                                                type="password"
                                                placeholder="password123"
                                                className="w-full bg-surfaceHighlight border border-white/5 rounded-2xl py-4 px-5 text-white placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all font-medium"
                                                value={formData.adminPassword}
                                                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold animate-shake">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 bg-primary hover:bg-primary-dark disabled:opacity-50 text-black font-black rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 mt-4"
                            >
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span className="material-icons-round">rocket_launch</span>
                                        <span>{editingTenant ? 'Update Tenant' : 'Launch Tenant'}</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
