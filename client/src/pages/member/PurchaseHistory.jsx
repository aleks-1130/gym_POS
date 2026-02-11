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
                    <p className="text-text-muted text-xs sm:text-sm mt-1">View all your transactions and receipts</p>
                </div>

                {/* Summary Cards */}
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

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {['all', 'membership', 'training'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === tab
                            ? 'bg-primary text-background'
                            : 'bg-surface text-text-muted hover:text-white border border-white/5'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Transactions List */}
            {filteredTransactions.length === 0 ? (
                <div className="bg-surface rounded-xl p-8 text-center border border-white/5">
                    <span className="material-icons-round text-text-muted text-4xl mb-2">receipt_long</span>
                    <p className="text-text-muted text-sm">No transactions found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Desktop Table View */}
                    <div className="hidden sm:block bg-surface rounded-xl border border-white/5 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr className="text-left">
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Date</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Type</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Items</th>
                                    <th className="px-4 sm:px-6 py-3 text-text-muted text-xs font-bold uppercase">Method</th>
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
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${item.type === 'MEMBERSHIP' ? 'bg-blue-500/20 text-blue-300' :
                                                item.type === 'TRAINING' ? 'bg-green-500/20 text-green-300' :
                                                    item.type === 'STORE_SALE' ? 'bg-purple-500/20 text-purple-300' :
                                                        'bg-orange-500/20 text-orange-300'
                                                }`}>
                                                <span className="material-icons-round text-xs">
                                                    {item.type === 'MEMBERSHIP' ? 'card_membership' :
                                                        item.type === 'TRAINING' ? 'fitness_center' :
                                                            item.type === 'STORE_SALE' ? 'shopping_bag' : 'payment'}
                                                </span>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            {item.items && item.items.length > 0 ? (
                                                <div className="text-white text-sm">
                                                    {item.items.slice(0, 2).map((i, idx) => (
                                                        <div key={idx} className="text-xs">
                                                            {i.quantity}x {i.name}
                                                        </div>
                                                    ))}
                                                    {item.items.length > 2 && (
                                                        <div className="text-text-muted text-xs">+{item.items.length - 2} more</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-text-muted text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className="text-white text-sm">{item.method}</span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <span className="text-primary font-bold text-sm">{formatPrice(item.amount)}</span>
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

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-3">
                        {filteredTransactions.map((item) => (
                            <div key={item.id} className="bg-surface rounded-xl p-4 border border-white/5 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${item.type === 'MEMBERSHIP' ? 'bg-blue-500/20 text-blue-300' :
                                                item.type === 'TRAINING' ? 'bg-green-500/20 text-green-300' :
                                                    item.type === 'STORE_SALE' ? 'bg-purple-500/20 text-purple-300' :
                                                        'bg-orange-500/20 text-orange-300'
                                                }`}>
                                                <span className="material-icons-round text-xs">
                                                    {item.type === 'MEMBERSHIP' ? 'card_membership' :
                                                        item.type === 'TRAINING' ? 'fitness_center' :
                                                            item.type === 'STORE_SALE' ? 'shopping_bag' : 'payment'}
                                                </span>
                                                {item.type}
                                            </span>
                                        </div>
                                        <div className="text-text-muted text-xs">
                                            {new Date(item.date).toLocaleDateString()} • {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-primary font-bold text-lg">{formatPrice(item.amount)}</div>
                                        <div className="text-text-muted text-xs">{item.method}</div>
                                    </div>
                                </div>

                                {item.items && item.items.length > 0 && (
                                    <div className="pt-2 border-t border-white/5">
                                        <p className="text-text-muted text-xs mb-1">Items:</p>
                                        {item.items.slice(0, 2).map((i, idx) => (
                                            <div key={idx} className="text-white text-xs">
                                                {i.quantity}x {i.name}
                                            </div>
                                        ))}
                                        {item.items.length > 2 && (
                                            <div className="text-text-muted text-xs">+{item.items.length - 2} more</div>
                                        )}
                                    </div>
                                )}

                                <div className="pt-2 border-t border-white/5">
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
