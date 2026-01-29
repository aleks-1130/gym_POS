import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function UserManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/users');
            setUsers(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (targetId, newRole, currentRole) => {
        if (!window.confirm(`Are you sure you want to change role from ${currentRole} to ${newRole}?`)) return;

        try {
            await axios.post('http://localhost:5000/api/owner/role-change', {
                targetUserId: targetId,
                newRole
            });
            alert("Role updated successfully");
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to update role");
        }
    };

    const handleTransferOwnership = async (newOwnerId) => {
        const confirmText = prompt("Type 'TRANSFER' to confirm absolute ownership transfer. You will be demoted.");
        if (confirmText !== 'TRANSFER') return;

        try {
            await axios.post('http://localhost:5000/api/owner/transfer-ownership', {
                newOwnerId
            });
            alert("Ownership transferred. Logging you out.");
            window.location.reload(); // Force re-login
        } catch (error) {
            alert(error.response?.data?.error || "Transfer failed");
        }
    };

    if (loading) return <div className="text-white p-8">Loading Users...</div>;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">User Management</h1>
                <p className="text-text-muted mt-1">Manage system access and roles</p>
            </header>

            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 text-text-muted text-sm bg-white/5">
                            <th className="p-6">User</th>
                            <th className="p-6">Email</th>
                            <th className="p-6">Current Role</th>
                            <th className="p-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-6 font-bold text-white">{u.name || 'Unnamed'}</td>
                                <td className="p-6 text-text-secondary">{u.email}</td>
                                <td className="p-6">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === 'OWNER' ? 'bg-purple-500/20 text-purple-400' :
                                        u.role === 'ADMIN' ? 'bg-primary/20 text-primary' :
                                            'bg-white/10 text-white'
                                        }`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="p-6 text-right">
                                    {currentUser.role === 'OWNER' && u.id !== currentUser.id && (
                                        <div className="flex justify-end gap-2">
                                            {u.role === 'STAFF' && (
                                                <button onClick={() => handleRoleChange(u.id, 'ADMIN', u.role)} className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20">
                                                    Promote to Admin
                                                </button>
                                            )}
                                            {u.role === 'ADMIN' && (
                                                <button onClick={() => handleRoleChange(u.id, 'STAFF', u.role)} className="px-3 py-1 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20">
                                                    Demote to Staff
                                                </button>
                                            )}
                                            <button onClick={() => handleTransferOwnership(u.id)} className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-bold hover:bg-purple-500/20 ml-2">
                                                Transfer Owner
                                            </button>
                                        </div>
                                    )}
                                    {currentUser.role === 'ADMIN' && u.role === 'STAFF' && (
                                        <span className="text-xs text-text-muted">Managed by Owner</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
