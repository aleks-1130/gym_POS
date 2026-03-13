import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';
import { Link } from 'react-router-dom';

const formatPlanDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString();
};

const calculatePlanProgress = (startDate, endDate, now = new Date()) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

const calculateDaysRemaining = (endDate, now = new Date()) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return null;
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};

const MemberDashboard = ({ stats, user }) => {
    const member = stats?.memberData || {};
    const now = new Date();
    const activePeriod = (member.membershipPeriods || [])
        .filter((period) => new Date(period.endDate) >= now)
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];
    const planName =
        stats?.currentPlanName ||
        activePeriod?.plan?.name ||
        member.plan?.name ||
        "No Active Plan";
    const planStartDate = activePeriod?.startDate || member.startDate || null;
    const planEndDate = activePeriod?.endDate || member.expiryDate || null;
    const isExpired = planEndDate ? new Date(planEndDate) < now : false;
    const progressPercent = Math.round(calculatePlanProgress(planStartDate, planEndDate, now));
    const daysRemaining = calculateDaysRemaining(planEndDate, now);
    const planStartLabel = formatPlanDate(planStartDate);
    const planEndLabel = formatPlanDate(planEndDate);
    const remainingLabel = daysRemaining === null
        ? 'No end date'
        : daysRemaining < 0
            ? `${Math.abs(daysRemaining)} days overdue`
            : `${daysRemaining} days remaining`;
    const hasPlanDates = Boolean(planStartDate && planEndDate);
    const progressBarTone = isExpired
        ? 'bg-gradient-to-r from-red-500 to-red-400'
        : 'bg-gradient-to-r from-primary via-orange-400 to-emerald-400';
    const progressTextTone = isExpired ? 'text-red-400' : 'text-primary';
    const membershipCardTone = isExpired
        ? 'border-red-500/30 bg-gradient-to-br from-red-500/10 via-surface to-surface'
        : 'border-white/5 bg-surface';
    const membershipGlowTone = isExpired ? 'bg-red-500/20' : 'bg-primary/10';
    const iconTone = isExpired
        ? 'bg-gradient-to-br from-red-500/30 to-red-500/5 border-red-500/30'
        : 'bg-gradient-to-br from-primary/25 to-primary/5 border-primary/20';
    const progressPanelTone = isExpired
        ? 'border-red-500/25 bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent'
        : 'border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent';
    const memberId = member.id || user?.id;
    const [dynamicQr, setDynamicQr] = useState({ qrValue: '', expiresAt: null, loading: false });
    const [latestNotification, setLatestNotification] = useState(null);
    const loyaltyPoints = stats?.loyaltyPoints ?? member.points ?? 0;
    const checkIns = stats?.checkIns ?? (member.accessLogs?.filter((log) => log.status !== 'DENIED').length || 0);

    useEffect(() => {
        const fetchLatestNotification = async () => {
            try {
                const res = await axios.get('/api/notifications');
                if (res.data && res.data.length > 0) {
                    setLatestNotification(res.data[0]); // Most recent first from backend usually
                }
            } catch (error) {
                console.error("Failed to fetch latest notification");
            }
        };

        fetchLatestNotification();
    }, []);

    useEffect(() => {
        const fetchDynamicQr = async () => {
            try {
                setDynamicQr((prev) => ({ ...prev, loading: true }));
                
                const res = await axios.get('/api/access/qr-token');
                setDynamicQr({
                    qrValue: res.data?.qrValue || '',
                    expiresAt: res.data?.expiresAt || null,
                    loading: false
                });
            } catch (e) {
                setDynamicQr((prev) => ({ ...prev, loading: false }));
            }
        };

        fetchDynamicQr();
        const interval = setInterval(fetchDynamicQr, 20000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-4 pb-20 px-4 max-w-2xl mx-auto">
          

            {/* Digital Member Pass - Priority Position */}
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-5 rounded-2xl border border-primary/30 shadow-lg">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <span className="material-icons-round text-primary text-lg">verified</span>
                        <h3 className="text-base font-bold text-white">Digital Member Pass</h3>
                    </div>
                    <div className="bg-white p-4 rounded-xl inline-block shadow-md mb-3">
                        {dynamicQr.qrValue ? (
                            <QRCode value={dynamicQr.qrValue} size={192} />
                        ) : (
                            <div className="w-48 h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm text-gray-600 rounded-lg font-medium">
                                {dynamicQr.loading ? 'Refreshing QR...' : 'QR Code Unavailable'}
                            </div>
                        )}
                    </div>
                    <p className="text-text-muted text-xs">Scan at front desk to check in (auto-refreshing secure QR)</p>
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-text-muted">Member ID: <span className="text-white font-mono">{memberId || 'N/A'}</span></p>
                        {dynamicQr.expiresAt && (
                            <p className="text-xs text-text-muted mt-1">
                                Expires: <span className="text-white">{new Date(dynamicQr.expiresAt).toLocaleTimeString()}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Membership Status - Prominent Card */}
            <div className={`relative overflow-hidden p-4 rounded-xl border shadow-sm ${membershipCardTone}`}>
                <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none ${membershipGlowTone}`} />
                <div className="relative">
                    {isExpired && (
                        <div className="mb-3 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10">
                            <div className="flex items-center gap-2">
                                <span className="material-icons-round text-red-400 text-base">warning_amber</span>
                                <p className="text-xs font-semibold text-red-300">Membership expired. Renew to restore active access.</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-text-muted text-xs font-medium mb-1">Current Plan</p>
                            <h3 className="text-lg font-bold text-white mb-2 truncate">{planName}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isExpired ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                                    {isExpired ? 'Expired' : 'Active'}
                                </span>
                                <span className="text-xs text-text-muted font-medium">{remainingLabel}</span>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${iconTone}`}>
                                <span className={`material-icons-round text-xl ${isExpired ? 'text-red-400' : 'text-primary'}`}>workspace_premium</span>
                            </div>
                        </div>
                    </div>

                    <div className={`mt-3 p-3 rounded-xl border ${progressPanelTone}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Plan Progress</span>
                            <span className={`text-xs font-bold ${progressTextTone}`}>{progressPercent}%</span>
                        </div>
                        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${progressBarTone}`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[11px]">
                            <span className="text-text-muted">Started {planStartLabel}</span>
                            <span className="text-white/80 font-medium">Ends {planEndLabel}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="bg-white/5 rounded-lg px-2.5 py-2 border border-white/5">
                            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Timeline</p>
                            <p className="text-xs font-semibold text-white">{hasPlanDates ? `${planStartLabel} - ${planEndLabel}` : 'Dates unavailable'}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg px-2.5 py-2 border border-white/5">
                            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">{daysRemaining !== null && daysRemaining < 0 ? 'Overdue' : 'Time Left'}</p>
                            <p className={`text-xs font-semibold ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>{remainingLabel}</p>
                        </div>
                    </div>
                </div>
                {isExpired && (
                    <button className="mt-3 w-full py-2.5 bg-gradient-to-r from-red-500/20 to-red-500/10 text-red-300 border border-red-500/30 rounded-lg text-sm font-bold hover:from-red-500/30 hover:to-red-500/20 transition-colors">
                        Renew Membership Now
                    </button>
                )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Loyalty Points */}
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-yellow-500 text-2xl mb-2">stars</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Loyalty Points</p>
                        <h3 className="text-2xl font-bold text-white">{loyaltyPoints}</h3>
                    </div>
                </div>

                {/* Check-ins or another stat */}
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-primary text-2xl mb-2">how_to_reg</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Check-ins</p>
                        <h3 className="text-2xl font-bold text-white">{checkIns}</h3>
                    </div>
                </div>
            </div>

            {/* Latest Update/Notification */}
            <Link to="/announcements" className="block outline-none active:scale-[0.98] transition-all">
                <div className="bg-surface p-5 rounded-[2rem] border border-white/5 shadow-xl shadow-black/20 group relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic flex items-center gap-2">
                            <span className="material-icons-round text-primary text-base animate-pulse">notifications_active</span>
                            Latest Update
                        </h3>
                        {latestNotification && !latestNotification.isRead && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/30">New</span>
                        )}
                    </div>
                    {latestNotification ? (
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-primary/30 transition-colors">
                                <span className="material-icons-round text-primary text-xl">
                                    {latestNotification.isAnnouncement ? 'campaign' : 'info'}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-black text-white uppercase italic tracking-tighter text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                                    {latestNotification.title}
                                </h4>
                                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2 font-medium">
                                    {latestNotification.message}
                                </p>
                                <p className="text-[9px] text-text-muted mt-2 font-mono uppercase tracking-widest font-black">
                                    {new Date(latestNotification.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-[10px] text-text-muted font-black uppercase tracking-widest italic">All caught up!</p>
                        </div>
                    )}
                    
                    {/* Subtle arrow indicator */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        <span className="material-icons-round text-primary">chevron_right</span>
                    </div>
                </div>
            </Link>

            {/* Quick Actions - Compact Grid */}
            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-2">
                    <a href="/schedule" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">calendar_today</span>
                        <span className="text-xs font-medium text-white block">Schedule</span>
                    </a>
                    <a href="/shop" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">shopping_bag</span>
                        <span className="text-xs font-medium text-white block">Shop</span>
                    </a>
                    <a href="/loyalty" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">loyalty</span>
                        <span className="text-xs font-medium text-white block">Rewards</span>
                    </a>
                    <a href="/profile" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">person</span>
                        <span className="text-xs font-medium text-white block">Profile</span>
                    </a>
                    <a href="/attendance" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">check_circle</span>
                        <span className="text-xs font-medium text-white block">Attendance</span>
                    </a>
                    <a href="/purchase-history" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">history</span>
                        <span className="text-xs font-medium text-white block">History</span>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default MemberDashboard;
