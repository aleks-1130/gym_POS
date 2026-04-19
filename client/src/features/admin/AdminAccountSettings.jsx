import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { withApiBase } from '../../config/api';

const normalizeValue = (value, fallback = 'N/A') => {
    if (value === null || value === undefined || value === '') return fallback;
    return value;
};

export default function AdminAccountSettings() {
    const { user, logout, logoutAllSessions } = useAuth();
    const { confirm, alert: showAlert } = useConfirm();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(user || null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState('');
    const [notificationPrefs, setNotificationPrefs] = useState({
        emailAnnouncements: true,
        emailReminders: true,
        emailReceipts: true,
        appAnnouncements: true,
        appReminders: true,
        appReceipts: true
    });
    const [prefSavingKey, setPrefSavingKey] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            setLoading(true);
            try {
                const [meRes, prefRes] = await Promise.all([
                    axios.get(withApiBase('/api/auth/me')),
                    axios.get(withApiBase('/api/notifications/preferences'))
                ]);

                if (!isMounted) return;
                setProfile(meRes.data || user || null);
                if (prefRes?.data && typeof prefRes.data === 'object') {
                    setNotificationPrefs((prev) => ({ ...prev, ...prefRes.data }));
                }
            } catch (error) {
                console.error('Failed to fetch admin account settings', error);
                if (isMounted) setProfile(user || null);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchProfile();
        return () => {
            isMounted = false;
        };
    }, [user]);

    const displayName = profile?.name || user?.username || 'Admin User';
    const displayEmail = profile?.email || user?.email || 'No email';
    const roleLabel = String(profile?.role || user?.role || 'ADMIN').toUpperCase();

    const accountFields = useMemo(() => ([
        { label: 'Full Name', value: normalizeValue(displayName, 'Admin User') },
        { label: 'Email Address', value: normalizeValue(displayEmail, 'No email') },
        { label: 'Role', value: normalizeValue(roleLabel, 'ADMIN') },
        { label: 'Account ID', value: normalizeValue(profile?.id || user?.id) },
        { label: 'Branch', value: normalizeValue(profile?.gym?.name || user?.gym?.name, 'Unassigned') },
        { label: 'Gym ID', value: normalizeValue(profile?.gymId || user?.gymId, 'Not set') },
        { label: 'Tenant ID', value: normalizeValue(profile?.tenantId || user?.tenantId, 'Not set') }
    ]), [displayEmail, displayName, profile, roleLabel, user]);

    const handleTogglePreference = async (key) => {
        if (!key || prefSavingKey) return;
        const nextValue = !notificationPrefs[key];
        setNotificationPrefs((prev) => ({ ...prev, [key]: nextValue }));
        setPrefSavingKey(key);
        try {
            await axios.patch(withApiBase('/api/notifications/preferences'), { [key]: nextValue });
        } catch (error) {
            setNotificationPrefs((prev) => ({ ...prev, [key]: !nextValue }));
            console.error('Failed to update notification preference', error);
        } finally {
            setPrefSavingKey('');
        }
    };

    const handleSendResetLink = async () => {
        if (!displayEmail || displayEmail === 'No email') {
            await showAlert({
                title: 'Missing Email',
                message: 'No account email found for password reset.',
                type: 'warning'
            });
            return;
        }

        setActionLoading('reset');
        try {
            await axios.post(withApiBase('/api/auth/forgot-password'), { email: displayEmail });
            await showAlert({
                title: 'Reset Link Sent',
                message: `If the email exists and is active, a reset link was sent to ${displayEmail}.`,
                type: 'success'
            });
        } catch (error) {
            await showAlert({
                title: 'Request Failed',
                message: error?.response?.data?.error || 'Failed to request reset link.',
                type: 'danger'
            });
        } finally {
            setActionLoading('');
        }
    };

    const handleLogoutAllSessions = async () => {
        const accepted = await confirm({
            title: 'Sign out all sessions?',
            message: 'This will sign out your account on all devices. Continue?',
            confirmLabel: 'Sign Out All',
            type: 'warning'
        });
        if (!accepted) return;

        setActionLoading('all');
        try {
            await logoutAllSessions();
        } catch (error) {
            console.error('Failed to log out all sessions', error);
            await showAlert({
                title: 'Action Failed',
                message: error?.response?.data?.error || 'Failed to sign out all sessions.',
                type: 'danger'
            });
        } finally {
            setActionLoading('');
        }
    };

    const handleSignOut = async () => {
        setActionLoading('single');
        try {
            await logout();
        } finally {
            setActionLoading('');
        }
    };

    return (
        <div className="space-y-6 pb-10 max-w-[110rem] mx-auto">
            <header className="space-y-1">
                <h1 className="text-3xl font-bold text-white">Admin Account Settings</h1>
                <p className="text-sm text-text-muted">Manage your admin profile, alerts, and security sessions.</p>
            </header>

            <section className="rounded-3xl border border-white/10 bg-surface overflow-hidden">
                <div className="p-6 border-b border-white/10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-bold text-xl">
                            {String(displayName).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-semibold text-lg truncate">{displayName}</p>
                            <p className="text-text-muted text-sm truncate">{displayEmail}</p>
                            <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wider">
                                {profile?.gym?.name || user?.gym?.name || 'Unassigned Branch'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-[11px] font-semibold border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                            Active
                        </span>
                        <span className="px-3 py-1 rounded-full text-[11px] font-semibold border border-blue-500/25 bg-blue-500/10 text-blue-300">
                            {roleLabel}
                        </span>
                    </div>
                </div>

                <div className="p-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {accountFields.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{item.label}</p>
                            <p className="text-white text-sm mt-1 break-all">{item.value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-3xl border border-white/10 bg-surface overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10">
                        <h2 className="text-white font-bold">Notification Preferences</h2>
                        <p className="text-xs text-text-muted mt-1">Control app and email alerts for your admin account.</p>
                    </div>
                    <div className="divide-y divide-white/5">
                        <PreferenceToggle
                            label="App Announcements"
                            description="Operational announcements inside the app"
                            active={Boolean(notificationPrefs.appAnnouncements)}
                            disabled={prefSavingKey === 'appAnnouncements'}
                            onToggle={() => handleTogglePreference('appAnnouncements')}
                        />
                        <PreferenceToggle
                            label="App Reminders"
                            description="Class and schedule reminders in-app"
                            active={Boolean(notificationPrefs.appReminders)}
                            disabled={prefSavingKey === 'appReminders'}
                            onToggle={() => handleTogglePreference('appReminders')}
                        />
                        <PreferenceToggle
                            label="App Receipts"
                            description="Payment and POS receipt notifications"
                            active={Boolean(notificationPrefs.appReceipts)}
                            disabled={prefSavingKey === 'appReceipts'}
                            onToggle={() => handleTogglePreference('appReceipts')}
                        />
                        <PreferenceToggle
                            label="Email Announcements"
                            description="Email copies of announcements"
                            active={Boolean(notificationPrefs.emailAnnouncements)}
                            disabled={prefSavingKey === 'emailAnnouncements'}
                            onToggle={() => handleTogglePreference('emailAnnouncements')}
                        />
                        <PreferenceToggle
                            label="Email Reminders"
                            description="Email class and operations reminders"
                            active={Boolean(notificationPrefs.emailReminders)}
                            disabled={prefSavingKey === 'emailReminders'}
                            onToggle={() => handleTogglePreference('emailReminders')}
                        />
                        <PreferenceToggle
                            label="Email Receipts"
                            description="Email copies of payment receipts"
                            active={Boolean(notificationPrefs.emailReceipts)}
                            disabled={prefSavingKey === 'emailReceipts'}
                            onToggle={() => handleTogglePreference('emailReceipts')}
                        />
                    </div>
                </section>

                <div className="space-y-6">
                    <section className="rounded-3xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10">
                            <h2 className="text-white font-bold">Security and Sessions</h2>
                            <p className="text-xs text-text-muted mt-1">Manage password reset and active sign-ins.</p>
                        </div>
                        <div className="p-6 space-y-3">
                            <button
                                onClick={handleSendResetLink}
                                disabled={actionLoading !== ''}
                                className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <p className="text-white text-sm font-semibold">
                                    {actionLoading === 'reset' ? 'Sending Reset Link...' : 'Send Password Reset Link'}
                                </p>
                                <p className="text-xs text-text-muted mt-1">Send reset instructions to your account email.</p>
                            </button>
                            <button
                                onClick={handleLogoutAllSessions}
                                disabled={actionLoading !== ''}
                                className="w-full text-left rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <p className="text-amber-200 text-sm font-semibold">
                                    {actionLoading === 'all' ? 'Signing Out...' : 'Sign Out All Devices'}
                                </p>
                                <p className="text-xs text-amber-200/80 mt-1">Ends all active sessions for your account.</p>
                            </button>
                            <button
                                onClick={handleSignOut}
                                disabled={actionLoading !== ''}
                                className="w-full text-left rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-4 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <p className="text-red-300 text-sm font-semibold">
                                    {actionLoading === 'single' ? 'Signing Out...' : 'Sign Out This Device'}
                                </p>
                                <p className="text-xs text-red-300/80 mt-1">Log out from your current session.</p>
                            </button>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10">
                            <h2 className="text-white font-bold">Quick Admin Links</h2>
                            <p className="text-xs text-text-muted mt-1">Jump to core admin pages.</p>
                        </div>
                        <div className="p-6 grid gap-2 sm:grid-cols-2">
                            <button
                                onClick={() => navigate('/settings')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                System Settings
                            </button>
                            <button
                                onClick={() => navigate('/analytics')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                Analytics
                            </button>
                            <button
                                onClick={() => navigate('/transactions')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                Transactions
                            </button>
                            <button
                                onClick={() => navigate('/training-manager')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                Training Sessions
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            {loading && (
                <p className="text-xs text-text-muted">Refreshing account details...</p>
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
            className="w-full px-6 py-3 text-left transition-colors hover:bg-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{description}</p>
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
