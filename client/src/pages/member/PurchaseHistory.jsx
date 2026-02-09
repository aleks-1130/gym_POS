import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export default function PurchaseHistory() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [payments, setPayments] = useState([]);
    const [trainingSessions, setTrainingSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, membership, training, app_purchase

    useEffect(() => {
        fetchPaymentHistory();
    }, []);

    const fetchPaymentHistory = async () => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        try {
            const paymentsRes = await axios.get('http://localhost:5000/api/payments', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setPayments(paymentsRes.data || []);
        } catch (error) {
            console.error("Failed to fetch payments", error);
            setPayments([]);
        }

        try {
            const sessionsRes = await axios.get('http://localhost:5000/api/members/training-sessions', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setTrainingSessions(sessionsRes.data || []);
        } catch (error) {
            // Training sessions may be forbidden for some roles; don't block payments
            console.warn("Failed to fetch training sessions", error);
            setTrainingSessions([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-white p-6 text-center">Loading payment history...</div>;

    // Combine all transactions for filtering
    const mapPaymentType = (payment) => {
        const normalized = String(payment.type || '').toUpperCase();
        if (normalized === 'IN_APP_PURCHASE') return 'app_purchase';
        if (normalized === 'MEMBERSHIP') return 'membership';
        if (normalized === 'TRAINING') return 'training';
        return 'other';
    };

    const paymentsWithType = payments
        .map(p => ({ ...p, type: mapPaymentType(p), rawType: p.type, category: 'Payment' }))
        .filter(p => p.type !== 'training');

    const allTransactions = [
        ...paymentsWithType,
        ...trainingSessions.map(s => ({ ...s, type: 'training', category: 'Training Session' }))
    ].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    const filteredTransactions = activeTab === 'all' 
        ? allTransactions 
        : activeTab === 'membership'
        ? paymentsWithType.filter(p => p.type === 'membership')
        : activeTab === 'app_purchase'
        ? paymentsWithType.filter(p => p.type === 'app_purchase')
        : trainingSessions;

    const totalSpent = allTransactions.reduce((sum, item) => sum + (item.amount || item.price || 0), 0);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="space-y-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Payment History</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">Membership & training session invoices</p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Total Spent</p>
                        <p className="text-lg sm:text-2xl font-bold text-primary">{formatPrice(totalSpent)}</p>
                    </div>
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Transactions</p>
                        <p className="text-lg sm:text-2xl font-bold text-emerald-400">{filteredTransactions.length}</p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 bg-surface rounded-xl p-1 border border-white/5">
                {[
                    { id: 'all', label: 'All', icon: 'receipt_long' },
                    { id: 'membership', label: 'Membership', icon: 'card_membership' },
                    { id: 'app_purchase', label: 'Shop', icon: 'shopping_bag' },
                    { id: 'training', label: 'Training', icon: 'person' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1 ${
                            activeTab === tab.id
                                ? 'bg-primary text-background'
                                : 'text-text-muted hover:text-white'
                        }`}
                    >
                        <span className="material-icons-round text-base hidden sm:inline">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Transactions List */}
            {filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                    <span className="material-icons-round text-4xl text-text-muted opacity-50 block mb-2">receipt_long</span>
                    <p className="text-text-muted">No transactions found</p>
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
                                    <th className="px-4 sm:px-6 py-3">Description</th>
                                    <th className="px-4 sm:px-6 py-3">Amount</th>
                                    <th className="px-4 sm:px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTransactions.map((item, idx) => (
                                    <tr key={`${item.type}-${item.id}-${idx}`} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 sm:px-6 py-4 text-white font-medium">
                                            <div className="text-sm">{new Date(item.date || item.createdAt).toLocaleDateString()}</div>
                                            <div className="text-text-muted text-xs">{new Date(item.date || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`material-icons-round text-base ${
                                                    item.type === 'membership' ? 'text-blue-400' :
                                                    item.type === 'app_purchase' ? 'text-emerald-400' : 'text-purple-400'
                                                }`}>
                                                    {item.type === 'membership' ? 'card_membership' :
                                                     item.type === 'app_purchase' ? 'shopping_bag' : 'person'}
                                                </span>
                                                <span className="bg-white/10 text-text-secondary px-2.5 py-1 rounded text-xs font-bold uppercase">
                                                    {item.type === 'app_purchase' ? 'IN APP PURCHASE' : item.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-text-secondary">
                                            {item.type === 'membership'
                                                ? item.method
                                                : item.type === 'app_purchase'
                                                ? `Paid via ${item.method || 'N/A'}`
                                                : `Session with ${item.trainerName || 'Trainer'}`
                                            }
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-white font-bold">{formatPrice(item.amount || item.price)}</td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                                                item.type === 'training' && item.status === 'completed' 
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : item.type === 'training' && item.status === 'scheduled'
                                                    ? 'bg-blue-500/20 text-blue-300'
                                                    : 'bg-yellow-500/20 text-yellow-300'
                                            }`}>
                                                {item.type === 'training' ? item.status : 'Completed'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                        {filteredTransactions.map((item, idx) => (
                            <div key={`${item.type}-${item.id}-${idx}`} className="bg-surface rounded-xl p-4 border border-white/5">
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <div>
                                        <p className="font-bold text-white text-sm">{new Date(item.date || item.createdAt).toLocaleDateString()}</p>
                                        <p className="text-text-muted text-xs">{new Date(item.date || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`material-icons-round text-base ${
                                            item.type === 'membership' ? 'text-blue-400' :
                                            item.type === 'app_purchase' ? 'text-emerald-400' : 'text-purple-400'
                                        }`}>
                                            {item.type === 'membership' ? 'card_membership' :
                                             item.type === 'app_purchase' ? 'shopping_bag' : 'person'}
                                        </span>
                                        <span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold uppercase flex-shrink-0">
                                            {item.type === 'app_purchase' ? 'IN APP PURCHASE' : item.type}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-start gap-3 mb-3">
                                    <div>
                                        <p className="text-text-muted text-xs mb-1">Description</p>
                                        <p className="text-white text-sm font-medium">
                                            {item.type === 'membership'
                                                ? item.method
                                                : item.type === 'app_purchase'
                                                ? `Paid via ${item.method || 'N/A'}`
                                                : `Session with ${item.trainerName || 'Trainer'}`
                                            }
                                    </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-text-muted text-xs mb-1">Amount</p>
                                        <p className="text-primary text-lg font-bold">{formatPrice(item.amount || item.price)}</p>
                                    </div>
                                </div>

                                {item.type === 'training' && (
                                    <div className="pt-3 border-t border-white/5">
                                        <span className={`px-2.5 py-1 rounded text-xs font-bold inline-block ${
                                            item.status === 'completed' 
                                                ? 'bg-green-500/20 text-green-300'
                                                : item.status === 'scheduled'
                                                ? 'bg-blue-500/20 text-blue-300'
                                                : 'bg-yellow-500/20 text-yellow-300'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
