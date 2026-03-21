import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { withApiBase } from '../../config/api';
import { useConfirm } from '../../context/ConfirmContext';

const Branches = () => {
    const { user, switchBranch } = useAuth();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const isOwner = String(user?.role || '').toUpperCase() === 'OWNER';
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [branchDraft, setBranchDraft] = useState({
        name: '',
        companyId: '',
        currency: 'PHP',
        taxRate: 12.0,
        referencePrefix: 'BR-'
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            const res = await axios.get(withApiBase('/api/admin/branches'));
            setBranches(res.data);
        } catch (err) {
            console.error('Failed to fetch branches:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(withApiBase('/api/admin/branches'), branchDraft);
            setBranches([...branches, res.data]);
            setBranchDraft({
                name: '',
                companyId: '',
                currency: 'PHP',
                taxRate: 12.0,
                referencePrefix: 'BR-'
            });
            await showAlert({ title: 'Success', message: 'Branch created successfully!', type: 'success' });
        } catch (err) {
            await showAlert({ title: 'Error', message: err.response?.data?.error || 'Failed to create branch', type: 'danger' });
        }
    };

    const handleUpdateBranch = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.put(withApiBase(`/api/admin/branches/${editingId}`), branchDraft);
            setBranches(branches.map(b => b.id === editingId ? { ...b, ...res.data } : b));
            cancelEdit();
            await showAlert({ title: 'Success', message: 'Branch updated successfully!', type: 'success' });
        } catch (err) {
            await showAlert({ title: 'Error', message: err.response?.data?.error || 'Failed to update branch', type: 'danger' });
        }
    };

    const startEdit = (branch) => {
        setEditingId(branch.id);
        setBranchDraft({
            name: branch.name,
            companyId: branch.companyId,
            currency: branch.currency,
            taxRate: branch.taxRate,
            referencePrefix: branch.referencePrefix
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setBranchDraft({
            name: '',
            companyId: '',
            currency: 'PHP',
            taxRate: 12.0,
            referencePrefix: 'BR-'
        });
    };

    const handleSwitchBranch = async (branchId) => {
        const confirmed = await showConfirm({ 
            title: 'Switch Branch?',
            message: 'Are you sure you want to switch branch? You will be redirected.',
            type: 'info'
        });
        if (confirmed) {
            switchBranch(branchId);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Organization Units</h1>
                <p className="text-text-muted mt-2 text-lg">Manage your business branches and switch operational contexts seamlessly.</p>
            </div>

            <div className={`grid grid-cols-1 ${isOwner ? 'lg:grid-cols-3' : ''} gap-8`}>
                {/* Branch Listing */}
                <div className={`${isOwner ? 'lg:col-span-2' : ''} space-y-6`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary">location_on</span>
                            Active Branches
                        </h2>
                        <span className="bg-white/5 text-xs font-bold px-3 py-1 rounded-full text-text-muted">
                            {branches.length} Total
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {branches.map(branch => (
                            <div key={branch.id} 
                                className={`group p-6 rounded-3xl border transition-all duration-300 ${
                                    user.gymId === branch.id 
                                    ? 'bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(249,115,22,0.1)]' 
                                    : 'bg-surfaceHighlight border-white/5 hover:border-white/10 hover:bg-white/5'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-2xl ${user.gymId === branch.id ? 'bg-primary/20 text-primary' : 'bg-white/5 text-text-muted'}`}>
                                        <span className="material-icons-round">business</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isOwner && (
                                            <button 
                                                onClick={() => startEdit(branch)}
                                                className={`p-2 rounded-xl transition-all ${editingId === branch.id ? 'bg-primary text-white' : 'bg-white/5 text-text-muted hover:text-primary hover:bg-primary/10'}`}
                                                title="Edit Branch Settings"
                                            >
                                                <span className="material-icons-round text-sm">settings</span>
                                            </button>
                                        )}
                                        {user.gymId === branch.id && (
                                            <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>
                                        )}
                                    </div>
                                </div>
                                
                                <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{branch.name}</h3>
                                <p className="text-sm text-text-muted font-mono mt-1 opacity-70">ID: {branch.companyId}</p>
                                
                                <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/5">
                                    <div className="flex gap-4">
                                        <div className="text-center">
                                            <p className="text-[10px] text-text-muted font-black uppercase">Currency</p>
                                            <p className="text-white text-sm font-bold">{branch.currency}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-text-muted font-black uppercase">Tax</p>
                                            <p className="text-white text-sm font-bold">{branch.taxRate}%</p>
                                        </div>
                                    </div>
                                    
                                    {user.gymId !== branch.id && (
                                        <button 
                                            onClick={() => handleSwitchBranch(branch.id)}
                                            className="bg-white/5 hover:bg-primary hover:text-white text-primary text-xs font-bold px-4 py-2 rounded-xl transition-all"
                                        >
                                            Switch to Branch
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Create New Branch Form - OWNER ONLY */}
                {isOwner && (
                    <div className="lg:col-span-1">
                    <div className="bg-surface border border-white/5 rounded-3xl p-8 sticky top-8 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-2">{editingId ? 'Update Branch' : 'Grow Business'}</h2>
                        <p className="text-sm text-text-muted mb-8">
                            {editingId ? `Modifying settings for ${branchDraft.name}.` : 'Add a new physical location to your organization.'}
                        </p>

                        <form onSubmit={editingId ? handleUpdateBranch : handleCreateBranch} className="space-y-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all placeholder:text-white/20"
                                        placeholder="FitOS - East Wing"
                                        value={branchDraft.name}
                                        onChange={e => setBranchDraft({ ...branchDraft, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Company identifier</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-5 py-4 text-white font-mono focus:outline-none focus:border-primary transition-all placeholder:text-white/20"
                                        placeholder="GYM-EAST-001"
                                        value={branchDraft.companyId}
                                        onChange={e => setBranchDraft({ ...branchDraft, companyId: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Currency</label>
                                        <select 
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all"
                                            value={branchDraft.currency}
                                            onChange={e => setBranchDraft({ ...branchDraft, currency: e.target.value })}
                                        >
                                            <option value="PHP">PHP</option>
                                            <option value="SGD">SGD</option>
                                            <option value="USD">USD</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Tax Rate (%)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-primary transition-all"
                                            value={branchDraft.taxRate}
                                            onChange={e => setBranchDraft({ ...branchDraft, taxRate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                                <div className="pt-4 flex flex-col gap-3">
                                    <button
                                        type="submit"
                                        className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group"
                                    >
                                        <span className="material-icons-round group-hover:rotate-12 transition-transform">{editingId ? 'save' : 'add_business'}</span>
                                        {editingId ? 'Save Changes' : 'Launch Branch'}
                                    </button>

                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={cancelEdit}
                                            className="w-full bg-white/5 hover:bg-white/10 text-text-muted font-bold py-3 rounded-2xl transition-all"
                                        >
                                            Cancel Editing
                                        </button>
                                    )}
                                </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default Branches;
