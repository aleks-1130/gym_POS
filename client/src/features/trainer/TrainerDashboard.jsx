import React, { useEffect, useState } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { withApiBase } from '../../config/api';
import TrainerPageHeader from './components/TrainerPageHeader';

const announcementTypeStyles = {
    INFO: {
        icon: 'info',
        unreadCard: 'border-blue-500/35 bg-blue-500/10',
        readCard: 'border-blue-500/20 bg-blue-500/5'
    },
    ALERT: {
        icon: 'warning',
        unreadCard: 'border-red-500/35 bg-red-500/10',
        readCard: 'border-red-500/20 bg-red-500/5'
    },
    PROMO: {
        icon: 'local_offer',
        unreadCard: 'border-emerald-500/35 bg-emerald-500/10',
        readCard: 'border-emerald-500/20 bg-emerald-500/5'
    }
};

const getInitials = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'TR';
    const parts = raw.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

const formatMoney = (amount) =>
    `PHP ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toUpcomingDate = (entry) => {
    const value = entry?.date || entry?.sessionDate || entry?.startAt || null;
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function TrainerDashboard() {
    const { user } = useAuth();
    const [trainer, setTrainer] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [commissions, setCommissions] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileImageError, setProfileImageError] = useState(false);
    const [dynamicQr, setDynamicQr] = useState(() => {
        const nowMs = Date.now();
        return {
            qrValue: '',
            expiresAt: null,
            cycleStartMs: nowMs,
            cycleEndMs: nowMs + 1,
            loading: false
        };
    });
    const [qrNowTick, setQrNowTick] = useState(() => Date.now());

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const [trainerRes, sessionsRes, classesRes, commissionsRes, notificationsRes] = await Promise.all([
                    axios.get(withApiBase('/api/trainer/me')),
                    axios.get(withApiBase('/api/trainer/me/sessions')),
                    axios.get(withApiBase('/api/trainer/me/classes')),
                    axios.get(withApiBase('/api/trainer/me/commissions')),
                    axios.get(withApiBase('/api/notifications'))
                ]);

                setTrainer(trainerRes.data || null);
                setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
                setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
                setCommissions(commissionsRes.data || null);
                setNotifications(Array.isArray(notificationsRes.data) ? notificationsRes.data : []);
            } catch (error) {
                console.error('Failed to load trainer dashboard', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setQrNowTick(Date.now()), 250);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let active = true;
        let refreshTimer = null;

        const scheduleNext = (delayMs) => {
            if (!active) return;
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(fetchDynamicQr, Math.max(1000, Number(delayMs) || 20000));
        };

        const fetchDynamicQr = async () => {
            const nowMs = Date.now();

            try {
                if (active) setDynamicQr((prev) => ({ ...prev, loading: true }));

                const res = await axios.get(withApiBase('/api/access/qr-token'));
                const expiresAt = res.data?.expiresAt || null;
                const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
                const refreshAfterSeconds = Number(res.data?.refreshAfterSeconds);
                const refreshMs = Number.isFinite(refreshAfterSeconds) && refreshAfterSeconds > 0
                    ? refreshAfterSeconds * 1000
                    : 20000;
                const plannedCycleEndMs = nowMs + refreshMs;
                const cycleEndMs = Number.isFinite(expiresAtMs) && expiresAtMs > nowMs
                    ? Math.min(plannedCycleEndMs, expiresAtMs)
                    : plannedCycleEndMs;

                if (!active) return;
                setDynamicQr({
                    qrValue: res.data?.qrValue || '',
                    expiresAt,
                    cycleStartMs: nowMs,
                    cycleEndMs: Math.max(cycleEndMs, nowMs + 1),
                    loading: false
                });
                scheduleNext(refreshMs);
            } catch {
                if (active) {
                    setDynamicQr((prev) => ({
                        ...prev,
                        loading: false,
                        cycleStartMs: nowMs,
                        cycleEndMs: nowMs + 10000
                    }));
                }
                scheduleNext(10000);
            }
        };

        fetchDynamicQr();
        return () => {
            active = false;
            if (refreshTimer) clearTimeout(refreshTimer);
        };
    }, []);

    useEffect(() => {
        setProfileImageError(false);
    }, [trainer?.imageUrl]);

    const now = new Date();
    const upcomingSessions = sessions
        .filter((entry) => {
            const date = toUpcomingDate(entry);
            if (!date || date < now) return false;
            const status = String(entry?.status || '').toUpperCase();
            return !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(status);
        })
        .sort((a, b) => toUpcomingDate(a) - toUpcomingDate(b));

    const upcomingClasses = classes
        .filter((entry) => {
            const date = toUpcomingDate(entry);
            if (!date || date < now) return false;
            const status = String(entry?.status || '').toUpperCase();
            return !['CANCELLED', 'COMPLETED'].includes(status);
        })
        .sort((a, b) => toUpcomingDate(a) - toUpcomingDate(b));

    const upcomingSessionCount = upcomingSessions.length;
    const upcomingClassCount = upcomingClasses.length;
    const upcomingTotal = upcomingSessionCount + upcomingClassCount;
    const completedCount = sessions.filter((entry) => String(entry?.status || '').toUpperCase() === 'COMPLETED').length;

    const nextBookingDate = [
        ...upcomingSessions.map((entry) => toUpcomingDate(entry)),
        ...upcomingClasses.map((entry) => toUpcomingDate(entry))
    ]
        .filter(Boolean)
        .sort((a, b) => a - b)[0] || null;

    const nextBookingLabel = nextBookingDate
        ? nextBookingDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'No upcoming sessions';

    const commissionSummary = commissions?.summary || {};
    const loyaltyPoints = Number(trainer?.loyaltyPoints || 0);
    const checkIns = Number(trainer?.checkIns || 0);
    const latestNotification = notifications[0] || null;
    const latestType = String(latestNotification?.type || 'INFO').toUpperCase();
    const latestStyle = announcementTypeStyles[latestType] || announcementTypeStyles.INFO;
    const latestCardTone = latestNotification
        ? (latestNotification?.isRead ? latestStyle.readCard : latestStyle.unreadCard)
        : 'border-white/10 bg-surface';

    const cycleStartMs = Number(dynamicQr.cycleStartMs) || qrNowTick;
    const cycleEndMs = Number(dynamicQr.cycleEndMs) || (cycleStartMs + 1);
    const totalCycleMs = Math.max(1, cycleEndMs - cycleStartMs);
    const qrRemainingMs = Math.max(0, cycleEndMs - qrNowTick);
    const qrProgressPercent = dynamicQr.qrValue
        ? Math.max(0, Math.min(100, (qrRemainingMs / totalCycleMs) * 100))
        : 0;
    const isQrTimerLow = qrProgressPercent <= 30;

    const trainerDisplayName = trainer?.name || user?.name || 'Trainer';
    const trainerInitials = getInitials(trainerDisplayName);
    const trainerSpecialty = trainer?.specialty || trainer?.specialization || 'Personal Training';
    const trainerRating = Number(trainer?.rating || 0);
    const trainerRatingLabel = Number.isFinite(trainerRating) ? trainerRating.toFixed(1) : '0.0';
    const trainerSessionRate = Number(trainer?.sessionPrice || 0);
    const trainerSessionRateLabel = trainerSessionRate > 0 ? formatMoney(trainerSessionRate) : 'Not set';
    const trainerType = String(trainer?.type || 'FULLTIME').toUpperCase();
    const trainerTypeLabel = trainerType === 'FREELANCER' ? 'Freelancer' : 'Full-time';
    const trainerTypeBadgeClass = trainerType === 'FREELANCER'
        ? 'bg-orange-500/15 text-orange-200 border-orange-500/35'
        : 'bg-blue-500/15 text-blue-200 border-blue-500/35';

    const quickTools = [
        { to: '/trainer/classes-sessions', icon: 'calendar_month', label: 'Classes' },
        { to: '/trainer/gym-traffic', icon: 'timeline', label: 'Traffic' },
        { to: '/trainer/commission-history', icon: 'payments', label: 'Commissions' },
        { to: '/trainer/loyalty', icon: 'card_giftcard', label: 'Rewards' },
        { to: '/trainer/shop', icon: 'storefront', label: 'Shop' },
        { to: '/trainer/profile', icon: 'person', label: 'Profile' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-text-muted text-sm">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6">
            <TrainerPageHeader
                title="Trainer Hub"
                subtitle={`Good day, ${trainerDisplayName.split(' ')[0] || 'Trainer'}!`}
                icon="dashboard"
            />

            {/* 1) Trainer Pass */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl max-w-[340px] sm:max-w-md mx-auto w-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none" />
                <div className="relative flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="material-icons-round text-primary text-sm">badge</span>
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Trainer Pass</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-white/40 block mb-0.5">Trainer ID</span>
                            <span className="text-xs font-mono text-white/80">{trainer?.id || 'N/A'}</span>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl">
                        {dynamicQr.qrValue ? (
                            <div className="p-1 bg-white rounded-xl w-[150px] sm:w-[180px] aspect-square flex items-center justify-center">
                                <QRCode
                                    value={dynamicQr.qrValue}
                                    size={256}
                                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                />
                            </div>
                        ) : (
                            <div className="w-[150px] sm:w-[180px] h-[150px] sm:h-[180px] flex items-center justify-center text-sm text-gray-400 font-medium">
                                {dynamicQr.loading ? 'Preparing pass...' : 'Pass unavailable'}
                            </div>
                        )}
                    </div>

                    <div className="mt-5 w-full max-w-xs">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                            <span>Sync status</span>
                            <span className={isQrTimerLow ? 'text-orange-400' : 'text-primary'}>
                                {dynamicQr.qrValue ? (isQrTimerLow ? 'Expiring soon' : 'Active') : 'Ready'}
                            </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden border border-white/5 p-[1px]">
                            <div
                                className={`h-full rounded-full transition-[width] duration-300 ease-linear bg-gradient-to-r from-primary to-orange-400 ${isQrTimerLow ? 'animate-pulse' : ''}`}
                                style={{ width: `${qrProgressPercent}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2) Snapshot */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Rewards</p>
                    <p className="text-xl font-black text-white mt-1">{loyaltyPoints}<span className="text-xs ml-1 text-primary">pts</span></p>
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Check-ins</p>
                    <p className="text-xl font-black text-white mt-1">{checkIns}<span className="text-xs ml-1 text-primary">visits</span></p>
                </div>
                <div className="bg-surface border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Upcoming</p>
                    <p className="text-xl font-black text-white mt-1">{upcomingTotal}<span className="text-xs ml-1 text-primary">ahead</span></p>
                </div>
            </div>

            {/* 3) My Coaching */}
            <div className="relative overflow-hidden bg-surface p-6 rounded-[2rem] border border-white/5 shadow-xl">
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="min-w-0">
                        <h3 className="text-xl font-black text-white tracking-tight">My Coaching</h3>
                        <p className="text-xs text-white/50 mt-1 font-semibold">Next up: {nextBookingLabel}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${trainerTypeBadgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${trainerType === 'FREELANCER' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                        {trainerTypeLabel}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-primary/20 bg-[#0f172a] flex items-center justify-center shrink-0">
                            {trainer?.imageUrl && !profileImageError ? (
                                <img
                                    src={trainer.imageUrl}
                                    alt={trainerDisplayName}
                                    className="w-full h-full object-cover"
                                    onError={() => setProfileImageError(true)}
                                />
                            ) : (
                                <span className="text-lg font-black text-primary">{trainerInitials}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-lg font-black text-white leading-tight truncate">{trainerDisplayName}</p>
                            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mt-1 truncate">{trainerSpecialty}</p>
                        </div>
                    </div>
                    <Link
                        to="/trainer/profile"
                        className="shrink-0 w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white/60 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                        aria-label="Open trainer profile"
                    >
                        <span className="material-icons-round text-lg">settings</span>
                    </Link>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Rating</p>
                        <p className="text-lg font-black text-white mt-1">{trainerRatingLabel}<span className="text-xs ml-1 text-primary">/5</span></p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Session Rate</p>
                        <p className="text-sm font-black text-white mt-1 truncate">{trainerSessionRateLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Completed</p>
                        <p className="text-lg font-black text-white mt-1">{completedCount}<span className="text-xs ml-1 text-primary">done</span></p>
                    </div>
                </div>
            </div>

            {/* 4) Upcoming */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1e293b]/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                        <span className="material-icons-round text-2xl">event_available</span>
                    </div>
                    <div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Sessions</p>
                        <p className="text-lg font-black text-white">{upcomingSessionCount} <span className="text-xs font-bold text-white/40">ahead</span></p>
                    </div>
                </div>
                <div className="bg-[#1e293b]/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                        <span className="material-icons-round text-2xl">groups</span>
                    </div>
                    <div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Classes</p>
                        <p className="text-lg font-black text-white">{upcomingClassCount} <span className="text-xs font-bold text-white/40">ahead</span></p>
                    </div>
                </div>
            </div>

            {/* 5) Earnings */}
            <div className="bg-surface border border-white/5 rounded-[2rem] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base sm:text-lg font-black text-white">Earnings Snapshot</h3>
                        <p className="text-xs text-text-muted">Commission breakdown this cycle</p>
                    </div>
                    <Link to="/trainer/commission-history" className="text-xs font-bold text-primary hover:text-primary/80">
                        View history
                    </Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">Total Earned</p>
                        <p className="text-sm sm:text-base font-black text-emerald-300 mt-1">{formatMoney(commissionSummary.totalEarned)}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Unpaid</p>
                        <p className="text-sm sm:text-base font-black text-amber-300 mt-1">{formatMoney(commissionSummary.totalUnpaid)}</p>
                    </div>
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300/80">Paid Out</p>
                        <p className="text-sm sm:text-base font-black text-blue-300 mt-1">{formatMoney(commissionSummary.totalPayoutRecorded)}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">Deductions</p>
                        <p className="text-sm sm:text-base font-black text-rose-300 mt-1">-{formatMoney(commissionSummary.materialPendingDeduction)}</p>
                    </div>
                </div>
            </div>

            {/* 6) Gym Update */}
            <Link to="/announcements" className="block group">
                <div className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300 ${latestCardTone} shadow-xl backdrop-blur-sm`}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                    <span className="material-icons-round text-sm text-white/70">{latestStyle.icon}</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Gym Update</span>
                                {latestNotification && !latestNotification.isRead && (
                                    <span className="px-2 py-0.5 rounded-full bg-primary text-[9px] font-black text-background uppercase tracking-wider">New</span>
                                )}
                            </div>
                            <h4 className={`text-lg font-black tracking-tight leading-tight ${latestNotification?.isRead ? 'text-white/70' : 'text-white'}`}>
                                {latestNotification?.title || 'Stay tuned for trainer announcements'}
                            </h4>
                            {latestNotification?.message && (
                                <p className="text-xs text-white/40 mt-1 font-medium line-clamp-1">{latestNotification.message}</p>
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-white/30 group-hover:text-white group-hover:bg-white/10 transition-all">
                            <span className="material-icons-round">chevron_right</span>
                        </div>
                    </div>
                </div>
            </Link>

            {/* 7) Toolbox */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">Trainer Toolbox</h3>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {quickTools.map((tool) => (
                        <Link
                            key={tool.to}
                            to={tool.to}
                            className="group relative bg-[#1e293b]/30 hover:bg-white/5 p-4 rounded-2xl border border-white/5 transition-all duration-300 active:scale-95 text-center overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="material-icons-round text-2xl block mb-2 text-primary group-hover:scale-110 transition-transform">{tool.icon}</span>
                            <span className="text-[10px] font-bold text-white/80 group-hover:text-white block uppercase tracking-wider">{tool.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
