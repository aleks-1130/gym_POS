import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import Receipt from '../../components/Receipt';
import { withApiBase } from '../../config/api';

export default function PurchaseHistory() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [payments, setPayments] = useState([]);
    const [trainingSessions, setTrainingSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('counter'); // counter, in_app
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const dateInputRef = useRef(null);

    useEffect(() => {
        fetchPaymentHistory();
    }, []);

    const fetchPaymentHistory = async () => {
        try {
            
            

            const [transactionsRes, sessionsRes] = await Promise.all([
                axios.get(withApiBase('/api/members/me/transactions')),
                axios.get(withApiBase('/api/members/me/training-sessions'))
            ]);

            setPayments(transactionsRes.data || []);
            setTrainingSessions(sessionsRes.data || []);
        } catch (error) {
            console.error('Failed to fetch payment history', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-white p-6 text-center">Loading payment history...</div>;

    const cancelledBookings = trainingSessions
        .filter((session) => String(session?.status || '').toUpperCase() === 'CANCELLED')
        .map((session) => ({
            id: `booking-${session.id}`,
            date: session.date,
            type: 'TRAINING_BOOKING',
            method: session.paymentMethod || 'CASH',
            status: 'CANCELLED',
            cashierId: null,
            __purchaseChannel: 'IN_APP_PURCHASE',
            amount: session.price || 0,
            items: [{
                name: `Trainer Booking - ${session?.trainer?.name || 'Trainer'}`,
                quantity: 1,
                unitPrice: session.price || 0
            }]
        }));

    // Merge payment transactions + cancelled training bookings for member visibility.
    const allTransactions = [...payments, ...cancelledBookings].sort((a, b) => new Date(b.date) - new Date(a.date));

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

    const getPurchaseChannel = (transaction) => {
        const normalizedType = String(transaction?.type || '').toUpperCase();
        if (normalizedType === 'IN_APP_PURCHASE') return 'IN_APP_PURCHASE';
        if (Number(transaction?.cashierId || 0) > 0) return 'COUNTER';
        return 'IN_APP_PURCHASE';
    };

    const filteredTransactions = allTransactions.filter((transaction) => {
        const isRemovedStatus = ['VOIDED', 'RETURNED', 'CANCELLED'].includes(transaction.status);
        if (isRemovedStatus) return false;

        const purchaseChannel = transaction.__purchaseChannel || getPurchaseChannel(transaction);
        if (activeTab === 'counter' && purchaseChannel !== 'COUNTER') return false;
        if (activeTab === 'in_app' && purchaseChannel !== 'IN_APP_PURCHASE') return false;

        const transactionDate = toDateInputValue(transaction.date);
        if (selectedDate && transactionDate !== selectedDate) return false;
        return true;
    });

    const totalSpent = payments.reduce((sum, item) => sum + (item.amount || 0), 0);

    const isActionDisabled = () => false;

    const getActionLabel = (item, mobile = false) => mobile ? 'View Receipt' : 'View';

    const getTypeBadge = (item) => {
        if (item.type === 'MEMBERSHIP') return 'bg-blue-500/20 text-blue-300';
        if (item.type === 'TRAINING') return 'bg-green-500/20 text-green-300';
        if (item.type === 'TRAINING_BOOKING') return 'bg-red-500/20 text-red-300';
        if (item.type === 'STORE_SALE') return 'bg-purple-500/20 text-purple-300';
        return 'bg-orange-500/20 text-orange-300';
    };

    const getTypeIcon = (item) => {
        if (item.type === 'MEMBERSHIP') return 'card_membership';
        if (item.type === 'TRAINING') return 'fitness_center';
        if (item.type === 'TRAINING_BOOKING') return 'event_busy';
        if (item.type === 'STORE_SALE') return 'shopping_bag';
        return 'payment';
    };

    const prettifyLabel = (value) => String(value || '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

    const getTypeLabel = (item) => prettifyLabel(item.type);

    const getStatusBadge = (item) => {
        if (item.status === 'PENDING') return 'bg-yellow-500/20 text-yellow-300';
        if (item.status === 'VOIDED' || item.status === 'CANCELLED') return 'bg-red-500/20 text-red-300';
        return 'bg-emerald-500/20 text-emerald-300';
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="space-y-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Payment History</h1>
                    <p className="text-text-muted text-xs sm:text-sm mt-1">View all your transactions and cancelled trainer bookings</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-[10px] sm:text-xs mb-1">Total Spent</p>
                        <p className="text-primary text-lg sm:text-2xl font-bold">{formatPrice(totalSpent)}</p>
                    </div>
                    <div className="bg-surface rounded-xl p-3 sm:p-4 border border-white/5">
                        <p className="text-text-muted text-[10px] sm:text-xs mb-1">Transactions</p>
                        <p className="text-white text-lg sm:text-2xl font-bold">{allTransactions.length}</p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-surface p-3 sm:p-4">
                <div className="space-y-3 sm:grid sm:grid-cols-[minmax(0,1fr)_280px] sm:gap-4 sm:space-y-0 sm:items-end">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Category</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                            {[
                                { value: 'counter', label: 'Counter Purchases' },
                                { value: 'in_app', label: 'In-App Purchases' }
                            ].map((tab) => (
                                <button
                                    key={tab.value}
                                    onClick={() => setActiveTab(tab.value)}
                                    className={`h-9 rounded-lg font-semibold text-[11px] sm:text-xs transition-all border ${activeTab === tab.value
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
                                    onClick={() => {
                                        setSelectedDate('');
                                    }}
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

            {filteredTransactions.length === 0 ? (
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
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Type</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Items</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Method</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Status</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase text-right">Amount</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTransactions.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 sm:px-6 py-4">
                                            <div className="text-white text-sm font-medium">
                                                {new Date(item.date).toLocaleDateString()}
                                            </div>
                                            <div className="text-text-muted text-xs">
                                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getTypeBadge(item)}`}>
                                                <span className="material-icons-round text-xs">{getTypeIcon(item)}</span>
                                                {getTypeLabel(item)}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            {item.items && item.items.length > 0 ? (
                                                <div className="text-white text-sm">
                                                    {item.items.slice(0, 2).map((i, idx) => (
                                                        <div key={idx} className="text-xs">
                                                            {i.quantity}x {prettifyLabel(i.name)}
                                                        </div>
                                                    ))}
                                                    {item.items.length > 2 && (
                                                        <div className="text-text-muted text-xs">+{item.items.length - 2} more</div>
                                                    )}
                                                    {item.type === 'TRAINING_BOOKING' && (
                                                        <div className="text-red-300 text-xs mt-1">This trainer booking was cancelled.</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-text-muted text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className="text-white text-sm">{prettifyLabel(item.method)}</span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getStatusBadge(item)}`}>
                                                {prettifyLabel(item.status || 'COMPLETED')}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <span className="text-primary font-bold text-sm">{formatPrice(item.amount)}</span>
                                        </td>
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
                        {filteredTransactions.map((item) => (
                            <div key={item.id} className="bg-surface rounded-xl p-4 border border-white/5 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getTypeBadge(item)}`}>
                                                <span className="material-icons-round text-xs">{getTypeIcon(item)}</span>
                                                {getTypeLabel(item)}
                                            </span>
                                        </div>
                                        <div className="text-text-muted text-xs">
                                            {new Date(item.date).toLocaleDateString()} - {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-primary font-bold text-lg">{formatPrice(item.amount)}</div>
                                        <div className="text-text-muted text-xs">{prettifyLabel(item.method)}</div>
                                    </div>
                                </div>

                                <div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${getStatusBadge(item)}`}>
                                        {prettifyLabel(item.status || 'COMPLETED')}
                                    </span>
                                </div>

                                {item.items && item.items.length > 0 && (
                                    <div className="pt-2 border-t border-white/5">
                                        <p className="text-text-muted text-xs mb-1">Items:</p>
                                        {item.items.slice(0, 2).map((i, idx) => (
                                            <div key={idx} className="text-white text-xs">
                                                {i.quantity}x {prettifyLabel(i.name)}
                                            </div>
                                        ))}
                                        {item.items.length > 2 && (
                                            <div className="text-text-muted text-xs">+{item.items.length - 2} more</div>
                                        )}
                                        {item.type === 'TRAINING_BOOKING' && (
                                            <div className="text-red-300 text-xs mt-1">This trainer booking was cancelled.</div>
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
                    const itemName = selectedReceipt.type === 'MEMBERSHIP'
                        ? 'Membership Fee'
                        : selectedReceipt.type === 'TRAINING'
                            ? 'Training Session'
                            : selectedReceipt.type === 'STORE_SALE'
                                ? 'Store Purchase'
                                : 'Payment';

                    receiptItems = [{
                        name: itemName,
                        quantity: 1,
                        price: selectedReceipt.amount
                    }];
                }

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
                                member={user}
                                cashierName={selectedReceipt.cashier?.name}
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
