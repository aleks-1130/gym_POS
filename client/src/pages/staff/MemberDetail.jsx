import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function MemberDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);

    // Form Data
    const [renewData, setRenewData] = useState({ duration: 30, amount: 0, method: 'CASH' });
    const [freezeData, setFreezeData] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
    });
    const [passwordData, setPasswordData] = useState('');

    // Photo Capture
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [submittingPhoto, setSubmittingPhoto] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

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

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400, facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error(err);
            alert("Camera failed");
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const captureAndUpdate = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg');

            setSubmittingPhoto(true);
            try {
                await axios.put(`http://localhost:5000/api/members/${id}`, {
                    ...member,
                    imageUrl: imageData
                });
                stopCamera();
                setShowPhotoModal(false);
                fetchMember();
            } catch (e) {
                alert("Failed to update photo");
            } finally {
                setSubmittingPhoto(false);
            }
        }
    };

    const handleStatusChange = async (newStatus, extraData = {}) => {
        try {
            await axios.post(`http://localhost:5000/api/members/${id}/status`, {
                status: newStatus,
                ...extraData
            });
            setShowFreezeModal(false);
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

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    );
    if (!member) return null;

    const initials = `${member.firstName[0]}${member.lastName[0]}`;

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Navigation & Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary to-orange-600 rounded-3xl flex items-center justify-center text-3xl font-bold text-white shadow-2xl shadow-primary/20 overflow-hidden border border-white/10">
                        {member.imageUrl ? (
                            <img src={member.imageUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                            initials
                        )}
                    </div>
                    <div>
                        <button onClick={() => navigate('/members')} className="group text-text-muted hover:text-white mb-2 text-sm flex items-center gap-1 transition-all">
                            <span className="material-icons-round text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span> Back to Members
                        </button>
                        <h1 className="text-4xl font-extrabold text-white tracking-tight">{member.firstName} {member.lastName}</h1>
                        <div className="flex items-center gap-4 mt-1">
                            <span className="text-text-secondary flex items-center gap-1.5 text-sm">
                                <span className="material-icons-round text-base text-primary/60">email</span>
                                {member.email}
                            </span>
                            <span className="text-text-muted text-xs">•</span>
                            <span className="text-text-secondary flex items-center gap-1.5 text-sm">
                                <span className="material-icons-round text-base text-primary/60">phone</span>
                                {member.phone}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button onClick={() => setShowPhotoModal(true)} className="bg-surfaceHighlight hover:bg-white/10 text-white px-4 py-2.5 rounded-2xl font-medium flex items-center gap-2 border border-white/5 transition-all">
                        <span className="material-icons-round text-[18px]">add_a_photo</span> Photo
                    </button>

                    <button onClick={() => setShowPasswordModal(true)} className="bg-surfaceHighlight hover:bg-white/10 text-white px-4 py-2.5 rounded-2xl font-medium flex items-center gap-2 border border-white/5 transition-all">
                        <span className="material-icons-round text-[18px]">lock_reset</span> Security
                    </button>

                    {member.status !== 'FREEZED' ? (
                        <button onClick={() => setShowFreezeModal(true)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-4 py-2.5 rounded-2xl font-medium flex items-center gap-2 transition-all">
                            <span className="material-icons-round text-[18px]">ac_unit</span> Freeze
                        </button>
                    ) : (
                        <button onClick={() => handleStatusChange('ACTIVE')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-2xl font-medium flex items-center gap-2 transition-all">
                            <span className="material-icons-round text-[18px]">play_arrow</span> Unfreeze
                        </button>
                    )}

                    <button onClick={() => setShowRenewModal(true)} className="bg-primary hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-2xl shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95">
                        <span className="material-icons-round text-[20px]">autorenew</span> Renew Plan
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-8">

                {/* Left Column: Stats & Plan Info */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-surface p-5 rounded-3xl border border-white/5 shadow-sm">
                            <p className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Loyalty Points</p>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                                    <span className="material-icons-round">stars</span>
                                </div>
                                <p className="text-2xl font-bold text-white">{member.points}</p>
                            </div>
                        </div>
                        <div className="bg-surface p-5 rounded-3xl border border-white/5 shadow-sm">
                            <p className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Total Visits</p>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                                    <span className="material-icons-round">how_to_reg</span>
                                </div>
                                <p className="text-2xl font-bold text-white">{member.accessLogs?.length || 0}</p>
                            </div>
                        </div>
                        <div className="bg-surface p-5 rounded-3xl border border-white/5 shadow-sm">
                            <p className="text-text-muted text-xs uppercase font-semibold tracking-wider mb-2">Total Spent</p>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                                    <span className="material-icons-round">payments</span>
                                </div>
                                <p className="text-2xl font-bold text-white">
                                    {formatPrice(member.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Plan Detail Card */}
                    <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-icons-round text-primary">membership</span>
                                Membership Details
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${member.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                member.status === 'FREEZED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                    'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                {member.status}
                            </span>
                        </div>
                        <div className="p-8 grid md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <p className="text-text-muted text-sm mb-1">Current Plan</p>
                                    <p className="text-2xl font-bold text-white">{member.plan?.name || "No Plan"}</p>
                                    <p className="text-primary font-medium mt-1">{formatPrice(member.plan?.price || 0)} / {member.plan?.duration || 0} Days</p>
                                </div>

                                {member.status === 'FREEZED' && member.freezeStartDate && (
                                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
                                        <p className="text-blue-400 text-xs font-bold uppercase mb-1 flex items-center gap-1">
                                            <span className="material-icons-round text-sm">info</span> Freeze Period
                                        </p>
                                        <p className="text-white text-sm">
                                            {new Date(member.freezeStartDate).toLocaleDateString()} — {new Date(member.freezeEndDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div>
                                        <p className="text-text-muted text-xs">Start Date</p>
                                        <p className="text-white font-medium">{new Date(member.startDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-text-muted text-xs">Expiry Date</p>
                                        <p className={`font-bold ${new Date(member.expiryDate) < new Date() ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {member.expiryDate && (
                                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                        {(() => {
                                            const total = new Date(member.expiryDate) - new Date(member.startDate);
                                            const elapsed = new Date() - new Date(member.startDate);
                                            const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
                                            return <div className={`h-full transition-all duration-1000 ${progress > 90 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>;
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Access History */}
                    <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-icons-round text-primary">history</span>
                                Recent Activity
                            </h3>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-text-muted text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Check-In Time</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(member.accessLogs || []).slice(0, 10).map(log => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-white text-sm font-medium">
                                                {new Date(log.checkIn).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${log.status === 'ALLOWED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                    }`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-text-muted text-xs italic">Front Desk Check-in</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!member.accessLogs || member.accessLogs.length === 0) && (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-12 text-center text-text-muted italic">No activity logs found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Payments & Actions */}
                <div className="space-y-8">

                    {/* Payment History Card */}
                    <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm flex flex-col h-full max-h-[800px]">
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="material-icons-round text-primary">receipt_long</span>
                                Payment History
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                            {member.payments?.map(pay => (
                                <div key={pay.id} className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/20 transition-all group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-lg font-bold text-white">{formatPrice(pay.amount)}</p>
                                            <p className="text-xs text-text-secondary font-medium uppercase tracking-tighter">{pay.type.replace('_', ' ')}</p>
                                        </div>
                                        <span className="text-[10px] font-bold bg-background/50 text-text-muted px-2 py-1 rounded-lg border border-white/5">{pay.method}</span>
                                    </div>
                                    <div className="mt-3 flex justify-between items-center border-t border-white/5 pt-3">
                                        <p className="text-[11px] text-text-muted flex items-center gap-1">
                                            <span className="material-icons-round text-xs">calendar_today</span>
                                            {new Date(pay.date).toLocaleDateString()}
                                        </p>
                                        <button className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold flex items-center gap-1">
                                            Receipt <span className="material-icons-round text-sm">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {(!member.payments || member.payments.length === 0) && (
                                <div className="p-12 text-center text-text-muted italic">No payments found.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}

            {/* Set Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                <span className="material-icons-round">security</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Reset Password</h3>
                        </div>
                        <p className="text-text-muted text-sm mb-6 leading-relaxed">Set a new password for the member to access the private portal.</p>
                        <form onSubmit={handleSetPassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">New Password</label>
                                <input required type="password"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder-white/20"
                                    placeholder="••••••••"
                                    value={passwordData} onChange={e => setPasswordData(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className="text-text-muted hover:text-white px-5 py-2.5 font-medium transition-all">Cancel</button>
                                <button type="submit" className="bg-primary hover:bg-orange-600 text-white font-bold px-8 py-2.5 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Freeze Modal */}
            {showFreezeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                                <span className="material-icons-round">ac_unit</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Freeze Account</h3>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleStatusChange('FREEZED', { freezeStartDate: freezeData.startDate, freezeEndDate: freezeData.endDate }); }} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Start Date</label>
                                <input required type="date"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    value={freezeData.startDate}
                                    onChange={e => setFreezeData({ ...freezeData, startDate: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">End Date</label>
                                <input required type="date"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    value={freezeData.endDate}
                                    onChange={e => setFreezeData({ ...freezeData, endDate: e.target.value })} />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowFreezeModal(false)} className="text-text-muted hover:text-white px-5 py-2.5 font-medium transition-all">Cancel</button>
                                <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-2.5 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">Confirm Freeze</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Renew Modal */}
            {showRenewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface p-8 rounded-[32px] w-full max-w-sm border border-white/10 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                <span className="material-icons-round">autorenew</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Renew Membership</h3>
                        </div>
                        <form onSubmit={handleRenew} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Duration (Days)</label>
                                <input required type="number"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    value={renewData.duration} onChange={e => setRenewData({ ...renewData, duration: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Amount Paid</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-text-muted">$</span>
                                    <input required type="number" step="0.01"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                        value={renewData.amount} onChange={e => setRenewData({ ...renewData, amount: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-widest">Payment Method</label>
                                <select className="w-full bg-surfaceHighlight border border-white/10 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                    value={renewData.method} onChange={e => setRenewData({ ...renewData, method: e.target.value })}>
                                    <option value="CASH" className="bg-surface">Cash</option>
                                    <option value="CARD" className="bg-surface">Card</option>
                                    <option value="TRANSFER" className="bg-surface">Transfer</option>
                                </select>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowRenewModal(false)} className="text-text-muted hover:text-white px-5 py-2.5 font-medium transition-all">Cancel</button>
                                <button type="submit" className="bg-primary hover:bg-orange-600 text-white font-bold px-8 py-2.5 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95">Confirm Renew</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Photo Update Modal */}
            {showPhotoModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-surface rounded-3xl border border-white/10 w-full max-w-sm shadow-2xl overflow-hidden p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Update Member Photo</h3>
                            <button onClick={() => { stopCamera(); setShowPhotoModal(false); }} className="text-text-muted hover:text-white">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 relative mb-6">
                            {isCameraOpen ? (
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-3">
                                    <span className="material-icons-round text-5xl">photo_camera</span>
                                    <button onClick={startCamera} className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold border border-primary/20">
                                        Open Camera
                                    </button>
                                </div>
                            )}
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { stopCamera(); setShowPhotoModal(false); }}
                                className="flex-1 py-3 text-text-muted hover:text-white font-bold"
                            >
                                Cancel
                            </button>
                            {isCameraOpen && (
                                <button
                                    onClick={captureAndUpdate}
                                    disabled={submittingPhoto}
                                    className="flex-1 bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    {submittingPhoto ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span className="material-icons-round text-lg">camera</span>
                                            Capture
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
