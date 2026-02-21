import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const formatMoney = (amount) =>
    `PHP ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TrainerCommissionHistory() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [tab, setTab] = useState('commissions');

    useEffect(() => {
        const fetchCommissions = async () => {
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/trainer/me/commissions', {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                setData(res.data || null);
            } catch (e) {
                console.error('Failed to fetch commission history', e);
            } finally {
                setLoading(false);
            }
        };

        fetchCommissions();
    }, []);

    const summary = data?.summary || {};
    const commissions = data?.history?.commissions || [];
    const payouts = data?.history?.payouts || [];

    const filteredCommissions = useMemo(() => {
        return commissions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [commissions]);

    const filteredPayouts = useMemo(() => {
        return payouts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [payouts]);

    if (loading) {
        return <div className="text-white p-6 text-center">Loading commission history...</div>;
    }

    return (
        <div className="space-y-4 sm:space-y-6 px-4 pb-24 max-w-5xl mx-auto">
            <div className="space-y-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Commission History</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">Track earned commissions and payout records</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-emerald-400 text-2xl mb-2">payments</span>
                            <p className="text-text-muted text-[10px] sm:text-xs mb-1">Total Earned</p>
                            <p className="text-emerald-400 text-lg sm:text-2xl font-bold">{formatMoney(summary.totalEarned)}</p>
                        </div>
                    </div>
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-amber-400 text-2xl mb-2">hourglass_top</span>
                            <p className="text-text-muted text-[10px] sm:text-xs mb-1">Pending</p>
                            <p className="text-amber-300 text-lg sm:text-2xl font-bold">{formatMoney(summary.totalUnpaid)}</p>
                        </div>
                    </div>
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <div className="flex flex-col h-full">
                            <span className="material-icons-round text-blue-300 text-2xl mb-2">account_balance_wallet</span>
                            <p className="text-text-muted text-[10px] sm:text-xs mb-1">Paid Out</p>
                            <p className="text-blue-300 text-lg sm:text-2xl font-bold">{formatMoney(summary.totalPayoutRecorded)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                    onClick={() => setTab('commissions')}
                    className={`px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${tab === 'commissions' ? 'bg-primary text-background' : 'bg-surface text-text-muted hover:text-white border border-white/5'}`}
                >
                    Commissions
                </button>
                <button
                    onClick={() => setTab('payouts')}
                    className={`px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${tab === 'payouts' ? 'bg-primary text-background' : 'bg-surface text-text-muted hover:text-white border border-white/5'}`}
                >
                    Payouts
                </button>
            </div>

            {tab === 'commissions' ? (
                filteredCommissions.length === 0 ? (
                    <div className="bg-surface rounded-xl p-8 text-center border border-white/5">
                        <span className="material-icons-round text-text-muted text-4xl mb-2">receipt_long</span>
                        <p className="text-text-muted text-sm">No commission entries found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredCommissions.map((item) => (
                            <div key={item.id} className="bg-surface rounded-xl p-4 border border-white/5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-white font-semibold text-sm">{item.label || item.source}</p>
                                        <p className="text-text-muted text-xs mt-1">
                                            {new Date(item.date).toLocaleDateString()} - {item.source}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-emerald-400 font-bold text-sm">{formatMoney(item.commissionAmount)}</p>
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${item.commissionPaid ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                            {item.commissionPaid ? 'PAID' : 'PENDING'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                filteredPayouts.length === 0 ? (
                    <div className="bg-surface rounded-xl p-8 text-center border border-white/5">
                        <span className="material-icons-round text-text-muted text-4xl mb-2">payments</span>
                        <p className="text-text-muted text-sm">No payout records yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredPayouts.map((item) => (
                            <div key={item.id} className="bg-surface rounded-xl p-4 border border-white/5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-white font-semibold text-sm">{item.title || 'Commission Payout'}</p>
                                        <p className="text-text-muted text-xs mt-1">{new Date(item.date).toLocaleDateString()}</p>
                                        {item.notes && <p className="text-text-muted text-xs mt-1">{item.notes}</p>}
                                    </div>
                                    <p className="text-blue-300 font-bold text-sm">{formatMoney(item.amount)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
