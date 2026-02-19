import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function TrainerPurchaseHistory() {
    const { formatPrice } = useCurrency();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/members/orders', {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                setOrders(res.data || []);
            } catch (e) {
                console.error('Failed to fetch trainer orders', e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        if (activeTab === 'all') return orders;
        return orders.filter((o) => String(o.status || '').toUpperCase() === activeTab);
    }, [orders, activeTab]);

    const totalSpent = useMemo(() => orders.reduce((sum, o) => sum + Number(o.amount || 0), 0), [orders]);

    const getStatusBadge = (status) => {
        const normalized = String(status || 'COMPLETED').toUpperCase();
        if (normalized === 'PENDING') return 'bg-yellow-500/20 text-yellow-300';
        if (normalized === 'VOIDED' || normalized === 'CANCELLED') return 'bg-red-500/20 text-red-300';
        return 'bg-emerald-500/20 text-emerald-300';
    };

    if (loading) return <div className="text-white p-6 text-center">Loading purchase history...</div>;

    return (
        <div className="space-y-4 sm:space-y-6 px-4 pb-24 max-w-5xl mx-auto">
            <div className="space-y-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Trainer Purchase History</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">All your Trainer Shop transactions</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-[10px] sm:text-xs mb-1">Total Spent</p>
                        <p className="text-primary text-lg sm:text-2xl font-bold">{formatPrice(totalSpent)}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-[10px] sm:text-xs mb-1">Transactions</p>
                        <p className="text-white text-lg sm:text-2xl font-bold">{orders.length}</p>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                    { key: 'all', label: 'All' },
                    { key: 'COMPLETED', label: 'Completed' },
                    { key: 'PENDING', label: 'Pending' }
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === tab.key ? 'bg-primary text-background' : 'bg-surface text-text-muted hover:text-white border border-white/5'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {filteredOrders.length === 0 ? (
                <div className="bg-surface rounded-xl p-8 text-center border border-white/5">
                    <span className="material-icons-round text-text-muted text-4xl mb-2">receipt_long</span>
                    <p className="text-text-muted text-sm">No transactions found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="hidden sm:block bg-surface rounded-xl border border-white/5 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr className="text-left">
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Date</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Items</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Method</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Status</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredOrders.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 sm:px-6 py-4">
                                            <div className="text-white text-sm font-medium">{new Date(item.date).toLocaleDateString()}</div>
                                            <div className="text-text-muted text-xs">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            {Array.isArray(item.items) && item.items.length > 0 ? (
                                                <div className="text-white text-sm">
                                                    {item.items.slice(0, 2).map((i) => (
                                                        <div key={i.id} className="text-xs">{i.quantity}x {i.name}</div>
                                                    ))}
                                                    {item.items.length > 2 && <div className="text-text-muted text-xs">+{item.items.length - 2} more</div>}
                                                </div>
                                            ) : (
                                                <span className="text-text-muted text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4"><span className="text-white text-sm">{item.method}</span></td>
                                        <td className="px-4 sm:px-6 py-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getStatusBadge(item.status)}`}>{item.status || 'COMPLETED'}</span></td>
                                        <td className="px-4 sm:px-6 py-4 text-right"><span className="text-primary font-bold text-sm">{formatPrice(item.amount)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="sm:hidden space-y-3">
                        {filteredOrders.map((item) => (
                            <div key={item.id} className="bg-surface rounded-xl p-4 border border-white/5 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="text-text-muted text-xs">{new Date(item.date).toLocaleDateString()} - {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        <div className="text-text-muted text-xs mt-1">Method: <span className="text-white">{item.method}</span></div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-primary font-bold text-lg">{formatPrice(item.amount)}</div>
                                    </div>
                                </div>
                                <div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${getStatusBadge(item.status)}`}>{item.status || 'COMPLETED'}</span>
                                </div>
                                {Array.isArray(item.items) && item.items.length > 0 && (
                                    <div className="pt-2 border-t border-white/5">
                                        {item.items.slice(0, 3).map((i) => (
                                            <div key={i.id} className="text-white text-xs">{i.quantity}x {i.name}</div>
                                        ))}
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
