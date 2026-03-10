import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { withApiBase } from '../../config/api';

export default function StaffSettings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(user || null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            setLoading(true);
            try {
                const res = await axios.get(withApiBase('/api/auth/me'));
                if (isMounted) {
                    setProfile(res.data || user || null);
                }
            } catch (e) {
                console.error('Failed to fetch staff profile', e);
                if (isMounted) {
                    setProfile(user || null);
                }
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
    const roleLabel = String(profile?.role || user?.role || 'STAFF');
    const accountId = profile?.id || user?.id || 'N/A';

    return (
        <div className="max-w-4xl mx-auto space-y-5 pb-10">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">Staff Account Settings</h1>
                <p className="text-sm text-text-muted">Manage your staff account details and security.</p>
            </div>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                            {String(displayName).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-semibold truncate">{displayName}</p>
                            <p className="text-text-muted text-xs truncate">{displayEmail}</p>
                        </div>
                    </div>
                    <span className="self-start sm:self-auto px-3 py-1 rounded-full text-[11px] font-semibold border border-blue-500/20 bg-blue-500/10 text-blue-300">
                        {roleLabel}
                    </span>
                </div>

                <div className="p-5 sm:p-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Account ID</p>
                        <p className="text-white text-sm mt-1">{accountId}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Status</p>
                        <p className="text-emerald-400 text-sm mt-1 font-semibold">Active</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Email Address</p>
                        <p className="text-white text-sm mt-1 break-all">{displayEmail}</p>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-surface overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10">
                    <h2 className="text-white font-semibold">Security</h2>
                </div>
                <div className="p-5 sm:p-6 flex flex-wrap gap-2.5">
                    <button
                        onClick={() => navigate('/forgot-password')}
                        className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
                    >
                        Reset Password
                    </button>
                    <button
                        onClick={logout}
                        className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-sm font-semibold transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </section>

            {loading && (
                <div className="text-xs text-text-muted">Refreshing account details...</div>
            )}
        </div>
    );
}
