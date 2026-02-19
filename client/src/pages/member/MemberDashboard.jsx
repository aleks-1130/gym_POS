import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import axios from 'axios';

const MemberDashboard = ({ stats, user }) => {
    const member = stats?.memberData || {};
    const now = new Date();
    const activePeriod = (member.membershipPeriods || []).find((period) => new Date(period.endDate) >= now);
    const planName =
        stats?.currentPlanName ||
        activePeriod?.plan?.name ||
        member.plan?.name ||
        "No Active Plan";
    const expiryDate = member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : "N/A";
    const isExpired = member.expiryDate && new Date(member.expiryDate) < new Date();
    const memberId = member.id || user?.id;
    const [dynamicQr, setDynamicQr] = useState({ qrValue: '', expiresAt: null, loading: false });
    const loyaltyPoints = stats?.loyaltyPoints ?? member.points ?? 0;
    const checkIns = stats?.checkIns ?? (member.accessLogs?.filter((log) => log.status !== 'DENIED').length || 0);

    useEffect(() => {
        const fetchDynamicQr = async () => {
            try {
                setDynamicQr((prev) => ({ ...prev, loading: true }));
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                if (!token) {
                    setDynamicQr({ qrValue: '', expiresAt: null, loading: false });
                    return;
                }
                const res = await axios.get('http://localhost:5000/api/access/qr-token', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setDynamicQr({
                    qrValue: res.data?.qrValue || '',
                    expiresAt: res.data?.expiresAt || null,
                    loading: false
                });
            } catch (e) {
                setDynamicQr((prev) => ({ ...prev, loading: false }));
            }
        };

        fetchDynamicQr();
        const interval = setInterval(fetchDynamicQr, 20000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-4 pb-20 px-4 max-w-2xl mx-auto">
          

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
                        {dynamicQr.expiresAt && (
                            <p className="text-xs text-text-muted mt-1">
                                Expires: <span className="text-white">{new Date(dynamicQr.expiresAt).toLocaleTimeString()}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Membership Status - Prominent Card */}
            <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-text-muted text-xs font-medium mb-1">Current Plan</p>
                        <h3 className="text-lg font-bold text-white mb-2 truncate">{planName}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isExpired ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                                {isExpired ? 'Expired' : 'Active'}
                            </span>
                            <span className="text-xs text-text-muted">
                                Expires: <span className="text-white font-medium">{expiryDate}</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <span className="material-icons-round text-primary text-xl">card_membership</span>
                        </div>
                    </div>
                </div>
                {isExpired && (
                    <button className="mt-3 w-full py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-bold hover:bg-red-500/20 transition-colors">
                        Renew Membership
                    </button>
                )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Loyalty Points */}
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-yellow-500 text-2xl mb-2">stars</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Loyalty Points</p>
                        <h3 className="text-2xl font-bold text-white">{loyaltyPoints}</h3>
                    </div>
                </div>

                {/* Check-ins or another stat */}
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-primary text-2xl mb-2">how_to_reg</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Check-ins</p>
                        <h3 className="text-2xl font-bold text-white">{checkIns}</h3>
                    </div>
                </div>
            </div>

            {/* Latest Update/Notification */}
            <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <span className="material-icons-round text-primary text-base">notifications_active</span>
                    Latest Update
                </h3>
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex gap-3">
                        <span className="material-icons-round text-primary flex-shrink-0 text-lg">campaign</span>
                        <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-primary text-sm mb-1">Welcome to FitOS!</h4>
                            <p className="text-xs text-white/70 leading-relaxed">We're excited to have you. Check out our latest classes and training programs.</p>
                        </div>
                    </div>
                </div>
            </div>

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
