import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';
import { Link } from 'react-router-dom';
import MemberPageHeader from './components/MemberPageHeader';
import { withApiBase } from '../../config/api';
import { formatPlanDate, calculatePlanProgress, calculateDaysRemaining } from '../../utils/memberUtils';

const UPCOMING_SESSION_STATUSES = ['SCHEDULED', 'RESCHEDULED'];
const UPCOMING_CLASS_STATUSES = ['CONFIRMED'];

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

const MemberDashboard = ({ stats, user }) => {
    const member = stats?.memberData || {};
    const headerName = (
        user?.name
        || [member?.firstName, member?.lastName].filter(Boolean).join(' ')
        || 'Member'
    )
        .trim()
        .split(' ')[0] || 'Member';

    const now = new Date();
    const activePeriod = (member.membershipPeriods || [])
        .filter((period) => new Date(period.endDate) >= now)
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];

    const planName =
        stats?.currentPlanName ||
        activePeriod?.plan?.name ||
        member.plan?.name ||
        'No Active Plan';

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

    const memberId = member.id || user?.id;
    const loyaltyPoints = stats?.loyaltyPoints ?? member.points ?? 0;
    const checkIns = stats?.checkIns ?? (member.accessLogs?.filter((log) => log.status !== 'DENIED').length || 0);
    const planDaysLeft = daysRemaining === null ? 0 : Math.max(0, daysRemaining);

    const [dynamicQr, setDynamicQr] = useState(() => {
        const nowMs = Date.now();
        return {
            qrValue: '',
            cycleStartMs: nowMs,
            cycleEndMs: nowMs + 1,
            loading: false
        };
    });
    const [qrNowTick, setQrNowTick] = useState(() => Date.now());
    const [latestNotification, setLatestNotification] = useState(null);
    const [upcomingCounts, setUpcomingCounts] = useState({
        sessions: 0,
        classes: 0
    });

    const latestType = String(latestNotification?.type || 'INFO').toUpperCase();
    const latestStyle = announcementTypeStyles[latestType] || announcementTypeStyles.INFO;
    const latestCardTone = latestNotification
        ? (latestNotification?.isRead ? latestStyle.readCard : latestStyle.unreadCard)
        : 'border-white/10 bg-surface';

    useEffect(() => {
        const fetchLatestNotification = async () => {
            try {
                const res = await axios.get(withApiBase('/api/notifications'));
                if (res.data && res.data.length > 0) {
                    setLatestNotification(res.data[0]);
                }
            } catch {
                setLatestNotification(null);
            }
        };

        fetchLatestNotification();
    }, []);

    useEffect(() => {
        let active = true;

        const fetchUpcomingCounts = async () => {
            try {
                const [sessionsResult, classesResult] = await Promise.allSettled([
                    axios.get(withApiBase('/api/members/me/training-sessions')),
                    axios.get(withApiBase('/api/members/me/class-bookings'))
                ]);

                if (!active) return;

                const nowDate = new Date();
                const sessions = sessionsResult.status === 'fulfilled' && Array.isArray(sessionsResult.value?.data)
                    ? sessionsResult.value.data
                    : [];
                const classes = classesResult.status === 'fulfilled' && Array.isArray(classesResult.value?.data)
                    ? classesResult.value.data
                    : [];

                const upcomingSessionCount = sessions.filter((session) => {
                    const sessionDate = new Date(session?.date);
                    if (Number.isNaN(sessionDate.getTime())) return false;
                    const sessionStatus = String(session?.status || '').toUpperCase();
                    return UPCOMING_SESSION_STATUSES.includes(sessionStatus) && sessionDate >= nowDate;
                }).length;

                const upcomingClassCount = classes.filter((booking) => {
                    const classDate = new Date(booking?.sessionDate || booking?.class?.oneTimeDate);
                    if (Number.isNaN(classDate.getTime())) return false;
                    const bookingStatus = String(booking?.status || '').toUpperCase();
                    return UPCOMING_CLASS_STATUSES.includes(bookingStatus) && classDate >= nowDate;
                }).length;

                setUpcomingCounts({
                    sessions: upcomingSessionCount,
                    classes: upcomingClassCount
                });
            } catch {
                if (!active) return;
                setUpcomingCounts({ sessions: 0, classes: 0 });
            }
        };

        fetchUpcomingCounts();
        return () => {
            active = false;
        };
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

                const res = await axios.get(withApiBase('/api/access/qr-token'));
                const refreshAfterSeconds = Number(res.data?.refreshAfterSeconds);
                const refreshMs = Number.isFinite(refreshAfterSeconds) && refreshAfterSeconds > 0
                    ? refreshAfterSeconds * 1000
                    : 20000;

                if (!active) return;
                setDynamicQr({
                    qrValue: res.data?.qrValue || '',
                    cycleStartMs: nowMs,
                    cycleEndMs: nowMs + refreshMs,
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

    const cycleStartMs = Number(dynamicQr.cycleStartMs) || qrNowTick;
    const cycleEndMs = Number(dynamicQr.cycleEndMs) || (cycleStartMs + 1);
    const totalCycleMs = Math.max(1, cycleEndMs - cycleStartMs);
    const qrRemainingMs = Math.max(0, cycleEndMs - qrNowTick);
    const qrProgressPercent = dynamicQr.qrValue
        ? Math.max(0, Math.min(100, (qrRemainingMs / totalCycleMs) * 100))
        : 0;
    const isQrTimerLow = qrProgressPercent <= 30;

    const promoTitle = latestNotification?.title || 'Stay tuned for new promotions';

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6">
            <MemberPageHeader
                title="Welcome Home"
                subtitle={`Good to see you, ${headerName}!`}
                icon="dashboard"
            />

            {/* 1) Member Pass */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl max-w-[340px] sm:max-w-md mx-auto w-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none" />

                <div className="relative flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="material-icons-round text-primary text-sm">qr_code_2</span>
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Member Pass</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-white/40 block mb-0.5">Member ID</span>
                            <span className="text-xs font-mono text-white/80">{memberId || 'N/A'}</span>
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

            {/* 2) Stats */}
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
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Plan left</p>
                    <p className="text-xl font-black text-white mt-1">{planDaysLeft}<span className="text-xs ml-1 text-primary">d</span></p>
                </div>
            </div>

            {/* 3) Membership */}
            <div className={`relative overflow-hidden backdrop-blur-md p-6 rounded-[2rem] border transition-all duration-300 ${isExpired ? 'border-red-500/30 bg-gradient-to-br from-red-500/10 via-surface to-surface' : 'border-white/5 bg-surface'} shadow-xl`}>
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">My Membership</h3>
                        <p className="text-xs text-white/50 mt-1 font-semibold">{planName} • {remainingLabel}</p>
                    </div>
                    <span className={`text-sm font-black ${isExpired ? 'text-red-400' : 'text-primary'}`}>{progressPercent}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${isExpired ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-primary via-orange-400 to-emerald-400'}`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-3">
                    <div>
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">Start</p>
                        <p className="text-xs text-white/70 font-bold">{planStartLabel}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">Expiry</p>
                        <p className="text-xs text-white/70 font-bold">{planEndLabel}</p>
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
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Training</p>
                        <p className="text-lg font-black text-white">{upcomingCounts.sessions} <span className="text-xs font-bold text-white/40">ahead</span></p>
                    </div>
                </div>
                <div className="bg-[#1e293b]/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                        <span className="material-icons-round text-2xl">groups</span>
                    </div>
                    <div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Classes</p>
                        <p className="text-lg font-black text-white">{upcomingCounts.classes} <span className="text-xs font-bold text-white/40">ahead</span></p>
                    </div>
                </div>
            </div>

            {/* 5) Gym Update */}
            <Link to="/announcements" className="block group">
                <div className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300 ${latestCardTone} shadow-xl backdrop-blur-sm`}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                    <span className="material-icons-round text-sm text-white/70">{latestStyle.icon}</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Gym Update</span>
                            </div>
                            <h4 className={`text-lg font-black tracking-tight leading-tight ${latestNotification?.isRead ? 'text-white/70' : 'text-white'}`}>
                                {promoTitle}
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

            {/* 6) Toolbox */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">My Toolbox</h3>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                        { label: 'Classes', icon: 'calendar_today', path: '/schedule', color: 'text-primary' },
                        { label: 'Shop', icon: 'shopping_bag', path: '/shop', color: 'text-primary' },
                        { label: 'Rewards', icon: 'loyalty', path: '/loyalty', color: 'text-primary' },
                        { label: 'Trainers', icon: 'fitness_center', path: '/trainer-booking', color: 'text-primary' },
                        { label: 'Check-ins', icon: 'history', path: '/attendance', color: 'text-primary' },
                        { label: 'Wallets', icon: 'payments', path: '/purchase-history', color: 'text-primary' }
                    ].map((action) => (
                        <Link
                            key={action.path}
                            to={action.path}
                            className="group relative bg-[#1e293b]/30 hover:bg-white/5 p-4 rounded-2xl border border-white/5 transition-all duration-300 active:scale-95 text-center overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className={`material-icons-round text-2xl block mb-2 ${action.color} group-hover:scale-110 transition-transform`}>{action.icon}</span>
                            <span className="text-[10px] font-bold text-white/80 group-hover:text-white block uppercase tracking-wider">{action.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MemberDashboard;
