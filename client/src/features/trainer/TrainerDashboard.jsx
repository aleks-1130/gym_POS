import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'react-qr-code';
import { Link } from 'react-router-dom';
import TrainerPageHeader from './components/TrainerPageHeader';

const getInitials = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'TR';
    const parts = raw.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

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

export default function TrainerDashboard() {
    const { user } = useAuth();
    const [trainer, setTrainer] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [commissions, setCommissions] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileImageError, setProfileImageError] = useState(false);
    const [dynamicQr, setDynamicQr] = useState({
        qrValue: '',
        expiresAt: null,
        cycleStartMs: Date.now(),
        cycleEndMs: Date.now() + 1,
        loading: false
    });
    const [qrNowTick, setQrNowTick] = useState(Date.now());

    const formatMoney = (amount) =>
        `PHP ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [trainerRes, sessionsRes, classesRes, commissionsRes, notificationsRes] = await Promise.all([
                    axios.get('/api/trainer/me'),
                    axios.get('/api/trainer/me/sessions'),
                    axios.get('/api/trainer/me/classes'),
                    axios.get('/api/trainer/me/commissions'),
                    axios.get('/api/notifications')
                ]);
                setTrainer(trainerRes.data);
                setSessions(sessionsRes.data || []);
                setClasses(classesRes.data || []);
                setCommissions(commissionsRes.data || null);
                setNotifications(notificationsRes.data || []);
            } catch (e) {
                console.error('Failed to load trainer dashboard', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setQrNowTick(Date.now());
        }, 250);

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

                const res = await axios.get('/api/access/qr-token');
                const expiresAt = res.data?.expiresAt || null;
                const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
                const refreshAfterSeconds = Number(res.data?.refreshAfterSeconds);
                const refreshMs = Number.isFinite(refreshAfterSeconds) && refreshAfterSeconds > 0
                    ? refreshAfterSeconds * 1000
                    : 20000;
                const plannedCycleEndMs = nowMs + refreshMs;
                const cycleEndMs = (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs)
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
            } catch (e) {
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    const now = new Date();
    const upcomingSessions = sessions
        .filter((s) => new Date(s.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const upcomingCount = upcomingSessions.length;
    const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length;
    const commissionSummary = commissions?.summary || {};
    const loyaltyPoints = Number(trainer?.loyaltyPoints || 0);
    const checkIns = Number(trainer?.checkIns || 0);
    const latestNotification = notifications.length > 0 ? notifications[0] : null;
    const latestType = String(latestNotification?.type || 'INFO').toUpperCase();
    const latestStyle = announcementTypeStyles[latestType] || announcementTypeStyles.INFO;
    const latestCardTone = latestNotification
        ? (latestNotification?.isRead ? latestStyle.readCard : latestStyle.unreadCard)
        : 'border-white/10 bg-surface';
    const quickActions = [
        { to: '/trainer/classes-sessions', icon: 'event_note', label: 'Class & Session' },
        { to: '/trainer/gym-traffic', icon: 'timeline', label: 'Traffic' },
        { to: '/trainer/shop', icon: 'shopping_bag', label: 'Shop' },
        { to: '/trainer/profile', icon: 'person', label: 'Profile' }
    ];
    const cycleStartMs = Number(dynamicQr.cycleStartMs) || Date.now();
    const cycleEndMs = Number(dynamicQr.cycleEndMs) || (cycleStartMs + 1);
    const totalCycleMs = Math.max(1, cycleEndMs - cycleStartMs);
    const qrRemainingMs = Math.max(0, cycleEndMs - qrNowTick);
    const qrProgressPercent = dynamicQr.qrValue
        ? Math.max(0, Math.min(100, (qrRemainingMs / totalCycleMs) * 100))
        : 0;
    const isQrTimerLow = qrProgressPercent <= 30;
    const headerName = trainer?.name || user?.name || 'Trainer';
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
    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            <TrainerPageHeader
                title="Dashboard"
                subtitle={`Welcome back, ${headerName}`}
                icon="dashboard"
            />

            <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-5 rounded-2xl border border-primary/30 shadow-lg">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <span className="material-icons-round text-primary text-lg">verified</span>
                        <h3 className="text-base font-bold text-white">Digital Trainer Pass</h3>
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
                        <p className="text-xs text-text-muted">Trainer ID: <span className="text-white font-mono">{trainer?.id || 'N/A'}</span></p>
                        <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
                                <span className="text-text-muted">QR Timer</span>
                                <span className={`${isQrTimerLow ? 'text-orange-300' : 'text-orange-400'} font-semibold`}>
                                    {dynamicQr.qrValue ? 'Refreshing soon' : 'Waiting for QR'}
                                </span>
                            </div>
                            <div className="mt-1.5 h-2 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                                <div
                                    className={`h-full rounded-full transition-[width] duration-200 ease-linear bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300 ${isQrTimerLow ? 'animate-pulse' : ''}`}
                                    style={{ width: `${qrProgressPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative overflow-hidden bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                <div className="absolute -top-10 -right-8 w-28 h-28 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-white/5 shrink-0 flex items-center justify-center">
                                {trainer?.imageUrl && !profileImageError ? (
                                    <img
                                        src={trainer.imageUrl}
                                        alt={trainerDisplayName}
                                        className="w-full h-full object-cover"
                                        onError={() => setProfileImageError(true)}
                                    />
                                ) : (
                                    <span className="text-sm font-bold text-white/90">{trainerInitials}</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-text-muted text-[11px] font-medium uppercase tracking-wide mb-1">Trainer Profile</p>
                                <h3 className="text-lg font-bold text-white leading-tight truncate">{trainerDisplayName}</h3>
                                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Active
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${trainerTypeBadgeClass}`}>
                                        {trainerTypeLabel}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <Link
                            to="/trainer/profile"
                            className="shrink-0 w-10 h-10 rounded-xl border border-primary/30 bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/15 transition-colors"
                            title="Open profile"
                        >
                            <span className="material-icons-round text-lg">edit</span>
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 bg-white/5 rounded-lg border border-white/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Specialty</p>
                            <p className="text-sm font-semibold text-white truncate">{trainerSpecialty}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg border border-white/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Ratings</p>
                            <p className="text-sm font-semibold text-white">{trainerRatingLabel}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg border border-white/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Session Rate</p>
                            <p className="text-sm font-semibold text-white truncate">{trainerSessionRateLabel}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-yellow-500 text-xl">stars</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Loyalty Points</p>
                            <h3 className="text-xl font-bold text-white leading-tight mt-1">{loyaltyPoints}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-primary text-xl">how_to_reg</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Check-ins</p>
                            <h3 className="text-xl font-bold text-white leading-tight mt-1">{checkIns}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-primary text-xl">event_available</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Upcoming Sessions</p>
                            <h3 className="text-xl font-bold text-white leading-tight mt-1">{upcomingCount}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-emerald-400 text-xl">task_alt</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Completed Sessions</p>
                            <h3 className="text-xl font-bold text-white leading-tight mt-1">{completedCount}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-emerald-400 text-xl">payments</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Total Earned</p>
                            <p className="text-base font-bold text-emerald-400 leading-tight mt-1">{formatMoney(commissionSummary.totalEarned)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-amber-400 text-xl">hourglass_top</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Pending</p>
                            <p className="text-base font-bold text-amber-400 leading-tight mt-1">{formatMoney(commissionSummary.totalUnpaid)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-blue-300 text-xl">account_balance_wallet</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Paid Out</p>
                            <p className="text-base font-bold text-blue-300 leading-tight mt-1">{formatMoney(commissionSummary.totalPayoutRecorded)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-rose-300 text-xl">inventory_2</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Total Deduction</p>
                            <p className="text-base font-bold text-rose-300 leading-tight mt-1">-{formatMoney(commissionSummary.materialPendingDeduction)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Latest Update */}
            <Link to="/announcements" className="block active:scale-[0.98] transition-all">
                <div className={`rounded-xl border p-4 sm:p-5 transition-colors ${latestCardTone}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-icons-round text-base text-white/80">{latestStyle.icon}</span>
                                <h3 className="text-xs font-semibold text-white">Latest Update</h3>
                                {latestNotification && !latestNotification.isRead && (
                                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                )}
                            </div>
                            {latestNotification ? (
                                <>
                                    <p className={`text-sm sm:text-base font-bold leading-tight ${latestNotification.isRead ? 'text-white/80' : 'text-white'}`}>
                                        {latestNotification.title}
                                    </p>
                                    <p className="text-xs sm:text-sm text-text-muted mt-1.5 line-clamp-2">
                                        {latestNotification.message}
                                    </p>
                                    <p className="text-[11px] text-text-muted mt-2">
                                        {new Date(latestNotification.createdAt || latestNotification.date).toLocaleString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs sm:text-sm text-text-muted">No recent announcements right now.</p>
                            )}
                        </div>
                        <span className="material-icons-round text-text-muted">chevron_right</span>
                    </div>
                </div>
            </Link>

            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action) => (
                        <Link
                            key={action.to}
                            to={action.to}
                            className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center"
                        >
                            <span className="material-icons-round text-primary text-xl block mb-1">{action.icon}</span>
                            <span className="text-xs font-medium text-white block">{action.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
