import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export default function PurchaseHistory() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/payments');
            setHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch history");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-white p-6 text-center">Loading history...</div>;

    const totalSpent = history.reduce((sum, pay) => sum + pay.amount, 0);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="space-y-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Purchase History</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">Your transaction records</p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Total Spent</p>
                        <p className="text-lg sm:text-2xl font-bold text-primary">{formatPrice(totalSpent)}</p>
                    </div>
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Transactions</p>
                        <p className="text-lg sm:text-2xl font-bold text-emerald-400">{history.length}</p>
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            {history.length === 0 ? (
                <div className="text-center py-12">
                    <span className="material-icons-round text-4xl text-text-muted opacity-50 block mb-2">receipt_long</span>
                    <p className="text-text-muted">No transactions yet</p>
                </div>
            ) : (
                <div className="space-y-2 sm:space-y-3">
                    {/* Desktop Table */}
                    <div className="hidden sm:block bg-surface rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 sm:px-6 py-3">Date</th>
                                    <th className="px-4 sm:px-6 py-3">Type</th>
                                    <th className="px-4 sm:px-6 py-3">Amount</th>
                                    <th className="px-4 sm:px-6 py-3">Method</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {history.map(pay => (
                                    <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 sm:px-6 py-4 text-white font-medium">
                                            <div className="text-sm">{new Date(pay.date).toLocaleDateString()}</div>
                                            <div className="text-text-muted text-xs">{new Date(pay.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className="bg-white/10 text-text-secondary px-2.5 py-1 rounded text-xs font-bold">
                                                {pay.type}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-white font-bold">{formatPrice(pay.amount)}</td>
                                        <td className="px-4 sm:px-6 py-4 text-text-secondary">{pay.method}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                        {history.map(pay => (
                            <div key={pay.id} className="bg-surface rounded-xl p-4 border border-white/5">
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <div>
                                        <p className="font-bold text-white text-sm">{new Date(pay.date).toLocaleDateString()}</p>
                                        <p className="text-text-muted text-xs">{new Date(pay.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold flex-shrink-0">
                                        {pay.type}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-text-muted text-xs mb-1">Payment Method</p>
                                        <p className="text-white text-sm font-medium">{pay.method}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-text-muted text-xs mb-1">Amount</p>
                                        <p className="text-primary text-lg font-bold">{formatPrice(pay.amount)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
