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

export default function StaffSettings() {
    const { user, logout, logoutAllSessions } = useAuth();
    const { confirm, alert: showAlert } = useConfirm();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(user || null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            setLoading(true);
            try {
                const res = await axios.get(withApiBase('/api/auth/me'));
                if (isMounted) {
                    setProfile(res.data || user || null);
                }
            } catch (error) {
                console.error('Failed to fetch staff profile', error);
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

    const displayName = profile?.name || user?.username || 'Staff User';
    const displayEmail = profile?.email || user?.email || 'No email';
    const roleLabel = String(profile?.role || user?.role || 'STAFF').toUpperCase();

    const accountFields = useMemo(() => ([
        { label: 'Full Name', value: normalizeValue(displayName, 'Staff User') },
        { label: 'Email Address', value: normalizeValue(displayEmail, 'No email') },
        { label: 'Role', value: normalizeValue(roleLabel, 'STAFF') },
        { label: 'Account ID', value: normalizeValue(profile?.id || user?.id) },
        { label: 'Branch', value: normalizeValue(profile?.gym?.name || user?.gym?.name, 'Unassigned') },
        { label: 'Gym ID', value: normalizeValue(profile?.gymId || user?.gymId, 'Not set') },
        { label: 'Tenant ID', value: normalizeValue(profile?.tenantId || user?.tenantId, 'Not set') },
        { label: 'Linked Trainer ID', value: normalizeValue(profile?.trainerId || user?.trainerId, 'None') }
    ]), [displayEmail, displayName, profile, roleLabel, user]);

    const staffCapabilities = [
        { icon: 'groups', title: 'Member Operations', subtitle: 'View and manage member records' },
        { icon: 'receipt_long', title: 'POS Transactions', subtitle: 'Process payments and sales' },
        { icon: 'assignment_return', title: 'Refund Handling', subtitle: 'Review and process refund requests' },
        { icon: 'qr_code_scanner', title: 'Access Scanner', subtitle: 'Validate entry via QR/barcode scans' },
        { icon: 'event', title: 'Classes and Trainers', subtitle: 'Coordinate classes and trainer schedules' },
        { icon: 'campaign', title: 'Announcements', subtitle: 'Read and publish operational updates' }
    ];

    const handleLogoutAllSessions = async () => {
        const accepted = await confirm({
            title: 'Sign out all sessions?',
            message: 'This will sign out your account on all devices. You will need to log in again.',
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
        <div className="space-y-6 pb-10">
            <header className="space-y-1">
                <h1 className="text-3xl font-bold text-white">Staff Account Settings</h1>
                <p className="text-sm text-text-muted">Review your account details, access scope, and security options.</p>
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
                        <h2 className="text-white font-bold">Access Scope</h2>
                        <p className="text-xs text-text-muted mt-1">Core modules available to your staff account.</p>
                    </div>
                    <div className="p-6 grid gap-3 sm:grid-cols-2">
                        {staffCapabilities.map((item) => (
                            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-icons-round text-primary text-[18px]">{item.icon}</span>
                                    <p className="text-sm font-semibold text-white">{item.title}</p>
                                </div>
                                <p className="text-xs text-text-muted mt-2">{item.subtitle}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="space-y-6">
                    <section className="rounded-3xl border border-white/10 bg-surface overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10">
                            <h2 className="text-white font-bold">Security and Sessions</h2>
                            <p className="text-xs text-text-muted mt-1">Manage password and active sign-ins.</p>
                        </div>
                        <div className="p-6 space-y-3">
                            <button
                                onClick={() => navigate('/forgot-password')}
                                className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 transition-colors"
                            >
                                <p className="text-white text-sm font-semibold">Reset Password</p>
                                <p className="text-xs text-text-muted mt-1">Open password reset flow for this account.</p>
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
                            <h2 className="text-white font-bold">Quick Actions</h2>
                            <p className="text-xs text-text-muted mt-1">Jump to day-to-day staff tasks.</p>
                        </div>
                        <div className="p-6 grid gap-2 sm:grid-cols-2">
                            <button
                                onClick={() => navigate('/members')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                Members
                            </button>
                            <button
                                onClick={() => navigate('/access')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                Access Scanner
                            </button>
                            <button
                                onClick={() => navigate('/payments')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                POS
                            </button>
                            <button
                                onClick={() => navigate('/staff/refunds')}
                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-semibold text-white text-left transition-colors"
                            >
                                Refunds
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
