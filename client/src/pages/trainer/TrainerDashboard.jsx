import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'react-qr-code';

export default function TrainerDashboard() {
    const { user } = useAuth();
    const [trainer, setTrainer] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [commissions, setCommissions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dynamicQr, setDynamicQr] = useState({ qrValue: '', expiresAt: null, loading: false });

    const formatMoney = (amount) =>
        `PHP ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [trainerRes, sessionsRes, classesRes, commissionsRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/trainer/me'),
                    axios.get('http://localhost:5000/api/trainer/me/sessions'),
                    axios.get('http://localhost:5000/api/trainer/me/classes'),
                    axios.get('http://localhost:5000/api/trainer/me/commissions')
                ]);
                setTrainer(trainerRes.data);
                setSessions(sessionsRes.data || []);
                setClasses(classesRes.data || []);
                setCommissions(commissionsRes.data || null);
            } catch (e) {
                console.error('Failed to load trainer dashboard', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

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

    return (
        <div className="space-y-4 pb-20 px-4 max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-5 rounded-2xl border border-primary/30 shadow-lg">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <span className="material-icons-round text-primary text-lg">verified</span>
                        <h3 className="text-base font-bold text-white">Digital Trainer Pass</h3>
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
                        <p className="text-xs text-text-muted">Trainer ID: <span className="text-white font-mono">{trainer?.id || 'N/A'}</span></p>
                        {dynamicQr.expiresAt && (
                            <p className="text-xs text-text-muted mt-1">
                                Expires: <span className="text-white">{new Date(dynamicQr.expiresAt).toLocaleTimeString()}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-text-muted text-xs font-medium mb-1">Trainer Profile</p>
                        <h3 className="text-lg font-bold text-white mb-2 truncate">{trainer?.name || user?.name || 'Trainer'}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Active
                            </span>
                            <span className="text-xs text-text-muted">
                                Specialty: <span className="text-white font-medium">{trainer?.specialty || 'Personal Training'}</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <span className="material-icons-round text-primary text-xl">fitness_center</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-primary text-2xl mb-2">event_available</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Upcoming Sessions</p>
                        <h3 className="text-2xl font-bold text-white">{upcomingCount}</h3>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-emerald-400 text-2xl mb-2">task_alt</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Completed Sessions</p>
                        <h3 className="text-2xl font-bold text-white">{completedCount}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-emerald-400 text-2xl mb-2">payments</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Total Earned</p>
                        <p className="text-lg font-bold text-emerald-400">{formatMoney(commissionSummary.totalEarned)}</p>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-amber-400 text-2xl mb-2">hourglass_top</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Pending</p>
                        <p className="text-lg font-bold text-amber-400">{formatMoney(commissionSummary.totalUnpaid)}</p>
                    </div>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex flex-col h-full">
                        <span className="material-icons-round text-blue-300 text-2xl mb-2">account_balance_wallet</span>
                        <p className="text-text-muted text-xs font-medium mb-1">Paid Out</p>
                        <p className="text-lg font-bold text-blue-300">{formatMoney(commissionSummary.totalPayoutRecorded)}</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-white mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-3 gap-2">
                    <a href="/trainer/sessions" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">event_note</span>
                        <span className="text-xs font-medium text-white block">Sessions</span>
                    </a>
                    <a href="/trainer/classes" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">groups</span>
                        <span className="text-xs font-medium text-white block">Classes</span>
                    </a>
                    <a href="/trainer/shop" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">shopping_bag</span>
                        <span className="text-xs font-medium text-white block">Shop</span>
                    </a>
                    <a href="/trainer/profile" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">person</span>
                        <span className="text-xs font-medium text-white block">Profile</span>
                    </a>
                    <a href="/trainer/payment-methods" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">credit_card</span>
                        <span className="text-xs font-medium text-white block">Methods</span>
                    </a>
                    <a href="/trainer/purchase-history" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">history</span>
                        <span className="text-xs font-medium text-white block">Purchases</span>
                    </a>
                    <a href="/trainer/gym-traffic" className="bg-surface hover:bg-white/5 p-3 rounded-xl border border-white/5 transition-all active:scale-95 text-center">
                        <span className="material-icons-round text-primary text-xl block mb-1">timeline</span>
                        <span className="text-xs font-medium text-white block">Traffic</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
