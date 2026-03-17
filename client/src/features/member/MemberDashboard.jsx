import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';
import { Link } from 'react-router-dom';
import MemberPageHeader from './components/MemberPageHeader';

const UPCOMING_SESSION_STATUSES = ['SCHEDULED', 'RESCHEDULED'];
const UPCOMING_CLASS_STATUSES = ['CONFIRMED'];

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
    const [dynamicQr, setDynamicQr] = useState({
        qrValue: '',
        expiresAt: null,
        cycleStartMs: Date.now(),
        cycleEndMs: Date.now() + 1,
        loading: false
    });
    const [qrNowTick, setQrNowTick] = useState(Date.now());
    const [latestNotification, setLatestNotification] = useState(null);
    const [upcomingCounts, setUpcomingCounts] = useState({
        sessions: 0,
        classes: 0
    });
    const loyaltyPoints = stats?.loyaltyPoints ?? member.points ?? 0;
    const checkIns = stats?.checkIns ?? (member.accessLogs?.filter((log) => log.status !== 'DENIED').length || 0);
    const latestType = String(latestNotification?.type || 'INFO').toUpperCase();
    const latestStyle = announcementTypeStyles[latestType] || announcementTypeStyles.INFO;
    const latestCardTone = latestNotification
        ? (latestNotification?.isRead ? latestStyle.readCard : latestStyle.unreadCard)
        : 'border-white/10 bg-surface';

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
        let active = true;

        const fetchUpcomingCounts = async () => {
            try {
                const [sessionsResult, classesResult] = await Promise.allSettled([
                    axios.get('/api/members/me/training-sessions'),
                    axios.get('/api/members/me/class-bookings')
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

    const cycleStartMs = Number(dynamicQr.cycleStartMs) || Date.now();
    const cycleEndMs = Number(dynamicQr.cycleEndMs) || (cycleStartMs + 1);
    const totalCycleMs = Math.max(1, cycleEndMs - cycleStartMs);
    const qrRemainingMs = Math.max(0, cycleEndMs - qrNowTick);
    const qrProgressPercent = dynamicQr.qrValue
        ? Math.max(0, Math.min(100, (qrRemainingMs / totalCycleMs) * 100))
        : 0;
    const isQrTimerLow = qrProgressPercent <= 30;

    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            <MemberPageHeader
                title="Dashboard"
                subtitle={`Welcome back, ${headerName}`}
                icon="dashboard"
            />

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

                {/* Check-ins or another stat */}
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
                        <div className="h-10 w-10 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-amber-400 text-xl">event_available</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Upcoming 1-on-1</p>
                            <h3 className="text-xl font-bold text-white leading-tight mt-1">{upcomingCounts.sessions}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-3 h-full">
                        <div className="h-10 w-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-cyan-300 text-xl">groups</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-text-muted text-[11px] font-medium leading-tight">Upcoming Classes</p>
                            <h3 className="text-xl font-bold text-white leading-tight mt-1">{upcomingCounts.classes}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Latest Update/Notification */}
            <Link to="/announcements" className="block outline-none active:scale-[0.98] transition-all">
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
