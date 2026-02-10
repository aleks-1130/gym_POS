import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import Receipt from '../../components/Receipt';
import { useCurrency } from '../../context/CurrencyContext';

export default function TransactionDetail() {
    const { id } = useParams();
    const { formatPrice } = useCurrency();
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [voidModalOpen, setVoidModalOpen] = useState(false);
    const [completeModalOpen, setCompleteModalOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [cashTendered, setCashTendered] = useState('');
    const [returnQuantities, setReturnQuantities] = useState({});
    const [actionLoading, setActionLoading] = useState(false);
    const receiptRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => receiptRef.current,
    });

    useEffect(() => {
        fetchPayment();
    }, [id]);

    const fetchPayment = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/payments/${id}`);
            setPayment(res.data);
        } catch (e) {
            console.error('Failed to fetch payment', e);
        } finally {
            setLoading(false);
        }
    };

    const openReturnModal = () => {
        setPin('');
        setReturnQuantities({});
        setReturnModalOpen(true);
    };

    const openVoidModal = () => {
        setPin('');
        setVoidModalOpen(true);
    };

    const closeModals = () => {
        setReturnModalOpen(false);
        setVoidModalOpen(false);
        setCompleteModalOpen(false);
        setPin('');
        setCashTendered('');
    };

    const handleReturnSubmit = async () => {
        if (!payment) return;
        const items = payment.items
            .map((item) => ({
                itemId: item.id,
                quantity: Number(returnQuantities[item.id]) || 0
            }))
            .filter((item) => item.quantity > 0);

        if (items.length === 0) {
            return alert('Select at least one item to return.');
        }

        setActionLoading(true);
        try {
            const res = await axios.post(`http://localhost:5000/api/payments/${payment.id}/return-items`, {
                pin,
                items
            });
            setPayment(res.data);
            closeModals();
        } catch (e) {
            alert(e.response?.data?.error || 'Return failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoidSubmit = async () => {
        if (!payment) return;
        setActionLoading(true);
        try {
            const res = await axios.post(`http://localhost:5000/api/payments/${payment.id}/void`, { pin });
            setPayment(res.data);
            closeModals();
        } catch (e) {
            alert(e.response?.data?.error || 'Void failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCompleteSubmit = async () => {
        if (!payment) return;
        if (!cashTendered || Number(cashTendered) < payment.amount) {
            return alert(`Please enter at least ${formatPrice(payment.amount)}`);
        }

        setActionLoading(true);
        try {
            // No PIN needed for completing a sale, just cash
            const res = await axios.post(`http://localhost:5000/api/payments/${payment.id}/complete`, {
                cashTendered: Number(cashTendered)
            });
            alert("Payment Completed!");
            fetchPayment(); // Refresh
            closeModals();
        } catch (e) {
            alert(e.response?.data?.error || 'Completion failed');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="text-white p-8">Loading transaction...</div>;
    }

    if (!payment) {
        return <div className="text-white p-8">Transaction not found.</div>;
    }

    const receiptItems = payment.items.map((item) => ({
        name: item.name,
        price: item.unitPrice,
        quantity: item.quantity
    }));

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Transaction #{payment.id}</h1>
                    <p className="text-text-muted">{new Date(payment.date).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20"
                    >
                        Print Receipt
                    </button>
                    {payment.status === 'PENDING' && (
                        <button
                            onClick={() => setCompleteModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-green-500 text-white font-bold shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all animation-pulse"
                        >
                            Complete Payment
                        </button>
                    )}
                    <button
                        onClick={openReturnModal}
                        disabled={payment.status === 'VOIDED'}
                        className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-40"
                    >
                        Return Items
                    </button>
                    <button
                        onClick={openVoidModal}
                        disabled={payment.status !== 'COMPLETED'}
                        className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40"
                    >
                        Void Transaction
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Items</h3>
                    <div className="space-y-2">
                        {payment.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                                <div className="min-w-0">
                                    <p className="text-white font-semibold truncate">{item.name}</p>
                                    <p className="text-xs text-text-muted">
                                        {item.quantity} x {formatPrice(item.unitPrice)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">{formatPrice(item.unitPrice * item.quantity)}</p>
                                    {item.returnedQuantity > 0 && (
                                        <p className="text-[10px] text-amber-400">Returned: {item.returnedQuantity}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-5 bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Summary</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-text-muted">
                            <span>Member</span>
                            <span className="text-white">{payment.member ? `${payment.member.firstName} ${payment.member.lastName}` : 'Walk-in'}</span>
                        </div>
                        <div className="flex justify-between text-text-muted">
                            <span>Cashier</span>
                            <span className="text-white">{payment.cashier?.name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-text-muted">
                            <span>Method</span>
                            <span className="text-white">{payment.method}</span>
                        </div>
                        {payment.method === 'CASH' && (
                            <>
                                <div className="flex justify-between text-text-muted">
                                    <span>Cash Tendered</span>
                                    <span className="text-white">{formatPrice(payment.cashTendered || 0)}</span>
                                </div>
                                <div className="flex justify-between text-text-muted">
                                    <span>Change Due</span>
                                    <span className="text-white">{formatPrice(payment.changeDue || 0)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between text-text-muted">
                            <span>Status</span>
                            <span className="text-white">{payment.status}</span>
                        </div>
                        <div className="flex justify-between text-text-muted">
                            <span>Total</span>
                            <span className="text-white font-bold">{formatPrice(payment.amount)}</span>
                        </div>
                        {payment.refundedAmount > 0 && (
                            <div className="flex justify-between text-text-muted">
                                <span>Refunded</span>
                                <span className="text-amber-400 font-bold">-{formatPrice(payment.refundedAmount)}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-4">
                        <h4 className="text-sm font-bold text-white mb-2">Receipt Preview</h4>
                        <div className="bg-white text-black rounded-lg p-3">
                            <Receipt
                                ref={receiptRef}
                                transaction={payment}
                                items={receiptItems}
                                member={payment.member}
                                cashierName={payment.cashier?.name || 'Staff'}
                                discount={payment.discount || 0}
                                paymentDetails={{
                                    method: payment.method,
                                    tendered: payment.cashTendered,
                                    change: payment.changeDue
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {returnModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-6">
                        <h3 className="text-xl font-bold text-white mb-2">Return Items</h3>
                        <p className="text-text-muted text-sm mb-4">Select quantities to return and enter the return PIN.</p>

                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                            {payment.items.filter(item => item.productId).length === 0 && (
                                <p className="text-sm text-text-muted">No returnable items in this transaction.</p>
                            )}
                            {payment.items.filter(item => item.productId).map((item) => {
                                const available = item.quantity - (item.returnedQuantity || 0);
                                return (
                                    <div key={item.id} className="flex items-center justify-between gap-3 bg-white/5 p-3 rounded-xl">
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                                            <p className="text-xs text-text-muted">Available: {available}</p>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            max={available}
                                            className="w-20 bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                            value={returnQuantities[item.id] || ''}
                                            onChange={(e) => setReturnQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs text-text-secondary font-bold mb-2">Return PIN</label>
                            <input
                                type="password"
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white"
                                placeholder="Enter PIN"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                            />
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={closeModals}
                                className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReturnSubmit}
                                disabled={actionLoading || !pin}
                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl"
                            >
                                {actionLoading ? 'Processing...' : 'Return Items'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {voidModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-xl font-bold text-white mb-2">Void Transaction</h3>
                        <p className="text-text-muted text-sm mb-4">Enter the void PIN to continue.</p>
                        <input
                            type="password"
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white"
                            placeholder="Enter PIN"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                        />
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={closeModals}
                                className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleVoidSubmit}
                                disabled={actionLoading || !pin}
                                className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl"
                            >
                                {actionLoading ? 'Processing...' : 'Void Transaction'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {completeModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-xl font-bold text-white mb-2">Complete Payment</h3>
                        <p className="text-text-muted text-sm mb-4">Enter Cash Tendered to complete this transaction.</p>

                        <div className="bg-white/5 p-4 rounded-xl mb-4 text-center">
                            <p className="text-text-muted text-xs uppercase font-bold">Total Amount</p>
                            <p className="text-2xl font-bold text-white">{formatPrice(payment.amount)}</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs text-text-secondary font-bold mb-2">Cash Tendered</label>
                            <input
                                type="number"
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white text-lg font-bold"
                                placeholder="0.00"
                                value={cashTendered}
                                onChange={(e) => setCashTendered(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {cashTendered && Number(cashTendered) >= payment.amount && (
                            <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl mb-4 text-center">
                                <p className="text-green-400 text-xs font-bold uppercase">Change Due</p>
                                <p className="text-xl font-bold text-green-400">{formatPrice(Number(cashTendered) - payment.amount)}</p>
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={closeModals}
                                className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCompleteSubmit}
                                disabled={actionLoading || !cashTendered || Number(cashTendered) < payment.amount}
                                className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold rounded-xl"
                            >
                                {actionLoading ? 'Processing...' : 'Complete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
