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
        <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6">
            <TrainerPageHeader
                title="My Workspace"
                subtitle={`Good day, ${headerName}! Ready for some gains?`}
                icon="dashboard"
            />

            {/* Digital Trainer Pass - Wallet Style Redesign */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] to-[#0f172a] p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl group transition-all duration-500 hover:shadow-primary/10 max-w-[340px] sm:max-w-md mx-auto w-full">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -mr-32 -mt-32 rounded-full animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 blur-[60px] -ml-24 -mb-24 rounded-full" />
                
                <div className="relative flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="material-icons-round text-primary text-sm">badge</span>
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Trainer Credentials</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-white/40 block mb-0.5">Trainer ID</span>
                            <span className="text-xs font-mono text-white/80">{trainer?.id || 'N/A'}</span>
                        </div>
                    </div>

                    <div className="relative group/qr p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.05)] transition-transform duration-500 hover:scale-[1.02] overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover/qr:translate-x-full transition-transform duration-1000 pointer-events-none" />
                        
                        {dynamicQr.qrValue ? (
                            <div className="relative z-10 p-1 bg-white rounded-xl w-full max-w-[150px] sm:max-w-[180px] aspect-square flex items-center justify-center mx-auto">
                                <QRCode 
                                    value={dynamicQr.qrValue} 
                                    size={180}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                />
                            </div>
                        ) : (
                            <div className="w-[150px] sm:w-[180px] h-[150px] sm:h-[180px] flex items-center justify-center text-sm text-gray-400 font-medium mx-auto">
                                {dynamicQr.loading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                                        <span className="text-[10px] uppercase tracking-wider">Refreshing...</span>
                                    </div>
                                ) : 'Access Restricted'}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 sm:mt-8 w-full max-w-xs mx-auto">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2.5">
                            <span>Your Digital Key</span>
                            <span className={isQrTimerLow ? 'text-orange-400' : 'text-primary'}>
                                {dynamicQr.qrValue ? (isQrTimerLow ? 'Expiring' : 'Sync Active') : 'Standby'}
                            </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden border border-white/5 p-[1px]">
                            <div
                                className={`h-full rounded-full transition-[width] duration-300 ease-linear bg-gradient-to-r from-primary via-primary-hover to-primary ${isQrTimerLow ? 'animate-pulse' : ''}`}
                                style={{ width: `${qrProgressPercent}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Overview Card */}
            <div className="relative overflow-hidden bg-surface/50 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 shadow-xl">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-[60px] pointer-events-none opacity-50" />
                <div className="relative">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-16 h-16 rounded-[1.25rem] overflow-hidden border-2 border-primary/20 bg-[#0f172a] shadow-inner flex items-center justify-center shrink-0">
                                {trainer?.imageUrl && !profileImageError ? (
                                    <img
                                        src={trainer.imageUrl}
                                        alt={trainerDisplayName}
                                        className="w-full h-full object-cover"
                                        onError={() => setProfileImageError(true)}
                                    />
                                ) : (
                                    <span className="text-xl font-black text-primary">{trainerInitials}</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <span className={ `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border mb-2 ${trainerTypeBadgeClass}` }>
                                    <span className={ `w-1.5 h-1.5 rounded-full ${trainerType === 'FREELANCER' ? 'bg-orange-400' : 'bg-blue-400'}` } />
                                    {trainerTypeLabel}
                                </span>
                                <h3 className="text-2xl font-black text-white leading-tight truncate">{trainerDisplayName}</h3>
                                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mt-1">{trainerSpecialty}</p>
                            </div>
                        </div>
                        <Link
                            to="/trainer/profile"
                            className="shrink-0 w-12 h-12 rounded-2xl border border-white/5 bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all shadow-sm"
                        >
                            <span className="material-icons-round text-xl">settings</span>
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="group bg-white/[0.03] rounded-2xl border border-white/5 p-4 transition-all hover:bg-white/[0.05]">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">Community Love</span>
                                <span className="material-icons-round text-yellow-500 text-sm">stars</span>
                            </div>
                            <p className="text-xl font-black text-white">{trainerRatingLabel} <span className="text-[10px] text-white/30 font-bold uppercase tracking-normal">/ 5.0</span></p>
                        </div>
                        <div className="group bg-white/[0.03] rounded-2xl border border-white/5 p-4 transition-all hover:bg-white/[0.05]">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">My Standard Rate</span>
                                <span className="material-icons-round text-primary text-sm">payments</span>
                            </div>
                            <p className="text-xl font-black text-white truncate">{trainerSessionRateLabel}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Stats Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">Your Performance</h3>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#1e293b]/50 backdrop-blur-md p-5 rounded-[1.5rem] border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 mb-4">
                            <span className="material-icons-round text-xl">stars</span>
                        </div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Points Earned</p>
                        <h3 className="text-2xl font-black text-white mt-1">{loyaltyPoints}</h3>
                    </div>

                    <div className="bg-[#1e293b]/50 backdrop-blur-md p-5 rounded-[1.5rem] border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                            <span className="material-icons-round text-xl">how_to_reg</span>
                        </div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Gym Visits</p>
                        <h3 className="text-2xl font-black text-white mt-1">{checkIns}</h3>
                    </div>

                    <div className="bg-[#1e293b]/50 backdrop-blur-md p-5 rounded-[1.5rem] border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                            <span className="material-icons-round text-xl">auto_awesome_motion</span>
                        </div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Upcoming</p>
                        <h3 className="text-2xl font-black text-white mt-1">{upcomingCount}</h3>
                    </div>

                    <div className="bg-[#1e293b]/50 backdrop-blur-md p-5 rounded-[1.5rem] border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4">
                            <span className="material-icons-round text-xl">verified</span>
                        </div>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Lives Changed</p>
                        <h3 className="text-2xl font-black text-white mt-1">{completedCount}</h3>
                    </div>
                </div>
            </div>

            {/* Earnings Summary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="bg-emerald-500/10 backdrop-blur-md p-5 rounded-2xl border border-emerald-500/20">
                    <p className="text-emerald-500/60 text-[10px] font-bold uppercase tracking-widest mb-1">Total Earned</p>
                    <p className="text-2xl font-black text-emerald-400">{formatMoney(commissionSummary.totalEarned)}</p>
                </div>
                <div className="bg-amber-500/10 backdrop-blur-md p-5 rounded-2xl border border-amber-500/20">
                    <p className="text-amber-500/60 text-[10px] font-bold uppercase tracking-widest mb-1">Upcoming Rewards</p>
                    <p className="text-2xl font-black text-amber-400">{formatMoney(commissionSummary.totalUnpaid)}</p>
                </div>
                <div className="bg-blue-500/10 backdrop-blur-md p-5 rounded-2xl border border-blue-500/20">
                    <p className="text-blue-500/60 text-[10px] font-bold uppercase tracking-widest mb-1">Paid Out</p>
                    <p className="text-2xl font-black text-blue-300">{formatMoney(commissionSummary.totalPayoutRecorded)}</p>
                </div>
                <div className="bg-rose-500/10 backdrop-blur-md p-5 rounded-2xl border border-rose-500/20">
                    <p className="text-rose-500/60 text-[10px] font-bold uppercase tracking-widest mb-1">Deductions</p>
                    <p className="text-2xl font-black text-rose-300">-{formatMoney(commissionSummary.materialPendingDeduction)}</p>
                </div>
            </div>

            {/* Announcements - Soft Integration */}
            <Link to="/announcements" className="block group">
                <div className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300 ${latestCardTone} shadow-xl backdrop-blur-md`}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                    <span className="material-icons-round text-sm text-white/70">{latestStyle.icon}</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Gym News & Notices</span>
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
                                <p className="text-sm font-bold text-white/30">Stay updated with latest gym announcements...</p>
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-white/30 group-hover:text-white group-hover:bg-white/10 group-hover:scale-110 transition-all">
                            <span className="material-icons-round">chevron_right</span>
                        </div>
                    </div>
                </div>
            </Link>

            {/* Your Day At A Glance - Quick Actions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30">Trainer's Toolbox</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {quickActions.map((action) => (
                        <Link 
                            key={action.to}
                            to={action.to} 
                            className="group relative bg-[#1e293b]/30 hover:bg-white/5 p-5 rounded-[1.5rem] border border-white/5 transition-all duration-300 active:scale-95 text-center overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="material-icons-round text-3xl block mb-2 text-primary group-hover:scale-110 transition-transform">{action.icon}</span>
                            <span className="text-xs font-bold text-white/80 group-hover:text-white block uppercase tracking-widest">{action.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
