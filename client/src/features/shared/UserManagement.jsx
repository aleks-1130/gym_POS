import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';
import CustomSelect from '../../components/common/CustomSelect';

const UserManagement = () => {
    const { user: currentUser } = useAuth();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterGymId, setFilterGymId] = useState('');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [limit, setLimit] = useState(10);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [userDraft, setUserDraft] = useState({
        id: null,
        name: '',
        email: '',
        password: '',
        role: ROLES.STAFF,
        gymId: currentUser?.gymId || ''
    });

    const isOwner = currentUser?.role === ROLES.OWNER;

    useEffect(() => {
        setCurrentPage(1); // Reset to first page on filter change
    }, [filterGymId]);

    useEffect(() => {
        fetchUsers();
        if (isOwner && branches.length === 0) fetchBranches();
    }, [filterGymId, currentPage, limit]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const baseUrl = '/api/admin/users';
            const params = new URLSearchParams();
            if (isOwner && filterGymId) params.append('gymId', filterGymId);
            params.append('page', currentPage);
            params.append('limit', limit);

            const res = await axios.get(`${baseUrl}?${params.toString()}`);
            setUsers(res.data.users);
            setTotalPages(res.data.pagination.totalPages);
            setTotalUsers(res.data.pagination.totalUsers);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await axios.get('/api/admin/branches');
            setBranches(res.data);
        } catch (error) {
            console.error("Failed to fetch branches:", error);
        }
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setEditMode(true);
            setUserDraft({
                id: user.id,
                name: user.name,
                email: user.email,
                password: '', // Don't pre-fill password
                role: user.role,
                gymId: user.gymId || ''
            });
        } else {
            setEditMode(false);
            setUserDraft({
                id: null,
                name: '',
                email: '',
                password: '',
                role: ROLES.STAFF,
                gymId: currentUser?.gymId || ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode) {
                await axios.put(`/api/admin/users/${userDraft.id}`, userDraft);
                await showAlert({ title: 'Updated', message: 'User updated successfully!', type: 'success' });
            } else {
                await axios.post('/api/admin/users', userDraft);
                await showAlert({ title: 'Success', message: 'User created successfully!', type: 'success' });
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) {
            await showAlert({ 
                title: 'Error', 
                message: error.response?.data?.error || 'Operation failed', 
                type: 'danger' 
            });
        }
    };

    const handleDeleteUser = async (user) => {
        const confirmed = await showConfirm({
            title: 'Delete User?',
            message: `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
            type: 'danger'
        });

        if (confirmed) {
            try {
                await axios.delete(`/api/admin/users/${user.id}`);
                fetchUsers();
                await showAlert({ title: 'Deleted', message: 'User removed from system.', type: 'success' });
            } catch (error) {
                await showAlert({ title: 'Error', message: error.response?.data?.error || 'Deletion failed', type: 'danger' });
            }
        }
    };

    const handleRoleChange = async (targetUserId, newRole) => {
        const confirmed = await showConfirm({
            title: 'Change Role?',
            message: `Are you sure you want to change this user's role to ${newRole}?`,
            type: 'warning'
        });

        if (confirmed) {
            try {
                await axios.post('/api/admin/owner/role-change', {
                    targetUserId,
                    newRole
                });
                fetchUsers();
                await showAlert({ title: 'Updated', message: 'User role updated successfully!', type: 'success' });
            } catch (error) {
                await showAlert({ 
                    title: 'Error', 
                    message: error.response?.data?.error || 'Failed to update role', 
                    type: 'danger' 
                });
            }
        }
    };

    const handleTransferOwnership = async (targetUserId) => {
        const confirmed = await showConfirm({
            title: 'Transfer Ownership?',
            message: 'CRITICAL: This will transfer full ownership of the system to this user. You will no longer be an owner.',
            type: 'danger'
        });

        if (confirmed) {
            try {
                await axios.post('/api/admin/owner/transfer-ownership', { targetUserId });
                window.location.reload();
            } catch (error) {
                await showAlert({ title: 'Error', message: error.response?.data?.error || 'Transfer failed', type: 'danger' });
            }
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-surface border border-white/5 p-8 rounded-[2rem] shadow-xl">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight">User Management</h1>
                    <p className="text-text-muted mt-2 text-lg">Manage access control and staff roles across your organization.</p>
                </div>
                
                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    {isOwner && (
                        <div className="flex-1 md:flex-none min-w-[200px]">
                            <CustomSelect 
                                value={filterGymId}
                                options={[
                                    { value: '', label: 'All Branches' },
                                    ...branches.map(b => ({ value: b.id, label: b.name }))
                                ]}
                                onChange={(e) => setFilterGymId(e.target.value)}
                                className="w-full shadow-lg"
                            />
                        </div>
                    )}
                    <button 
                        onClick={() => handleOpenModal()}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        <span className="material-icons-round">person_add</span>
                        Add User
                    </button>
                </div>
            </header>

            {/* User List Table */}
            <div className="bg-surface border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5">
                                <th className="px-8 py-5 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] border-b border-white/5 w-16">#</th>
                                <th className="px-8 py-5 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] border-b border-white/5">Name & Email</th>
                                <th className="px-8 py-5 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] border-b border-white/5">Role</th>
                                <th className="px-8 py-5 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] border-b border-white/5">Branch</th>
                                <th className="px-8 py-5 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] border-b border-white/5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-text-muted animate-pulse font-medium">Loading users...</td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-text-muted font-medium">No users found.</td>
                                </tr>
                            ) : users.map((u, idx) => {
                                const isSelf = u.id === currentUser?.id;
                                const isTargetOwner = u.role === ROLES.OWNER;
                                
                                return (
                                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-5 font-mono text-sm text-text-muted">{idx + 1}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-orange-500/10 flex items-center justify-center text-primary font-black shadow-inner">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-white font-bold truncate group-hover:text-primary transition-colors">{u.name}</p>
                                                    <p className="text-text-muted text-xs truncate">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black shadow-sm uppercase tracking-wider ${
                                                u.role === ROLES.OWNER ? 'bg-orange-500/20 text-orange-400' :
                                                u.role === ROLES.ADMIN ? 'bg-indigo-500/20 text-indigo-400' :
                                                'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-text-muted transition-all">
                                                <span className="material-icons-round text-sm opacity-50">location_on</span>
                                                <span className="text-sm font-medium">{u.gym?.name || 'Global'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Edit Button: Hide for target Owner if requester is Admin */}
                                                {!(isTargetOwner && currentUser?.role === ROLES.ADMIN) && (
                                                    <button 
                                                        onClick={() => handleOpenModal(u)}
                                                        className="p-2.5 rounded-xl bg-white/5 text-text-secondary hover:text-primary hover:bg-primary/10 transition-all active:scale-95"
                                                        title="Edit User"
                                                    >
                                                        <span className="material-icons-round text-lg">edit</span>
                                                    </button>
                                                )}

                                                {/* Role specific actions for Owner */}
                                                {isOwner && !isSelf && !isTargetOwner && (
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => handleRoleChange(u.id, u.role === ROLES.ADMIN ? ROLES.STAFF : ROLES.ADMIN)}
                                                            className="p-2.5 rounded-xl bg-white/5 text-text-secondary hover:text-primary hover:bg-primary/10 transition-all active:scale-90"
                                                            title={u.role === ROLES.ADMIN ? "Demote to Staff" : "Promote to Admin"}
                                                        >
                                                            <span className="material-icons-round text-lg">
                                                                {u.role === ROLES.ADMIN ? 'arrow_downward' : 'arrow_upward'}
                                                            </span>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleTransferOwnership(u.id)}
                                                            className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                                            title="Transfer Ownership"
                                                        >
                                                            <span className="material-icons-round text-lg">stars</span>
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Delete Button: Hide for self and for target Owner */}
                                                {!isSelf && !isTargetOwner && (
                                                    <button 
                                                        onClick={() => handleDeleteUser(u)}
                                                        className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                                                        title="Delete User"
                                                    >
                                                        <span className="material-icons-round text-lg">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="bg-white/5 border-t border-white/5 px-8 py-5 flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-text-muted font-medium">
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                           <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Per Page</span>
                           <select 
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-transparent border-none text-white font-bold outline-none cursor-pointer text-xs focus:ring-0 appearance-none pr-1"
                           >
                                {[5, 10, 20, 50].map(v => <option key={v} value={v} className="bg-surface text-white">{v}</option>)}
                           </select>
                           <span className="material-icons-round text-xs opacity-40">expand_more</span>
                        </div>
                        <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
                        <div>
                            Showing <span className="text-white font-bold">{users.length}</span> of <span className="text-white font-bold">{totalUsers}</span> staff members
                        </div>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`flex items-center gap-1 px-4 py-2 rounded-xl border border-white/10 text-sm font-bold transition-all
                                    ${currentPage === 1 
                                        ? 'opacity-30 cursor-not-allowed' 
                                        : 'text-white hover:bg-white/10 hover:border-white/20 active:scale-95'}`}
                            >
                                <span className="material-icons-round text-lg">chevron_left</span>
                                Previous
                            </button>
                            
                            <div className="flex items-center px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                                <span className="text-sm font-bold text-primary">{currentPage}</span>
                                <span className="text-sm font-medium text-text-muted mx-2">of</span>
                                <span className="text-sm font-bold text-white">{totalPages}</span>
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className={`flex items-center gap-1 px-4 py-2 rounded-xl border border-white/10 text-sm font-bold transition-all
                                    ${currentPage === totalPages 
                                        ? 'opacity-30 cursor-not-allowed' 
                                        : 'text-white hover:bg-white/10 hover:border-white/20 active:scale-95'}`}
                            >
                                Next
                                <span className="material-icons-round text-lg">chevron_right</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-surface border border-white/5 w-full max-w-lg rounded-[2.5rem] p-10 shadow-3xl">
                        <h2 className="text-3xl font-black text-white mb-2">{editMode ? 'Refine Profile' : 'Grow the Team'}</h2>
                        <p className="text-text-muted mb-10 text-lg">{editMode ? 'Update account details and access levels.' : 'Onboard a new staff member or admin to the platform.'}</p>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-end h-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-2.5 ml-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 text-white focus:outline-none focus:border-primary focus:bg-white/10 transition-all font-bold"
                                        placeholder="Enter name"
                                        value={userDraft.name}
                                        onChange={e => setUserDraft({...userDraft, name: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="flex items-end h-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-2.5 ml-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 text-white focus:outline-none focus:border-primary focus:bg-white/10 transition-all font-bold"
                                        placeholder="email@organization.com"
                                        value={userDraft.email}
                                        onChange={e => setUserDraft({...userDraft, email: e.target.value})}
                                    />
                                </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <CustomSelect 
                                            label="Role"
                                            value={userDraft.role}
                                            options={[
                                                { value: ROLES.STAFF, label: 'Staff' },
                                                { value: ROLES.ADMIN, label: 'Admin' },
                                                ...(isOwner && editMode && userDraft.role === ROLES.OWNER ? [{ value: ROLES.OWNER, label: 'Owner' }] : [])
                                            ]}
                                            onChange={e => setUserDraft({...userDraft, role: e.target.value})}
                                        />
                                        <div className="space-y-0">
                                            <label className="flex items-end h-8 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-2.5 ml-1 whitespace-nowrap">
                                                {editMode ? 'New Password' : 'Password'}
                                            </label>
                                            <input 
                                                type="password" 
                                                required={!editMode}
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 text-white focus:outline-none focus:border-primary focus:bg-white/10 transition-all font-bold placeholder:text-text-muted/30"
                                                placeholder={editMode ? "Leave blank to keep" : "••••••••"}
                                                value={userDraft.password}
                                                onChange={e => setUserDraft({...userDraft, password: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                {isOwner && (
                                    <CustomSelect 
                                        label="Branch Assignment"
                                        value={userDraft.gymId}
                                        options={[
                                            { value: '', label: 'Select Branch' },
                                            ...branches.map(b => ({ value: b.id, label: b.name }))
                                        ]}
                                        onChange={e => setUserDraft({...userDraft, gymId: e.target.value})}
                                        required
                                    />
                                )}
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-3.5 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all active:scale-95 text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-primary hover:bg-orange-600 text-white font-bold px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-2 text-sm"
                                >
                                    <span className="material-icons-round text-lg">{editMode ? 'save' : 'check_circle'}</span>
                                    {editMode ? 'Update Profile' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
