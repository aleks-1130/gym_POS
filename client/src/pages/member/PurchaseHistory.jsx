import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import Receipt from '../../components/Receipt';

export default function PurchaseHistory() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, membership, training
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    useEffect(() => {
        fetchPaymentHistory();
    }, []);

    const fetchPaymentHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/members/me/transactions', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('[PURCHASE HISTORY] Fetched transactions:', res.data.length);
            console.log('[PURCHASE HISTORY] First transaction:', res.data[0]);
            setPayments(res.data);
        } catch (error) {
            console.error("Failed to fetch payment history", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-white p-6 text-center">Loading payment history...</div>;

    // All transactions from API
    const allTransactions = payments.sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredTransactions = activeTab === 'all'
        ? allTransactions
        : activeTab === 'membership'
            ? allTransactions.filter(p => p.type === 'MEMBERSHIP')
            : allTransactions.filter(p => p.type === 'TRAINING');

    const totalSpent = allTransactions.reduce((sum, item) => sum + (item.amount || 0), 0);

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
                    { id: 'training', label: 'Training', icon: 'person' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1 ${activeTab === tab.id
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
                                    <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTransactions.map((item, idx) => (
                                    <tr key={`${item.type}-${item.id}-${idx}`} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 sm:px-6 py-4 text-white font-medium">
                                            <div className="text-sm">{new Date(item.date).toLocaleDateString()}</div>
                                            <div className="text-text-muted text-xs">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`material-icons-round text-base ${item.type === 'MEMBERSHIP' ? 'text-green-400' :
                                                    item.type === 'TRAINING' ? 'text-purple-400' :
                                                        item.type === 'STORE_SALE' ? 'text-blue-400' :
                                                            'text-orange-400'
                                                    }`}>
                                                    {item.type === 'MEMBERSHIP' ? 'card_membership' :
                                                        item.type === 'TRAINING' ? 'person' :
                                                            item.type === 'STORE_SALE' ? 'shopping_bag' : 'receipt'}
                                                </span>
                                                <span className="bg-white/10 text-text-secondary px-2.5 py-1 rounded text-xs font-bold">
                                                    {item.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-text-secondary">
                                            <div className="text-sm">{item.method}</div>
                                            {item.items && item.items.length > 0 && (
                                                <div className="text-xs text-text-muted mt-1">
                                                    {item.items.slice(0, 2).map((i, idx) => (
                                                        <div key={idx}>{i.quantity}x {i.name}</div>
                                                    ))}
                                                    {item.items.length > 2 && <div>+{item.items.length - 2} more</div>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-white font-bold">{formatPrice(item.amount)}</td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${item.status === 'COMPLETED' ? 'bg-green-500/20 text-green-300' :
                                                item.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                                                    'bg-red-500/20 text-red-300'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedReceipt(item)}
                                                className="text-primary hover:text-orange-400 font-medium text-xs flex items-center gap-1 ml-auto transition-colors"
                                            >
                                                <span className="material-icons-round text-sm">receipt</span>
                                                View
                                            </button>
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
                                        <p className="font-bold text-white text-sm">{new Date(item.date).toLocaleDateString()}</p>
                                        <p className="text-text-muted text-xs">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`material-icons-round text-base ${item.type === 'MEMBERSHIP' ? 'text-green-400' :
                                            item.type === 'TRAINING' ? 'text-purple-400' :
                                                item.type === 'STORE_SALE' ? 'text-blue-400' :
                                                    'text-orange-400'
                                            }`}>
                                            {item.type === 'MEMBERSHIP' ? 'card_membership' :
                                                item.type === 'TRAINING' ? 'person' :
                                                    item.type === 'STORE_SALE' ? 'shopping_bag' : 'receipt'}
                                        </span>
                                        <span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold flex-shrink-0">
                                            {item.type}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-start gap-3 mb-3">
                                    <div className="flex-1">
                                        <p className="text-text-muted text-xs mb-1">Payment Method</p>
                                        <p className="text-white text-sm font-medium">{item.method}</p>
                                        {item.items && item.items.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {item.items.slice(0, 2).map((i, idx) => (
                                                    <p key={idx} className="text-xs text-text-muted">{i.quantity}x {i.name}</p>
                                                ))}
                                                {item.items.length > 2 && <p className="text-xs text-text-muted italic">+{item.items.length - 2} more items</p>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-text-muted text-xs mb-1">Amount</p>
                                        <p className="text-primary text-lg font-bold">{formatPrice(item.amount)}</p>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                                    <span className={`px-2.5 py-1 rounded text-xs font-bold inline-block ${item.status === 'COMPLETED' ? 'bg-green-500/20 text-green-300' :
                                        item.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                                            'bg-red-500/20 text-red-300'
                                        }`}>
                                        {item.status}
                                    </span>
                                    <button
                                        onClick={() => setSelectedReceipt(item)}
                                        className="text-primary hover:text-orange-400 font-medium text-xs flex items-center gap-1 transition-colors"
                                    >
                                        <span className="material-icons-round text-sm">receipt</span>
                                        View Receipt
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Receipt Modal */}
            {selectedReceipt && (() => {
                console.log('[RECEIPT MODAL] Selected receipt:', selectedReceipt);

                // For transactions without items (membership, training), create a synthetic item
                let receiptItems = selectedReceipt.items || [];
                console.log('[RECEIPT MODAL] Original items:', receiptItems);

                // Map unitPrice to price for Receipt component compatibility
                receiptItems = receiptItems.map(item => ({
                    ...item,
                    price: item.unitPrice || item.price || 0
                }));

                if (receiptItems.length === 0 && selectedReceipt.amount) {
                    // Create a synthetic item based on transaction type
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
                    console.log('[RECEIPT MODAL] Created synthetic items:', receiptItems);
                }

                console.log('[RECEIPT MODAL] Final items to pass:', receiptItems);

                return (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
                        <div className="relative my-8">
                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                            >
                                <span className="material-icons-round">close</span>
                            </button>

                            {/* Receipt Component */}
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
