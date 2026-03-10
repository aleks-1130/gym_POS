import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

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

export default function Profile() {
    const { user, logout } = useAuth();
    const [member, setMember] = useState(null);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: ''
    });
    const isMember = user?.role === ROLES.MEMBER;

    useEffect(() => {
        const fetchMember = async () => {
            if (!user?.id) return;
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
                let profileData = null;

                try {
                    const meRes = await axios.get('/api/members/me', { headers });
                    profileData = meRes.data?.member || meRes.data || null;
                } catch {
                    const fallbackRes = await axios.get(`/api/members/${user.id}`, { headers });
                    profileData = fallbackRes.data?.member || fallbackRes.data || null;
                }

                try {
                    const statsRes = await axios.get('/api/dashboard/stats', { headers });
                    setDashboardStats(statsRes.data || null);
                } catch {
                    setDashboardStats(null);
                }

                if (!profileData) return;
                setMember(profileData);
                setEditForm({
                    firstName: profileData?.firstName || profileData?.user?.firstName || '',
                    lastName: profileData?.lastName || profileData?.user?.lastName || '',
                    email: profileData?.email || profileData?.user?.email || '',
                    phone: profileData?.phone || profileData?.user?.phone || ''
                });
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
    const daysRemaining = calculateDaysRemaining(planEndDate);
    const remainingLabel = daysRemaining === null
        ? 'No end date'
        : daysRemaining < 0
            ? `${Math.abs(daysRemaining)} days overdue`
            : `${daysRemaining} days remaining`;
    const profileDisplayName = user?.name
        || [member?.firstName, member?.lastName].filter(Boolean).join(' ')
        || member?.user?.name
        || 'Member';

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!user?.id || !isMember) return;
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.put(`/api/members/${user.id}`, editForm, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setMember(res.data);
            setShowEditModal(false);
        } catch (error) {
            console.error('Failed to update profile', error);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!user?.id || !isMember) return;
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post(`/api/members/${user.id}/change-password`, passwordForm, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setPasswordForm({ currentPassword: '', newPassword: '' });
            setShowPasswordModal(false);
        } catch (error) {
            console.error('Failed to update password', error);
        }
    };

    return (
        <div className="space-y-4 pb-20 px-4 max-w-2xl mx-auto">

            {/* Header with Sign Out */}
            <div className="flex justify-between items-start gap-3 pt-4">
                <div>
                    <h1 className="text-xl font-bold text-white">My Profile</h1>
                    <p className="text-text-muted text-xs mt-0.5">Manage your account</p>
                </div>
                <button
                    onClick={logout}
                    className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all text-xs font-bold flex-shrink-0 border border-red-500/20"
                >
                    Sign Out
                </button>
            </div>

            {/* Digital Member Card - Prominent */}
            {isMember && (
                <div className="bg-gradient-to-br from-primary via-primary to-orange-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                    <div className="absolute -top-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                    <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/5 rounded-full blur-lg"></div>

                    <div className="relative z-10">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex-1">
                                <div className="text-xs font-bold opacity-80 mb-1 tracking-wide">MEMBER CARD</div>
                                <h2 className="text-xl font-black uppercase tracking-wide line-clamp-2 mb-1">{profileDisplayName}</h2>
                                <div className="font-mono opacity-90 text-xs">ID: {user?.id?.toString().padStart(6, '0')}</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
                                <span className="material-icons-round text-2xl">verified</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-[10px] uppercase tracking-wide opacity-80">Current Plan</p>
                                <p className="text-sm font-bold mt-1 line-clamp-2">{planName}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-[10px] uppercase tracking-wide opacity-80">Plan Status</p>
                                <p className="text-sm font-bold mt-1">{planStatus}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm col-span-2">
                                <p className="text-[10px] uppercase tracking-wide opacity-80">Plan Renewal / End Date</p>
                                <p className="text-sm font-bold mt-1">{planEndDateLabel}</p>
                            </div>
                        </div>

                        <div className="mt-3 bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase tracking-wide opacity-80">Plan Progress</span>
                                <span className="text-xs font-bold">{progressPercent}%</span>
                            </div>
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-yellow-300 to-orange-200 transition-all duration-500"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between mt-2 text-[11px] opacity-85">
                                <span>Start {planStartLabel}</span>
                                <span>{remainingLabel}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Account Details Grid */}
            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Account Details</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="material-icons-round text-primary text-lg">email</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-text-muted text-xs font-medium mb-0.5">Email Address</p>
                                <p className="text-white font-medium truncate text-sm">{member?.email || user?.email || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-primary text-xl mb-2">badge</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Member ID</p>
                            <p className="text-white font-bold text-sm">{user?.id?.toString().padStart(6, '0') || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-emerald-400 text-xl mb-2">check_circle</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Membership Status</p>
                            <p className={`font-bold text-sm ${planStatus === 'EXPIRED' ? 'text-red-400' : 'text-emerald-400'}`}>{planStatus}</p>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-primary text-xl mb-2">workspace_premium</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Current Plan</p>
                            <p className="text-white font-bold text-sm line-clamp-2">{planName}</p>
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-primary text-xl mb-2">event_repeat</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Plan Renewal</p>
                            <p className="text-white font-bold text-sm">{planEndDateLabel}</p>
                        </div>
                    </div>

                    <div className="col-span-2 bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="material-icons-round text-primary text-lg">event</span>
                            </div>
                            <div>
                                <p className="text-text-muted text-xs font-medium mb-0.5">Member Since</p>
                                <p className="text-white font-medium text-sm">{memberSinceLabel}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <a href="/schedule" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">event</span>
                        <span className="text-xs font-medium text-white block">Classes</span>
                    </a>
                    <a href="/trainer-booking" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">sports_gymnastics</span>
                        <span className="text-xs font-medium text-white block">Trainers</span>
                    </a>
                    <a href="/attendance" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">fact_check</span>
                        <span className="text-xs font-medium text-white block">Attendance</span>
                    </a>
                    <a href="/shop" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">shopping_bag</span>
                        <span className="text-xs font-medium text-white block">Shop</span>
                    </a>
                    <a href="/purchase-history" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">receipt_long</span>
                        <span className="text-xs font-medium text-white block">History</span>
                    </a>
                    <a href="/loyalty" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">stars</span>
                        <span className="text-xs font-medium text-white block">Rewards</span>
                    </a>
                    <a href="/payment-methods" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">credit_card</span>
                        <span className="text-xs font-medium text-white block">Payment</span>
                    </a>
                    <button
                        onClick={() => setShowEditModal(true)}
                        className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center"
                    >
                        <span className="material-icons-round text-primary text-xl block mb-1">edit</span>
                        <span className="text-xs font-medium text-white block">Edit Profile</span>
                    </button>
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center"
                    >
                        <span className="material-icons-round text-primary text-xl block mb-1">lock</span>
                        <span className="text-xs font-medium text-white block">Password</span>
                    </button>
                </div>
            </div>

            {/* Support & Legal */}
            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Support & Legal</h3>
                <div className="bg-surface rounded-xl border border-white/5 divide-y divide-white/5">
                    <a href="#" className="flex items-center gap-3 p-4 hover:bg-white/5 active:bg-white/10 transition-colors first:rounded-t-xl">
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">help</span>
                        </div>
                        <span className="text-sm text-white font-medium flex-1">Contact Support</span>
                        <span className="material-icons-round text-text-muted text-lg">chevron_right</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 p-4 hover:bg-white/5 active:bg-white/10 transition-colors">
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">description</span>
                        </div>
                        <span className="text-sm text-white font-medium flex-1">Terms & Conditions</span>
                        <span className="material-icons-round text-text-muted text-lg">chevron_right</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 p-4 hover:bg-white/5 active:bg-white/10 transition-colors last:rounded-b-xl">
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-round text-primary text-lg">privacy_tip</span>
                        </div>
                        <span className="text-sm text-white font-medium flex-1">Privacy Policy</span>
                        <span className="material-icons-round text-text-muted text-lg">chevron_right</span>
                    </a>
                </div>
            </div>

            {/* App Version */}
            <div className="text-center py-4">
                <p className="text-text-muted text-xs">FitOS v1.0.0</p>
            </div>


            {showEditModal && isMember && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Edit Profile</h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                            >
                                <span className="material-icons-round text-white/70">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveProfile} className="space-y-3">
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="First Name"
                                value={editForm.firstName}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                                required
                            />
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Last Name"
                                value={editForm.lastName}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                                required
                            />
                            <input
                                type="email"
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Email"
                                value={editForm.email}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                            />
                            <input
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                placeholder="Phone"
                                value={editForm.phone}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                            />
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-text-muted hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-primary text-background font-bold"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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

