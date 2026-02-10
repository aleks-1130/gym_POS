import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function MemberDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();

    const [member, setMember] = useState(null);
    const [plans, setPlans] = useState([]);
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [activityFilter, setActivityFilter] = useState('all');

    const [showRenewModal, setShowRenewModal] = useState(false);
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);

    const [renewData, setRenewData] = useState({ planId: '', duration: 30, amount: 0, method: 'CASH' });
    const [renewAmountTendered, setRenewAmountTendered] = useState('');
    const [renewGcashReference, setRenewGcashReference] = useState('');
    const [renewGcashDate, setRenewGcashDate] = useState('');
    const [renewGcashTime, setRenewGcashTime] = useState('');

    const [freezeData, setFreezeData] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
    });

    const [passwordData, setPasswordData] = useState('');
    const [noteData, setNoteData] = useState('');

    useEffect(() => {
        fetchMember();
        fetchPlans();
        fetchNotes();
    }, [id]);

    const fetchMember = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${id}`);
            setMember(res.data);
            if (res.data?.plan) {
                setRenewData((prev) => ({
                    ...prev,
                    planId: res.data.plan.id,
                    duration: res.data.plan.duration,
                    amount: res.data.plan.price
                }));
            }
        } catch (e) {
            alert('Member not found');
            navigate('/members');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/plans');
            setPlans(res.data || []);
        } catch (e) {
            console.error('Failed to fetch plans', e);
        }
    };

    const fetchNotes = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/members/${id}/notes`);
            setNotes(res.data || []);
        } catch (e) {
            console.error('Failed to fetch notes', e);
        }
    };

    const handlePlanChange = (planId) => {
        const selected = plans.find((p) => p.id === Number(planId));
        if (!selected) return;
        setRenewData({
            ...renewData,
            planId: selected.id,
            duration: selected.duration,
            amount: selected.price
        });
    };

    const handleRenew = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                duration: renewData.duration,
                amount: renewData.amount,
                method: renewData.method,
                planId: renewData.planId || null,
                cashTendered: renewData.method === 'CASH' ? Number(renewAmountTendered) : null,
                changeDue: null,
                gcashReference: renewData.method === 'GCASH' ? renewGcashReference : null,
                gcashDate: renewGcashDate || null,
                gcashTime: renewGcashTime || null
            };
            await axios.post(`http://localhost:5000/api/members/${id}/renew`, payload);
            setShowRenewModal(false);
            await fetchMember();
            alert('Membership renewed');
        } catch (e) {
            alert(e.response?.data?.error || 'Renew failed');
        }
    };

    const handleFreeze = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`http://localhost:5000/api/members/${id}/status`, {
                status: 'FREEZED',
                freezeStartDate: freezeData.startDate,
                freezeEndDate: freezeData.endDate
            });
            setShowFreezeModal(false);
            await fetchMember();
        } catch (e) {
            alert('Freeze failed');
        }
    };

    const handleActivate = async () => {
        try {
            await axios.post(`http://localhost:5000/api/members/${id}/status`, { status: 'ACTIVE' });
            await fetchMember();
        } catch (e) {
            alert('Activation failed');
        }
    };

    const handleSetPassword = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/api/auth/member-setup', {
                email: member.email,
                password: passwordData
            });
            setShowPasswordModal(false);
            setPasswordData('');
            alert('Password set successfully');
        } catch (e) {
            alert('Failed to set password');
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!noteData.trim()) return;
        try {
            await axios.post(`http://localhost:5000/api/members/${id}/notes`, { content: noteData.trim() });
            setNoteData('');
            setShowNotesModal(false);
            fetchNotes();
        } catch (e) {
            alert('Failed to add note');
        }
    };

    const daysRemaining = useMemo(() => {
        if (!member?.expiryDate) return 0;
        const today = new Date();
        const expiry = new Date(member.expiryDate);
        return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    }, [member?.expiryDate]);

    const progress = useMemo(() => {
        if (!member?.startDate || !member?.expiryDate) return 0;
        const total = new Date(member.expiryDate) - new Date(member.startDate);
        const elapsed = new Date() - new Date(member.startDate);
        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    }, [member?.startDate, member?.expiryDate]);

    const filteredLogs = useMemo(() => {
        if (!member?.accessLogs) return [];
        const now = new Date();
        if (activityFilter === '7days') {
            const weekAgo = new Date(now.setDate(now.getDate() - 7));
            return member.accessLogs.filter((log) => new Date(log.checkIn) >= weekAgo);
        }
        if (activityFilter === '30days') {
            const monthAgo = new Date(now.setDate(now.getDate() - 30));
            return member.accessLogs.filter((log) => new Date(log.checkIn) >= monthAgo);
        }
        return member.accessLogs;
    }, [member?.accessLogs, activityFilter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }
    if (!member) return null;

    const isExpired = daysRemaining < 0;
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-2 text-sm">
                <button onClick={() => navigate('/members')} className="text-text-muted hover:text-primary transition-colors">Members</button>
                <span className="text-text-muted">/</span>
                <span className="text-white font-medium">{member.firstName} {member.lastName}</span>
            </div>

            <div className="bg-surface rounded-3xl border border-white/5 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{member.firstName} {member.lastName}</h1>
                        <p className="text-text-muted text-sm">Member #{member.id}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setShowRenewModal(true)} className="px-4 py-2 rounded-xl bg-primary text-background text-sm font-bold">Renew</button>
                        {member.status === 'FREEZED' ? (
                            <button onClick={handleActivate} className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-bold border border-emerald-500/30">Activate</button>
                        ) : (
                            <button onClick={() => setShowFreezeModal(true)} className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 text-sm font-bold border border-blue-500/30">Freeze</button>
                        )}
                        <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 rounded-xl bg-white/5 text-white text-sm font-bold border border-white/10">Set Password</button>
                        <button onClick={() => setShowNotesModal(true)} className="px-4 py-2 rounded-xl bg-white/5 text-white text-sm font-bold border border-white/10">Add Note</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface rounded-2xl border border-white/5 p-4">
                    <p className="text-text-muted text-xs uppercase tracking-wider">Status</p>
                    <p className={`text-lg font-bold ${member.status === 'ACTIVE' ? 'text-emerald-400' : member.status === 'FREEZED' ? 'text-blue-400' : 'text-red-400'}`}>{member.status}</p>
                </div>
                <div className="bg-surface rounded-2xl border border-white/5 p-4">
                    <p className="text-text-muted text-xs uppercase tracking-wider">Days Remaining</p>
                    <p className="text-lg font-bold text-white">{daysRemaining}</p>
                </div>
                <div className="bg-surface rounded-2xl border border-white/5 p-4">
                    <p className="text-text-muted text-xs uppercase tracking-wider">Progress</p>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-primary" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap">
                {['overview', 'activity', 'payments', 'notes'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border ${activeTab === tab ? 'bg-primary/15 text-primary border-primary/30' : 'bg-surface text-text-muted border-white/10'}`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="bg-surface rounded-2xl border border-white/5 p-6 space-y-3">
                    <p className="text-text-muted text-sm">Email: <span className="text-white">{member.email || 'N/A'}</span></p>
                    <p className="text-text-muted text-sm">Phone: <span className="text-white">{member.phone || 'N/A'}</span></p>
                    <p className="text-text-muted text-sm">Plan: <span className="text-white">{member.plan?.name || 'No Plan'}</span></p>
                    <p className="text-text-muted text-sm">Expiry: <span className={`text-white ${isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : ''}`}>{member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}</span></p>
                </div>
            )}

            {activeTab === 'activity' && (
                <div className="bg-surface rounded-2xl border border-white/5 p-6 space-y-4">
                    <div className="flex gap-2">
                        {['all', '7days', '30days'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setActivityFilter(f)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border ${activityFilter === f ? 'bg-primary/15 text-primary border-primary/30' : 'bg-white/5 text-text-muted border-white/10'}`}
                            >
                                {f === 'all' ? 'All' : f === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {filteredLogs.map((log) => (
                            <div key={log.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between">
                                <span className="text-white text-sm">{new Date(log.checkIn).toLocaleString()}</span>
                                <span className="text-xs text-text-muted">{log.status}</span>
                            </div>
                        ))}
                        {filteredLogs.length === 0 && <p className="text-text-muted">No activity found.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'payments' && (
                <div className="bg-surface rounded-2xl border border-white/5 p-6 space-y-3">
                    {(member.payments || []).map((pay) => (
                        <div key={pay.id} className="p-4 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex justify-between">
                                <span className="text-white font-semibold">{formatPrice(pay.amount)}</span>
                                <span className="text-text-muted text-xs">{pay.method}</span>
                            </div>
                            <p className="text-text-muted text-xs">{new Date(pay.date).toLocaleString()}</p>
                        </div>
                    ))}
                    {(member.payments || []).length === 0 && <p className="text-text-muted">No payments yet.</p>}
                </div>
            )}

            {activeTab === 'notes' && (
                <div className="bg-surface rounded-2xl border border-white/5 p-6 space-y-3">
                    {notes.map((note) => (
                        <div key={note.id} className="p-4 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-white text-sm">{note.content}</p>
                            <p className="text-text-muted text-xs mt-1">{new Date(note.createdAt).toLocaleString()}</p>
                        </div>
                    ))}
                    {notes.length === 0 && <p className="text-text-muted">No notes yet.</p>}
                </div>
            )}

            {showRenewModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleRenew} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
                        <h3 className="text-xl font-bold text-white">Renew Membership</h3>
                        <select
                            value={renewData.planId}
                            onChange={(e) => handlePlanChange(e.target.value)}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                        >
                            <option value="">Select plan</option>
                            {plans.map((plan) => (
                                <option key={plan.id} value={plan.id}>{plan.name}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={renewData.duration}
                            onChange={(e) => setRenewData((prev) => ({ ...prev, duration: Number(e.target.value) }))}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                            placeholder="Duration (days)"
                        />
                        <input
                            type="number"
                            value={renewData.amount}
                            onChange={(e) => setRenewData((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                            placeholder="Amount"
                        />
                        <select
                            value={renewData.method}
                            onChange={(e) => setRenewData((prev) => ({ ...prev, method: e.target.value }))}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                        >
                            <option value="CASH">Cash</option>
                            <option value="GCASH">GCash</option>
                            <option value="CARD">Card</option>
                        </select>
                        {renewData.method === 'CASH' && (
                            <input
                                type="number"
                                value={renewAmountTendered}
                                onChange={(e) => setRenewAmountTendered(e.target.value)}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                                placeholder="Cash tendered"
                            />
                        )}
                        {renewData.method === 'GCASH' && (
                            <div className="space-y-2">
                                <input
                                    value={renewGcashReference}
                                    onChange={(e) => setRenewGcashReference(e.target.value)}
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                                    placeholder="GCash reference"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={renewGcashDate}
                                        onChange={(e) => setRenewGcashDate(e.target.value)}
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                                    />
                                    <input
                                        type="time"
                                        value={renewGcashTime}
                                        onChange={(e) => setRenewGcashTime(e.target.value)}
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowRenewModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
                            <button type="submit" className="flex-1 py-2 rounded-xl bg-primary text-background font-bold">Renew</button>
                        </div>
                    </form>
                </div>
            )}

            {showFreezeModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleFreeze} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
                        <h3 className="text-xl font-bold text-white">Freeze Membership</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="date"
                                value={freezeData.startDate}
                                onChange={(e) => setFreezeData((prev) => ({ ...prev, startDate: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                            />
                            <input
                                type="date"
                                value={freezeData.endDate}
                                onChange={(e) => setFreezeData((prev) => ({ ...prev, endDate: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowFreezeModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
                            <button type="submit" className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-bold">Freeze</button>
                        </div>
                    </form>
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleSetPassword} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
                        <h3 className="text-xl font-bold text-white">Set Password</h3>
                        <input
                            type="password"
                            value={passwordData}
                            onChange={(e) => setPasswordData(e.target.value)}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                            placeholder="New password"
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
                            <button type="submit" className="flex-1 py-2 rounded-xl bg-primary text-background font-bold">Save</button>
                        </div>
                    </form>
                </div>
            )}

            {showNotesModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleAddNote} className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
                        <h3 className="text-xl font-bold text-white">Add Note</h3>
                        <textarea
                            value={noteData}
                            onChange={(e) => setNoteData(e.target.value)}
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white"
                            rows={4}
                            placeholder="Note"
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowNotesModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-white">Cancel</button>
                            <button type="submit" className="flex-1 py-2 rounded-xl bg-primary text-background font-bold">Save</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
