import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function MemberDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [renewData, setRenewData] = useState({ duration: 30, amount: 0, method: 'CASH' });
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState('');

    useEffect(() => {
        fetchMember();
    }, [id]);

    const fetchMember = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${id}`);
            setMember(res.data);
            if (res.data.plan) {
                setRenewData(prev => ({ ...prev, amount: res.data.plan.price, duration: res.data.plan.duration }));
            }
        } catch (e) {
            alert("Member not found");
            navigate('/members');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await axios.post(`http://localhost:5000/api/members/${id}/status`, { status: newStatus });
            fetchMember();
        } catch (e) {
            alert("Failed to update status");
        }
    };

    const handleRenew = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`http://localhost:5000/api/members/${id}/renew`, renewData);
            setShowRenewModal(false);
            fetchMember();
            alert("Membership Renewed!");
        } catch (e) {
            alert("Renewal failed");
        }
    };

    const handleSetPassword = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`http://localhost:5000/api/auth/member-setup`, { email: member.email, password: passwordData });
            setShowPasswordModal(false);
            setPasswordData('');
            alert("Password set successfully!");
        } catch (e) {
            alert("Failed to set password");
        }
    };

    if (loading) return <div className="text-primary">Loading...</div>;
    if (!member) return null;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <button onClick={() => navigate('/members')} className="text-text-muted hover:text-white mb-2 text-sm flex items-center gap-1">
                        <span className="material-icons-round text-sm">arrow_back</span> Back to List
                    </button>
                    <h1 className="text-3xl font-bold text-white">{member.firstName} {member.lastName}</h1>
                    <p className="text-text-muted">{member.email} • {member.phone}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowPasswordModal(true)} className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl font-medium hover:bg-primary/20 flex items-center gap-1">
                        <span className="material-icons-round text-sm">lock</span> Set Pwd
                    </button>
                    {member.status !== 'FREEZED' ? (
                        <button onClick={() => handleStatusChange('FREEZED')} className="bg-surfaceHighlight hover:bg-white/10 text-text-secondary px-4 py-2 rounded-xl font-medium">
                            Freeze
                        </button>
                    ) : (
                        <button onClick={() => handleStatusChange('ACTIVE')} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl font-medium hover:bg-emerald-500/20">
                            Unfreeze
                        </button>
                    )}
                    <button onClick={() => setShowRenewModal(true)} className="bg-primary hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-primary/20">
                        Renew Membership
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-white mb-4">Current Plan</h3>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-text-muted">Plan Name</p>
                                <p className="text-xl font-bold text-white">{member.plan?.name || "No Plan"}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-text-muted">Status</p>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${member.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    member.status === 'FREEZED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                    {member.status}
                                </span>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-text-muted">Start Date</p>
                                <p className="text-white">{new Date(member.startDate).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-text-muted">Expires On</p>
                                <p className={`font-bold ${new Date(member.expiryDate) < new Date() ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-white mb-4">Recent Access Logs</h3>
                        <div className="space-y-3">
                            {member.accessLogs?.map(log => (
                                <div key={log.id} className="flex justify-between text-sm border-b border-white/5 pb-2 last:border-0 text-white">
                                    <span className="text-text-muted">{new Date(log.checkIn).toLocaleString()}</span>
                                    <span className={log.status === 'ALLOWED' ? 'text-emerald-400' : 'text-red-400'}>{log.status}</span>
                                </div>
                            ))}
                            {(!member.accessLogs || member.accessLogs.length === 0) && <p className="text-text-muted">No access history.</p>}
                        </div>
                    </div>
                </div>

                {/* Payment History Side */}
                <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm h-fit">
                    <h3 className="text-lg font-bold text-white mb-4">Payment History</h3>
                    <div className="space-y-4">
                        {member.payments?.map(pay => (
                            <div key={pay.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex justify-between font-medium text-white">
                                    <span>${pay.amount}</span>
                                    <span className="text-xs bg-surface border border-white/10 px-2 py-0.5 rounded text-text-muted">{pay.method}</span>
                                </div>
                                <p className="text-xs text-text-secondary mt-1">{pay.type}</p>
                                <p className="text-xs text-text-muted mt-1">{new Date(pay.date).toLocaleDateString()}</p>
                            </div>
                        ))}
                        {(!member.payments || member.payments.length === 0) && <p className="text-text-muted">No payments found.</p>}
                    </div>
                </div>
            </div>

            {/* Set Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-6 rounded-3xl w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Set Member Password</h3>
                        <p className="text-text-muted text-sm mb-4">Set a password for the member to access the portal.</p>
                        <form onSubmit={handleSetPassword} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">New Password</label>
                                <input required type="password" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white focus:ring-primary focus:border-primary"
                                    value={passwordData} onChange={e => setPasswordData(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className="text-text-muted hover:text-white px-4 py-2">Cancel</button>
                                <button type="submit" className="bg-primary hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-primary/20">Save Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Renew Modal */}
            {showRenewModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-surface p-6 rounded-3xl w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Renew Membership</h3>
                        <form onSubmit={handleRenew} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Duration (Days)</label>
                                <input required type="number" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white focus:ring-primary focus:border-primary"
                                    value={renewData.duration} onChange={e => setRenewData({ ...renewData, duration: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Amount Paid ($)</label>
                                <input required type="number" step="0.01" className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white focus:ring-primary focus:border-primary"
                                    value={renewData.amount} onChange={e => setRenewData({ ...renewData, amount: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary mb-1">Payment Method</label>
                                <select className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white focus:ring-primary focus:border-primary"
                                    value={renewData.method} onChange={e => setRenewData({ ...renewData, method: e.target.value })}>
                                    <option value="CASH">Cash</option>
                                    <option value="CARD">Card</option>
                                    <option value="TRANSFER">Transfer</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowRenewModal(false)} className="text-text-muted hover:text-white px-4 py-2">Cancel</button>
                                <button type="submit" className="bg-primary hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-primary/20">Confirm Renew</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
