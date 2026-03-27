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
    const [memberBundles, setMemberBundles] = useState([]);
    const [loadingBundles, setLoadingBundles] = useState(false);
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
                    
                    // ALIGNMENT: Only count if it's the "current week" session resolved by backend
                    // Or more simply: if it's today or in the future within the current week.
                    // If the backend resolved it to this week, it should be the one showing on the Classes page.
                    
                    const bookingStatus = String(booking?.status || '').toUpperCase();
                    if (!UPCOMING_CLASS_STATUSES.includes(bookingStatus)) return false;

                    // Compute start of current ISO week (Mon)
                    const temp = new Date();
                    temp.setHours(0, 0, 0, 0);
                    const day = temp.getDay();
                    const diff = (day + 6) % 7;
                    const weekStart = new Date(temp);
                    weekStart.setDate(temp.getDate() - diff);
                    
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 7);

                    // Only count if session is >= now AND within this week
                    return classDate >= nowDate && classDate < weekEnd;
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
        fetchBundles();

        return () => {
            active = false;
        };
    }, []);

    const fetchBundles = async () => {
        setLoadingBundles(true);
        try {
            const res = await axios.get('/api/members/me/bundles');
            console.log('Member Bundles Data:', res.data);
            setMemberBundles(res.data);
        } catch (e) {
            console.error("Failed to fetch bundles");
        } finally {
            setLoadingBundles(false);
        }
    };

    const handleClaimProduct = async (bundleId, bucketId) => {
        if (!window.confirm('Confirm product redemption from this bundle?')) return;

        try {
            await axios.post('/api/shop/claim-bundle-product', { 
                memberBundleId: bundleId, 
                bucketId 
            });
            alert('Product claimed successfully!');
            fetchBundles();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to claim product');
        }
    };

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
        <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6">
            <MemberPageHeader
                title="Welcome Home"
                subtitle={`Good to see you, ${headerName}!`}
                icon="dashboard"
            />

            {/* Digital Member Pass - Wallet Style Redesign */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-6 rounded-[2.5rem] border border-white/10 shadow-2xl group transition-all duration-500 hover:shadow-primary/10">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -mr-32 -mt-32 rounded-full animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 blur-[60px] -ml-24 -mb-24 rounded-full" />
                
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

                    <div className="relative group/qr p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.05)] transition-transform duration-500 hover:scale-[1.02] overflow-hidden">
                        {/* Shimmer effect for QR background */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover/qr:translate-x-full transition-transform duration-1000 pointer-events-none" />
                        
                        {dynamicQr.qrValue ? (
                            <div className="relative z-10 p-1 bg-white rounded-lg">
                                <QRCode 
                                    value={dynamicQr.qrValue} 
                                    size={180}
                                    qrStyle="dots"
                                    eyeRadius={10}
                                />
                            </div>
                        ) : (
                            <div className="w-[180px] h-[180px] flex items-center justify-center text-sm text-gray-400 font-medium">
                                {dynamicQr.loading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        <span className="text-[10px] uppercase tracking-wider">Preparing your pass...</span>
                                    </div>
                                ) : 'Ready when you are!'}
                            </div>
                        )}
                    </div>

                    <div className="mt-8 w-full max-w-xs">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2.5">
                            <span>Identity Sync Status</span>
                            <span className={isQrTimerLow ? 'text-orange-400' : 'text-primary'}>
                                {dynamicQr.qrValue ? (isQrTimerLow ? 'Expiring Soon' : 'Active') : 'Ready'}
                            </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden border border-white/5 p-[1px]">
                            <div
                                className={`h-full rounded-full transition-[width] duration-300 ease-linear bg-gradient-to-r from-primary via-primary-hover to-primary ${isQrTimerLow ? 'animate-pulse' : ''}`}
                                style={{ width: `${qrProgressPercent}%` }}
                            />
                        </div>
                        <p className="mt-4 text-center text-[11px] text-white/40 font-medium italic">
                            Scan at the gym entrance to automatically check-in.
                        </p>
                    </div>
                </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Membership Card - Left Side */}
                <div className={`lg:col-span-2 relative overflow-hidden backdrop-blur-md p-6 rounded-[2rem] border transition-all duration-300 ${membershipCardTone} shadow-xl`}>
                    <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-[60px] ${membershipGlowTone} pointer-events-none opacity-50`} />
                    
                    <div className="relative h-full flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight leading-tight">My Membership Journey</h3>
                                <div className="flex items-center gap-2.5 mt-2">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isExpired ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary-hover'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : 'bg-primary animate-pulse'}`}></span>
                                        {isExpired ? 'Time to Renew' : 'Active Pass'}
                                    </span>
                                    <span className="text-xs text-white/50 font-semibold">{planName} • {remainingLabel}</span>
                                </div>
                            </div>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner ${iconTone}`}>
                                <span className={`material-icons-round text-2xl ${isExpired ? 'text-red-400' : 'text-primary'}`}>workspace_premium</span>
                            </div>
                        </div>

                        <div className={`p-5 rounded-2xl border backdrop-blur-sm mt-auto ${progressPanelTone}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold text-white/40 uppercase tracking-[0.1em]">Rhythm Of My Plan</span>
                                <span className={`text-sm font-black ${progressTextTone}`}>{progressPercent}%</span>
                            </div>
                            <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)] ${progressBarTone}`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">Start</p>
                                    <p className="text-xs text-white/70 font-bold">{planStartLabel}</p>
                                </div>
                                <div className="space-y-0.5 text-right">
                                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">Expiry</p>
                                    <p className="text-xs text-white/70 font-bold">{planEndLabel}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vertical Stat Column */}
                <div className="space-y-4">
                    {/* Rewards Summary */}
                    <Link to="/loyalty" className="block group">
                        <div className="bg-[#1e293b]/50 backdrop-blur-md p-5 rounded-[1.5rem] border border-white/5 hover:border-yellow-500/30 transition-all duration-300">
                            <div className="flex items-center justify-between mb-1">
                                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
                                    <span className="material-icons-round text-xl">stars</span>
                                </div>
                                <span className="material-icons-round text-white/20 group-hover:text-yellow-500/50 transition-colors">chevron_right</span>
                            </div>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">My Rewards</p>
                            <h3 className="text-2xl font-black text-white mt-1">{loyaltyPoints} <span className="text-sm font-bold text-yellow-500/80 tracking-normal ml-0.5">pts</span></h3>
                        </div>
                    </Link>

                    {/* Visits Summary */}
                    <Link to="/attendance" className="block group">
                        <div className="bg-[#1e293b]/50 backdrop-blur-md p-5 rounded-[1.5rem] border border-white/5 hover:border-primary/30 transition-all duration-300">
                            <div className="flex items-center justify-between mb-1">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                    <span className="material-icons-round text-xl">calendar_month</span>
                                </div>
                                <span className="material-icons-round text-white/20 group-hover:text-primary/50 transition-colors">chevron_right</span>
                            </div>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Check-ins</p>
                            <h3 className="text-2xl font-black text-white mt-1">{checkIns} <span className="text-sm font-bold text-primary tracking-normal ml-0.5">visits</span></h3>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Upcoming Summary Panel */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1e293b]/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                        <span className="material-icons-round text-2xl">event_available</span>
                    </div>
                    <div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Training</p>
                        <p className="text-lg font-black text-white">{upcomingCounts.sessions} <span className="text-xs font-bold text-white/40">upcoming</span></p>
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

            {/* My Service Bundles - Bucket System */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">My Active Bundles</h3>
                    {!loadingBundles && memberBundles.filter(mb => String(mb.status || '').toUpperCase() === 'ACTIVE').length > 0 && (
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                            {memberBundles.filter(mb => String(mb.status || '').toUpperCase() === 'ACTIVE').length} ACTIVE
                        </span>
                    )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {memberBundles.filter(mb => String(mb.status || '').toUpperCase() === 'ACTIVE').map((mb) => (
                        <div key={mb.id} className="relative overflow-hidden bg-[#1e293b]/50 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 transition-all duration-300">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h4 className="text-lg font-black text-white leading-tight">{mb.bundle?.name || 'Service Bundle'}</h4>
                                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">Purchased {new Date(mb.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                    <span className="material-icons-round">inventory_2</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {mb.buckets?.map((bucket) => {
                                    const hasItems = bucket.items && bucket.items.length > 0;
                                    const itemsLabel = hasItems 
                                        ? bucket.items.map(i => `${i.name} (x${i.quantity})`).join(', ')
                                        : bucket.type === 'CLASS' ? 'Class sessions (Added to balance)' : bucket.type === 'TRAINING_SESSION' ? 'Training sessions' : `Product (${bucket.product?.name || 'Item'})`;

                                    return (
                                        <div key={bucket.id} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="material-icons-round text-primary text-sm flex-shrink-0">
                                                    {bucket.type === 'CLASS' ? 'groups' : bucket.type === 'TRAINING_SESSION' ? 'person' : 'shopping_bag'}
                                                </span>
                                                <span className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
                                                    {itemsLabel}
                                                </span>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-4">
                                                {bucket.type === 'PRODUCT' ? (
                                                    bucket.remaining > 0 ? (
                                                        <button 
                                                            onClick={() => handleClaimProduct(mb.id, bucket.id)}
                                                            className="px-3 py-1 rounded bg-primary text-background text-[9px] font-black uppercase tracking-wider"
                                                        >
                                                            Claim
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Redeemed</span>
                                                    )
                                                ) : (
                                                    <p className="text-xs font-black text-white">{bucket.remaining}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {memberBundles.filter(mb => String(mb.status || '').toUpperCase() === 'ACTIVE').length === 0 && !loadingBundles && (
                        <div className="md:col-span-2 py-10 text-center bg-[#1e293b]/30 border border-dashed border-white/10 rounded-[2rem]">
                            <span className="material-icons-round text-3xl text-white/10 mb-2">auto_awesome</span>
                            <p className="text-white/30 text-[11px] font-bold uppercase tracking-widest">No Active Bundles</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Past Bundles Section */}
            {memberBundles.some(mb => mb.status === 'COMPLETED') && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">Past Bundles</h3>
                        <span className="px-3 py-1 rounded-full bg-white/5 text-white/40 text-[10px] font-bold border border-white/10">
                            {memberBundles.filter(b => b.status === 'COMPLETED').length} COMPLETED
                        </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {memberBundles.filter(mb => mb.status === 'COMPLETED').map((mb) => (
                            <div key={mb.id} className="relative overflow-hidden bg-[#1e293b]/30 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 opacity-70 grayscale-[0.5] transition-all duration-300 hover:opacity-100 hover:grayscale-0">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h4 className="text-lg font-black text-white/60 leading-tight">{mb.bundle?.name || 'Service Bundle'}</h4>
                                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-1">Completed {new Date(mb.completedAt || mb.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/30">
                                        <span className="material-icons-round">history</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Announcements - Soft Integration */}
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
                            
                            {latestNotification ? (
                                <>
                                    <h4 className={`text-lg font-black tracking-tight leading-tight ${latestNotification.isRead ? 'text-white/70' : 'text-white'}`}>
                                        {latestNotification.title}
                                    </h4>
                                    <p className="text-xs text-white/40 mt-1 font-medium line-clamp-1">
                                        {latestNotification.message}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm font-bold text-white/30">Stay tuned for gym announcements...</p>
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-white/30 group-hover:text-white group-hover:bg-white/10 group-hover:scale-110 transition-all">
                            <span className="material-icons-round">chevron_right</span>
                        </div>
                    </div>
                </div>
            </Link>

            {/* Practical Quick Actions Grid */}
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
                        { label: 'Wallets', icon: 'payments', path: '/purchase-history', color: 'text-primary' },
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
// Removed duplicate closing brace

export default MemberDashboard;
