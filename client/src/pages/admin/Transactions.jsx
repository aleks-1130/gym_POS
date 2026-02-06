import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function Transactions() {
    const { formatPrice } = useCurrency();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/payments');
            setHistory(res.data);
        } catch (error) {
            console.error('Failed to fetch history');
        } finally {
            setLoading(false);
        }
    };

    const renderStatusBadge = (status) => {
        const value = status || 'COMPLETED';
        const base = "px-2 py-1 rounded text-xs font-bold";
        if (value === 'VOIDED') return <span className={`${base} bg-red-500/10 text-red-400 border border-red-500/20`}>VOIDED</span>;
        if (value === 'RETURNED') return <span className={`${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`}>RETURNED</span>;
        if (value === 'PENDING') return <span className={`${base} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>PENDING</span>;
        return <span className={`${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>COMPLETED</span>;
    };

    if (loading) return <div className="text-white p-6">Loading transactions...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Transaction History</h1>
                    <p className="text-text-muted text-sm">All POS transactions</p>
                </div>
                <button
                    onClick={fetchHistory}
                    className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors"
                >
                    <span className="material-icons-round">refresh</span> Refresh
                </button>
            </div>

            <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-text-secondary">
                    <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4">Member</th>
                            <th className="px-6 py-4">Cashier</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {history.length === 0 && (
                            <tr><td colSpan="8" className="p-6 text-center text-text-muted">No transactions found.</td></tr>
                        )}
                        {history.map(pay => (
                            <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 text-white font-medium">{new Date(pay.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(pay.date).toLocaleTimeString()}</span></td>
                                <td className="px-6 py-4"><span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold">{pay.type}</span></td>
                                <td className="px-6 py-4 text-white font-bold">{formatPrice(pay.amount)}</td>
                                <td className="px-6 py-4 text-text-secondary">{pay.method}</td>
                                <td className="px-6 py-4 text-white">{pay.member ? `${pay.member.firstName} ${pay.member.lastName}` : 'Walk-in'}</td>
                                <td className="px-6 py-4 text-white">{pay.cashier?.name || 'N/A'}</td>
                                <td className="px-6 py-4">{renderStatusBadge(pay.status)}</td>
                                <td className="px-6 py-4">
                                    <a
                                        href={`/pos/transactions/${pay.id}`}
                                        className="text-xs font-bold px-3 py-1 rounded-lg border border-white/10 text-white hover:bg-white/10"
                                    >
                                        View Transaction
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
