import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { ROLES } from '../../constants/roles';
import QRCode from 'react-qr-code';

export default function Profile() {
    const { user, logout } = useAuth();
    const { formatPrice } = useCurrency();
    const [orders, setOrders] = useState([]);
    const [showQR, setShowQR] = useState(false);
    const [member, setMember] = useState(null);
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
    const qrValue = user?.id ? `MEMBER:${user.id}` : '';

    useEffect(() => {
        const fetchMember = async () => {
            if (!user?.id) return;
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/members/${user.id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                setMember(res.data);
                setEditForm({
                    firstName: res.data?.firstName || '',
                    lastName: res.data?.lastName || '',
                    email: res.data?.email || '',
                    phone: res.data?.phone || ''
                });
            } catch (error) {
                console.error('Failed to fetch member profile', error);
            }
        };

        if (isMember) {
            fetchMember();
        }
    }, [user?.id, isMember]);

    const memberSince = member?.startDate || member?.createdAt || user?.createdAt;
    const memberSinceLabel = memberSince
        ? new Date(memberSince).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'N/A';

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!user?.id || !isMember) return;
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.put(`http://localhost:5000/api/members/${user.id}`, editForm, {
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
            await axios.post(`http://localhost:5000/api/members/${user.id}/change-password`, passwordForm, {
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
                                <h2 className="text-xl font-black uppercase tracking-wide line-clamp-2 mb-1">{user?.name || "Member"}</h2>
                                <div className="font-mono opacity-90 text-xs">ID: {user?.id?.toString().padStart(6, '0')}</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-2 rounded-lg">
                                <span className="material-icons-round text-2xl">verified</span>
                            </div>
                        </div>

                        {/* QR Code Section */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <p className="text-xs opacity-80 mb-1">Scan at front desk</p>
                                <button
                                    onClick={() => setShowQR(!showQR)}
                                    className="text-xs font-bold underline opacity-90 hover:opacity-100"
                                >
                                    {showQR ? 'Hide QR Code' : 'Show QR Code'}
                                </button>
                            </div>
                            {showQR && (
                                <div className="bg-white p-3 rounded-xl shadow-lg">
                                    {qrValue ? (
                                        <QRCode value={qrValue} size={100} />
                                    ) : (
                                        <div className="w-[100px] h-[100px] bg-gray-100 text-gray-500 text-xs flex items-center justify-center rounded-lg">
                                            QR Unavailable
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Account Details Grid */}
            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Account Details</h3>
                <div className="grid grid-cols-2 gap-3">
                    {/* Email */}
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

                    {/* Role */}
                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-primary text-xl mb-2">badge</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Account Type</p>
                            <p className="text-white font-bold text-sm uppercase">{user?.role || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="bg-surface rounded-xl p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-emerald-400 text-xl mb-2">check_circle</span>
                            <p className="text-text-muted text-xs font-medium mb-1">Status</p>
                            <p className="text-emerald-400 font-bold text-sm">Active</p>
                        </div>
                    </div>

                    {/* Join Date */}
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
                <div className="grid grid-cols-2 gap-2">
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
                    {isMember ? (
                        <a href="/payment-methods" className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                            <span className="material-icons-round text-primary text-xl block mb-1">credit_card</span>
                            <span className="text-xs font-medium text-white block">Payment Methods</span>
                        </a>
                    ) : (
                        <div className="bg-surface p-4 rounded-xl border border-white/5 transition-all text-center">
                            <span className="material-icons-round text-primary text-xl block mb-1">person</span>
                            <span className="text-xs font-medium text-white block">Trainer Account</span>
                        </div>
                    )}
                    <button className="bg-surface hover:bg-white/5 active:scale-95 p-4 rounded-xl border border-white/5 transition-all text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">notifications</span>
                        <span className="text-xs font-medium text-white block">Notifications</span>
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

