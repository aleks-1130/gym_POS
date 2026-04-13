import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { ROLES } from '../../constants/roles';
import { formatPlanDate, calculatePlanProgress } from '../../utils/memberUtils';

export default function Profile() {
    const { user, logout, logoutAllSessions } = useAuth();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const navigate = useNavigate();
    const location = useLocation();
    const [member, setMember] = useState(null);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [gymProfile, setGymProfile] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [notificationPrefs, setNotificationPrefs] = useState({
        emailAnnouncements: true,
        emailReminders: true,
        emailReceipts: true,
        appAnnouncements: true,
        appReminders: true,
        appReceipts: true
    });
    const [prefSavingKey, setPrefSavingKey] = useState('');
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: ''
    });
    const isMember = user?.role === ROLES.MEMBER;
    const membershipLockState = String(new URLSearchParams(location.search).get('membership') || '').toLowerCase();
    const showMembershipLockNotice = membershipLockState === 'expired' || membershipLockState === 'freezed' || membershipLockState === 'frozen';

    useEffect(() => {
        const fetchMember = async () => {
            if (!user?.id) return;
            try {
                
                
                let profileData = null;

                try {
                    const fallbackRes = await axios.get(`/api/members/${user.id}`);
                    profileData = fallbackRes.data?.member || fallbackRes.data || null;
                } catch {
                    // Member profile not found
                }

                try {
                    const statsRes = await axios.get('/api/dashboard/stats');
                    setDashboardStats(statsRes.data || null);
                } catch {
                    setDashboardStats(null);
                }
                try {
                    const prefRes = await axios.get('/api/notifications/preferences');
                    if (prefRes?.data && typeof prefRes.data === 'object') {
                        setNotificationPrefs((prev) => ({ ...prev, ...prefRes.data }));
                    }
                } catch {
                    // Keep defaults if preferences endpoint is not available
                }
                try {
                    // Only OWNER/ADMIN can access /api/settings — skip for members
                    if (!isMember) {
                        const gymRes = await axios.get('/api/settings');
                        setGymProfile(gymRes.data || null);
                    }
                } catch {
                    setGymProfile(null);
                }

                if (!profileData) return;
                setMember(profileData);
            } catch (error) {
                console.error('Failed to fetch member profile', error);
            }
        };

        if (isMember) {
            fetchMember();
        }
    }, [user?.id, isMember]);

    const now = new Date();
    const dashboardMember = dashboardStats?.memberData || null;
    const planSource = dashboardMember || member || {};
    const membershipPeriods = Array.isArray(planSource?.membershipPeriods) ? planSource.membershipPeriods : [];
    const activePeriod = membershipPeriods
        .filter((period) => {
            const endDate = new Date(period?.endDate);
            return !Number.isNaN(endDate.getTime()) && endDate >= now;
        })
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];
    const latestPeriod = membershipPeriods
        .slice()
        .sort((a, b) => new Date(b?.endDate || 0) - new Date(a?.endDate || 0))[0];
    const effectivePeriod = activePeriod || latestPeriod || null;

    const memberSince = planSource?.startDate || member?.startDate || member?.createdAt || user?.createdAt;
    const memberSinceLabel = memberSince
        ? new Date(memberSince).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'N/A';
    const planName =
        dashboardStats?.currentPlanName
        || effectivePeriod?.plan?.name
        || planSource?.plan?.name
        || member?.planName
        || member?.membershipPlan
        || member?.membershipType
        || member?.packageName
        || 'No Active Plan';
    const planEndDate =
        effectivePeriod?.endDate
        || planSource?.expiryDate
        || planSource?.endDate
        || member?.membershipEndDate
        || member?.planEndDate
        || member?.nextBillingDate;
    const isPlanExpired = planEndDate ? new Date(planEndDate) < now : false;
    const planStatus = isPlanExpired
        ? 'EXPIRED'
        : String(planSource?.status || member?.status || 'ACTIVE').toUpperCase();
    const planEndDateLabel = planEndDate
        ? new Date(planEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';
    const planStartDate =
        effectivePeriod?.startDate
        || planSource?.startDate
        || member?.membershipStartDate
        || member?.planStartDate
        || member?.createdAt
        || null;
    const progressPercent = Math.round(calculatePlanProgress(planStartDate, planEndDate));
    const planStartLabel = formatPlanDate(planStartDate);
    const profileDisplayName = user?.name
        || [member?.firstName, member?.lastName].filter(Boolean).join(' ')
        || member?.user?.name
        || 'Member';
    const avatarUrl = member?.imageUrl || member?.avatarUrl || member?.photo || user?.imageUrl || '';
    const avatarFallback = String(profileDisplayName || 'M')
        .split(' ')
        .map((part) => part[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const supportEmail = String(gymProfile?.email || 'contact@fitos.com').trim();
    const supportPhone = String(gymProfile?.phone || '').trim();

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!user?.id || !isMember) return;
        try {
            
            await axios.post(`/api/members/${user.id}/change-password`, passwordForm);
            setPasswordForm({ currentPassword: '', newPassword: '' });
            setShowPasswordModal(false);
        } catch (error) {
            console.error('Failed to update password', error);
        }
    };
    const handleTogglePreference = async (key) => {
        if (!key || prefSavingKey) return;
        const nextValue = !notificationPrefs[key];
        setNotificationPrefs((prev) => ({ ...prev, [key]: nextValue }));
        setPrefSavingKey(key);
        try {
            await axios.patch('/api/notifications/preferences', { [key]: nextValue });
        } catch (error) {
            setNotificationPrefs((prev) => ({ ...prev, [key]: !nextValue }));
            console.error('Failed to update notification preference', error);
        } finally {
            setPrefSavingKey('');
        }
    };

    const settingsItems = [
        { key: 'password', label: 'Update Security', description: 'Update your account password', icon: 'lock', onClick: () => setShowPasswordModal(true) }
    ];

    const handleLogout = async () => {
        const confirmed = await showConfirm({
            title: 'Sign Out',
            message: 'Sign out from this device only?',
            confirmLabel: 'Sign Out',
            cancelLabel: 'Cancel',
            type: 'danger'
        });
        if (!confirmed) return;

        await logout();
        navigate('/login');
    };

    const handleLogoutAllSessions = async () => {
        const confirmed = await showConfirm({
            title: 'Sign Out All Sessions',
            message: 'This will sign out your account on all devices. Continue?',
            confirmLabel: 'Sign Out All',
            cancelLabel: 'Cancel',
            type: 'warning'
        });
        if (!confirmed) return;

        try {
            await logoutAllSessions();
            navigate('/login');
        } catch (error) {
            await showAlert({
                title: 'Sign Out Failed',
                message: error?.response?.data?.error || 'Unable to sign out all sessions right now.',
                type: 'danger'
            });
        }
    };

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <header className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-base text-white/80">manage_accounts</span>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base font-bold text-white truncate">My Account & Settings</h1>
                            <p className="text-[11px] text-text-muted">Member Account</p>
                        </div>
                    </div>
                </div>
            </header>

            {showMembershipLockNotice && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                    <p className="text-sm font-semibold text-red-300">
                        {membershipLockState === 'expired' ? 'Membership expired' : 'Membership freezed'}
                    </p>
                    <p className="text-[11px] text-red-200/90 mt-0.5">
                        {membershipLockState === 'expired'
                            ? 'Renew your membership at the front desk to access class schedule and trainer booking again.'
                            : 'Class schedule and trainer booking are disabled while your membership is on freeze.'}
                    </p>
                </div>
            )}

            <section className="rounded-2xl border border-white/10 bg-surface p-3 sm:p-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-primary/40 bg-white/5 flex items-center justify-center shrink-0">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Member profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-base sm:text-lg font-bold text-primary">{avatarFallback}</span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-bold text-white truncate">{profileDisplayName}</h2>
                        <p className="text-[11px] text-text-muted mt-0.5">Member ID: {user?.id?.toString().padStart(6, '0') || 'N/A'}</p>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">{member?.email || user?.email || 'No email set'}</p>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">{member?.phone || 'No phone set'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-center">
                        <p className={`text-sm font-bold ${planStatus === 'EXPIRED' ? 'text-red-300' : 'text-emerald-300'}`}>{planStatus}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Status</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-center">
                        <p className="text-sm font-bold text-primary truncate">{planName}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mt-1">Current Plan</p>
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 mt-2.5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted">My Journey Progress</span>
                        <span className="text-[11px] font-bold text-white">{progressPercent}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${planStatus === 'EXPIRED' ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] sm:text-[11px] text-text-muted">
                        <span>Start {planStartLabel}</span>
                        <span>Renews {planEndDateLabel}</span>
                    </div>
                </div>

                <div className="mt-2.5 text-[11px] text-text-muted">
                    Member since <span className="font-semibold text-white">{memberSinceLabel}</span>
                </div>

            </section>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden mt-4">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="material-icons-round text-yellow-400 text-base">star</span>
                            Rewards History
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">Your points and activity ledger</p>
                    </div>
                    <div className="text-right">
                         <span className="text-lg font-bold text-yellow-400">{member?.points || 0}</span>
                         <p className="text-[10px] uppercase tracking-wider text-text-muted mt-0.5">Total Points</p>
                    </div>
                </div>
                <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                    {member?.loyaltyTransactions?.length > 0 ? (
                        member.loyaltyTransactions.map((tx) => (
                            <div key={tx.id} className="flex flex-col gap-1 px-3 py-3 hover:bg-white/5 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="text-[13px] font-semibold text-white">{tx.description || tx.type}</span>
                                    <span className={`text-[13px] font-bold ${tx.type === 'REDEEMED' || tx.type === 'REVERSED' ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {tx.type === 'REDEEMED' || tx.type === 'REVERSED' ? '-' : '+'}{tx.points}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-[11px] text-text-muted">{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 uppercase tracking-widest">{tx.type}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-6 text-center text-[12px] text-text-muted flex flex-col items-center gap-2">
                            <span className="material-icons-round text-2xl opacity-20">history</span>
                            No reward history available yet.
                        </div>
                    )}
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="px-3 py-2.5 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">Settings</h3>
                    <p className="text-xs text-text-muted mt-0.5">Choose what you want to manage</p>
                </div>
                <div className="divide-y divide-white/5">
                    {settingsItems.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                                if (typeof item.onClick === 'function') item.onClick();
                            }}
                            className="w-full px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-white">{item.label}</p>
                                    <p className="text-[11px] text-text-muted mt-0.5">{item.description}</p>
                                </div>
                                <span className="material-icons-round text-sm text-text-muted">chevron_right</span>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="px-3 py-2.5 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">How I Stay Updated</h3>
                    <p className="text-xs text-text-muted mt-0.5">Control app and email alerts</p>
                </div>
                <div className="divide-y divide-white/5">
                    <PreferenceToggle
                        label="App Announcements"
                        description="Gym announcements and updates"
                        active={Boolean(notificationPrefs.appAnnouncements)}
                        disabled={prefSavingKey === 'appAnnouncements'}
                        onToggle={() => handleTogglePreference('appAnnouncements')}
                    />
                    <PreferenceToggle
                        label="App Class Reminders"
                        description="Class and session reminders"
                        active={Boolean(notificationPrefs.appReminders)}
                        disabled={prefSavingKey === 'appReminders'}
                        onToggle={() => handleTogglePreference('appReminders')}
                    />
                    <PreferenceToggle
                        label="App Receipts"
                        description="In-app payment receipt alerts"
                        active={Boolean(notificationPrefs.appReceipts)}
                        disabled={prefSavingKey === 'appReceipts'}
                        onToggle={() => handleTogglePreference('appReceipts')}
                    />
                    <PreferenceToggle
                        label="Email Announcements"
                        description="Receive updates by email"
                        active={Boolean(notificationPrefs.emailAnnouncements)}
                        disabled={prefSavingKey === 'emailAnnouncements'}
                        onToggle={() => handleTogglePreference('emailAnnouncements')}
                    />
                    <PreferenceToggle
                        label="Email Class Reminders"
                        description="Class reminders by email"
                        active={Boolean(notificationPrefs.emailReminders)}
                        disabled={prefSavingKey === 'emailReminders'}
                        onToggle={() => handleTogglePreference('emailReminders')}
                    />
                    <PreferenceToggle
                        label="Email Receipts"
                        description="Payment receipts by email"
                        active={Boolean(notificationPrefs.emailReceipts)}
                        disabled={prefSavingKey === 'emailReceipts'}
                        onToggle={() => handleTogglePreference('emailReceipts')}
                    />
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="px-3 py-2.5 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">Support & Legal</h3>
                    <p className="text-xs text-text-muted mt-0.5">Help, policy, and gym contact channels</p>
                </div>
                <div className="divide-y divide-white/5">
                    <a
                        href={`mailto:${supportEmail}?subject=Member%20Support%20Request`}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
                    >
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-white">Contact Support</p>
                            <p className="text-[11px] text-text-muted mt-0.5 truncate">{supportEmail}</p>
                        </div>
                        <span className="material-icons-round text-sm text-text-muted">open_in_new</span>
                    </a>
                    <a
                        href={supportPhone ? `tel:${supportPhone}` : '#'}
                        onClick={(event) => {
                            if (!supportPhone) event.preventDefault();
                        }}
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 transition-colors ${supportPhone ? 'hover:bg-white/5' : 'opacity-60 cursor-not-allowed'}`}
                    >
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-white">Call Gym</p>
                            <p className="text-[11px] text-text-muted mt-0.5 truncate">{supportPhone || 'Phone unavailable'}</p>
                        </div>
                        <span className="material-icons-round text-sm text-text-muted">call</span>
                    </a>
                    <a
                        href="/terms-and-conditions"
                        className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
                    >
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-white">Terms & Conditions</p>
                            <p className="text-[11px] text-text-muted mt-0.5 truncate">Membership agreement and waiver details</p>
                        </div>
                        <span className="material-icons-round text-sm text-text-muted">chevron_right</span>
                    </a>
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="px-3 py-2.5 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white">Account Access</h3>
                    <p className="text-xs text-text-muted mt-0.5">Manage active sign-in sessions</p>
                </div>
                <div className="p-3 space-y-2">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-300 hover:bg-red-500/20"
                    >
                        Sign Out
                    </button>
                    <button
                        type="button"
                        onClick={handleLogoutAllSessions}
                        className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-400/20"
                    >
                        Sign Out All Sessions
                    </button>
                </div>
            </section>


            {showPasswordModal && isMember && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Change Password</h3>
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                            >
                                <span className="material-icons-round text-white/70">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleChangePassword} className="space-y-3">
                            <input
                                type="password"
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Current Password"
                                value={passwordForm.currentPassword}
                                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                                required
                            />
                            <input
                                type="password"
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="New Password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                                required
                            />
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-text-muted hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-primary text-background font-bold"
                                >
                                    Update
                                </button>
                            </div>
                        </form>

                    </div>
                </div>
            )}
        </div>
    );
}

function PreferenceToggle({ label, description, active, disabled, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className="w-full px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white">{label}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{description}</p>
                </div>
                <span
                    className={`inline-flex h-6 w-11 items-center rounded-full border px-1 transition-colors ${active ? 'border-primary/60 bg-primary/20 justify-end' : 'border-white/20 bg-white/5 justify-start'}`}
                    aria-hidden="true"
                >
                    <span className={`h-4 w-4 rounded-full ${active ? 'bg-primary' : 'bg-white/60'}`} />
                </span>
            </div>
        </button>
    );
}

