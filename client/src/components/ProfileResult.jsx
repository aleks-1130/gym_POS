import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ProfileResult({ logId: propLogId, showHistory = false, showToolbar = true, compact = false }) {
    const { logId: paramLogId } = useParams();
    const navigate = useNavigate();
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const logId = propLogId || paramLogId;

    useEffect(() => {
        if (logId) {
            setLoading(true);
            fetchLogDetails();
        } else {
            setLog(null);
        }
    }, [logId]);

    const fetchLogDetails = async () => {
        if (logId === 'dummy') {
            setLog({
                id: 'dummy',
                status: 'ALLOWED',
                checkIn: new Date().toISOString(),
                member: {
                    id: 999,
                    firstName: 'Bruce',
                    lastName: 'Wayne',
                    email: 'bruce@wayne.com',
                    phone: '+1 555-BATMAN',
                    imageUrl: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&q=80&w=300',
                    membershipStatus: 'ACTIVE',
                    membershipType: 'Platinum Yearly',
                    birthDate: '1990-02-19T00:00:00.000Z',
                    sex: 'Male',
                    joinDate: '2023-01-01T00:00:00.000Z',
                    expiryDate: '2025-12-31T00:00:00.000Z',
                    plan: { name: 'Platinum Yearly' }
                }
            });
            setLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/access/logs/${logId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLog(res.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load scan details');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-surface rounded-3xl border border-white/5 p-12 flex items-center justify-center h-[calc(100vh-390px)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-text-muted font-bold text-sm">Loading scan result...</p>
                </div>
            </div>
        );
    }

    if (!log && !error && !loading) {
        return (
            <div className="bg-surface rounded-3xl border border-white/5 p-12 text-center h-[calc(100vh-390px)] flex flex-col items-center justify-center">
                <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <span className="material-icons-round text-6xl text-text-muted/20">qr_code_scanner</span>
                </div>
                <h3 className="text-2xl font-black text-white/20 uppercase italic tracking-tighter">Ready to Scan</h3>
                <p className="text-text-muted/40 font-bold mt-2 uppercase tracking-widest text-sm">Waiting for entrance activity...</p>
            </div>
        );
    }

    if (error || !log) {
        return (
            <div className="bg-surface rounded-3xl border border-white/5 p-8 text-center h-[calc(100vh-390px)] flex flex-col items-center justify-center">
                <span className="material-icons-round text-6xl text-red-400 mb-4">error_outline</span>
                <h2 className="text-2xl font-bold text-white mb-2">Error Loading Scan</h2>
                <p className="text-text-muted mb-6">{error || 'Scan result not found'}</p>
                {showToolbar && (
                    <button
                        onClick={() => navigate('/access')}
                        className="bg-primary hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
                    >
                        Back to Scanner
                    </button>
                )}
            </div>
        );
    }

    const { member, status, checkIn } = log;
    const isAllowed = status === 'ALLOWED';
    const joinedDate = member?.startDate || member?.createdAt || member?.joinDate;
    const expiryDate = member?.expiryDate;
    const planName = member?.plan?.name || member?.membershipType || 'Standard';

    return (
        <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm h-[calc(100vh-390px)] flex flex-col">
            {/* Status Banner */}
            <div className={`p-5 border-b border-white/5 flex-shrink-0 ${isAllowed ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isAllowed ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        <span className="material-icons-round text-3xl text-white">
                            {isAllowed ? 'check_circle' : 'cancel'}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className={`text-2xl font-bold ${isAllowed ? 'text-emerald-400' : 'text-red-400'}`}>
                            Access {status}
                        </h2>
                        <p className="text-text-secondary text-xs font-bold uppercase tracking-widest mt-0.5">
                            {new Date(checkIn).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Member Profile - Scrollable Content */}
            {member ? (
                <>
                    <div className="flex-1 overflow-y-auto">
                        {/* Profile Header */}
                        <div className="p-5 bg-white/5 border-b border-white/5">
                            <div className="flex items-center gap-4">
                                {member.imageUrl ? (
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
                                        <img
                                            src={member.imageUrl}
                                            alt={`${member.firstName} ${member.lastName}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-surfaceHighlight border border-white/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-3xl font-bold text-primary">
                                            {member.firstName[0]}{member.lastName[0]}
                                        </span>
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-2xl font-bold text-white truncate">
                                        {member.firstName} {member.lastName}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${(member.membershipStatus || member.status) === 'ACTIVE'
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        }`}>
                                            {member.membershipStatus || member.status}
                                        </span>
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-text-secondary border border-white/10">
                                            ID: {member.id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Member Details Grid */}
                        <div className="p-5 space-y-3">
                            {/* Contact Information */}
                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <span className="material-icons-round text-primary text-lg">email</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-0.5">Email</p>
                                            <p className="text-white font-bold text-sm truncate">{member.email}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <span className="material-icons-round text-primary text-lg">phone</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-0.5">Phone</p>
                                            <p className="text-white font-bold text-sm truncate">{member.phone || 'Not provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Membership Details */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 md:col-span-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="material-icons-round text-primary text-sm">fitness_center</span>
                                        <p className="text-xs text-text-muted uppercase tracking-widest font-bold">Plan</p>
                                    </div>
                                    <p className="text-white font-bold text-sm truncate" title={planName}>
                                        {planName}
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="material-icons-round text-primary text-sm">cake</span>
                                        <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Birthday</p>
                                    </div>
                                    <p className="text-white font-bold text-sm">
                                        {member?.birthDate ? new Date(member.birthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="material-icons-round text-primary text-sm">wc</span>
                                        <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Sex</p>
                                    </div>
                                    <p className="text-white font-bold text-sm">
                                        {member?.sex || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-3 mt-4">
                                <div className="rounded-2xl p-5 border border-emerald-500/30 bg-emerald-500/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-icons-round text-emerald-400 text-base">calendar_today</span>
                                        <p className="text-sm text-emerald-300 uppercase tracking-widest font-bold">Joined</p>
                                    </div>
                                    <p className="text-white font-black text-lg">
                                        {joinedDate ? new Date(joinedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                    </p>
                                </div>
                                <div className="rounded-2xl p-5 border border-red-500/30 bg-red-500/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-icons-round text-red-400 text-base">event</span>
                                        <p className="text-sm text-red-300 uppercase tracking-widest font-bold">Expiry</p>
                                    </div>
                                    <p className="text-white font-black text-lg">
                                        {expiryDate ? new Date(expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Additional Info */}
                            {member.emergencyContact && (
                                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-2">Emergency Contact</p>
                                    <p className="text-white font-bold text-sm">{member.emergencyContact}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Fixed at bottom */}
                    {showToolbar && (
                        <div className="p-5 border-t border-white/5 bg-surface flex-shrink-0">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => navigate('/access')}
                                    className="flex-1 bg-primary hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round text-lg">qr_code_scanner</span>
                                    Scan Next
                                </button>
                                <button
                                    onClick={() => navigate(`/members/${member.id}`)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold text-sm border border-white/10 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round text-lg">person</span>
                                    View Profile
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center p-12 text-center">
                    <div>
                        <span className="material-icons-round text-6xl text-text-muted/40 mb-4">person_off</span>
                        <h3 className="text-xl font-bold text-white mb-2">Unknown Member</h3>
                        <p className="text-text-muted text-sm">This QR code is not registered in the system</p>
                    </div>
                </div>
            )}
        </div>
    );
}
