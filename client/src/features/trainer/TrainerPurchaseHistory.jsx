import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import Receipt from '../../components/Receipt';
import TrainerPageHeader from './components/TrainerPageHeader';

export default function TrainerPurchaseHistory() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('counter');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const dateInputRef = useRef(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                
                const res = await axios.get('/api/members/orders');
                setOrders(res.data || []);
            } catch (e) {
                console.error('Failed to fetch trainer orders', e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const toDateInputValue = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return localDate.toISOString().slice(0, 10);
    };

    const openDatePicker = () => {
        const input = dateInputRef.current;
        if (!input) return;
        if (typeof input.showPicker === 'function') input.showPicker();
        else input.click();
    };

    const formatSelectedDateLabel = (value) => {
        if (!value) return 'Select date';
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return 'Select date';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const type = String(order?.type || '').toUpperCase();
            const channel = type === 'IN_APP_PURCHASE' ? 'IN_APP_PURCHASE' : 'COUNTER';
            if (activeTab === 'counter' && channel !== 'COUNTER') return false;
            if (activeTab === 'in_app' && channel !== 'IN_APP_PURCHASE') return false;
            const orderDate = toDateInputValue(order.date);
            if (selectedDate && orderDate !== selectedDate) return false;
            return true;
        });
    }, [orders, activeTab, selectedDate]);

    const totalSpent = useMemo(() => orders.reduce((sum, o) => sum + Number(o.amount || 0), 0), [orders]);

    const getMethodLabel = (method) => {
        const normalized = String(method || '').toUpperCase();
        if (normalized === 'COMMISSION_DEDUCTION') return 'Commission Deduction';
        if (normalized === 'GCASH') return 'GCash';
        if (normalized === 'MAYA') return 'Maya';
        if (normalized === 'CARD') return 'Card';
        if (normalized === 'CASH') return 'Cash';
        return method || '-';
    };

    const getStatusBadge = (status) => {
        const normalized = String(status || 'COMPLETED').toUpperCase();
        if (normalized === 'PENDING') return 'bg-yellow-500/20 text-yellow-300';
        if (normalized === 'VOIDED' || normalized === 'CANCELLED') return 'bg-red-500/20 text-red-300';
        return 'bg-emerald-500/20 text-emerald-300';
    };

    const isActionDisabled = () => false;
    const getActionLabel = (_item, mobile = false) => mobile ? 'View Receipt' : 'View';

    if (loading) return <div className="text-white p-6 text-center">Loading purchase history...</div>;

    return (
        <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
            <div className="space-y-3">
                <TrainerPageHeader
                    title="Purchase History"
                    subtitle="All your trainer shop transactions"
                    icon="receipt_long"
                />

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

            <div className="rounded-xl border border-white/10 bg-surface p-3 sm:p-4">
                <div className="space-y-3 sm:grid sm:grid-cols-[minmax(0,1fr)_280px] sm:gap-4 sm:space-y-0 sm:items-end">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Category</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                            {[
                                { key: 'counter', label: 'Counter Purchases' },
                                { key: 'in_app', label: 'In-App Purchases' }
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`h-9 rounded-lg font-semibold text-[11px] sm:text-xs transition-all border ${activeTab === tab.key
                                        ? 'bg-primary text-background border-primary'
                                        : 'bg-background/40 text-text-muted hover:text-white border-white/10'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Calendar</p>
                        <div className="mt-1.5 flex items-center gap-2">
                            <input
                                ref={dateInputRef}
                                type="date"
                                value={selectedDate}
                                onChange={(event) => setSelectedDate(event.target.value)}
                                className="sr-only"
                                tabIndex={-1}
                                aria-hidden="true"
                            />
                            <button
                                type="button"
                                onClick={openDatePicker}
                                className="h-9 flex-1 bg-background/40 border border-white/10 rounded-lg px-2.5 text-xs outline-none focus:border-primary text-left flex items-center gap-2"
                                title="Filter date"
                            >
                                <span className="material-icons-round text-sm text-text-muted">event</span>
                                <span className={selectedDate ? 'text-white' : 'text-text-muted'}>
                                    {formatSelectedDateLabel(selectedDate)}
                                </span>
                            </button>
                            {selectedDate && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate('')}
                                    className="h-9 w-9 rounded-lg border border-white/10 bg-background/40 text-text-secondary hover:text-white hover:bg-white/5 flex items-center justify-center"
                                    title="Clear date filter"
                                >
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
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
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase text-right">Actions</th>
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
                                                    {item.items.some((i) => i.intendedForSessionMaterial) && (
                                                        <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                                                            Session Material
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-text-muted text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4"><span className="text-white text-sm">{getMethodLabel(item.method)}</span></td>
                                        <td className="px-4 sm:px-6 py-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getStatusBadge(item.status)}`}>{item.status || 'COMPLETED'}</span></td>
                                        <td className="px-4 sm:px-6 py-4 text-right"><span className="text-primary font-bold text-sm">{formatPrice(item.amount)}</span></td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedReceipt(item)}
                                                disabled={isActionDisabled(item)}
                                                className="text-primary hover:text-orange-400 disabled:text-text-muted disabled:cursor-not-allowed font-medium text-xs flex items-center gap-1 ml-auto transition-colors"
                                            >
                                                <span className="material-icons-round text-sm">receipt</span>
                                                {getActionLabel(item)}
                                            </button>
                                        </td>
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
                                        <div className="text-text-muted text-xs mt-1">Method: <span className="text-white">{getMethodLabel(item.method)}</span></div>
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
                                            <div key={i.id || `${item.id}-${i.name}-${i.quantity}`} className="text-white text-xs">{i.quantity}x {i.name}</div>
                                        ))}
                                        {item.items.some((i) => i.intendedForSessionMaterial) && (
                                            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                                                Session Material
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="pt-2 border-t border-white/5">
                                    <button
                                        onClick={() => setSelectedReceipt(item)}
                                        disabled={isActionDisabled(item)}
                                        className="text-primary hover:text-orange-400 disabled:text-text-muted disabled:cursor-not-allowed font-medium text-xs flex items-center gap-1 transition-colors"
                                    >
                                        <span className="material-icons-round text-sm">receipt</span>
                                        {getActionLabel(item, true)}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedReceipt && (() => {
                let receiptItems = selectedReceipt.items || [];

                receiptItems = receiptItems.map((item) => ({
                    ...item,
                    price: item.unitPrice || item.price || 0
                }));

                if (receiptItems.length === 0 && selectedReceipt.amount) {
                    const itemName = selectedReceipt.type === 'IN_APP_PURCHASE'
                        ? 'In-App Purchase'
                        : selectedReceipt.type === 'STORE_SALE'
                            ? 'Counter Purchase'
                            : 'Purchase';

                    receiptItems = [{
                        name: itemName,
                        quantity: 1,
                        price: selectedReceipt.amount
                    }];
                }

                const grossTotal = receiptItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
                const discountRate = Number(selectedReceipt.discount || 0);
                const discountAmount = Number((grossTotal * (discountRate / 100)).toFixed(2));

                return (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
                        <div className="relative my-8">
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                            >
                                <span className="material-icons-round">close</span>
                            </button>

                            <Receipt
                                transaction={selectedReceipt}
                                items={receiptItems}
                                member={user || null}
                                cashierName={selectedReceipt.cashier?.name}
                                discount={discountAmount || 0}
                                paymentDetails={{
                                    method: selectedReceipt.method,
                                    tendered: selectedReceipt.cashTendered,
                                    change: selectedReceipt.changeDue
                                }}
                            />
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
