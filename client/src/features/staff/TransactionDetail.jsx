import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import Receipt from '../../components/Receipt';
import { useCurrency } from '../../context/CurrencyContext';
import { withApiBase } from '../../config/api';
import { useConfirm } from '../../context/ConfirmContext';

export default function TransactionDetail() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { formatPrice } = useCurrency();
    const { alert: showAlert } = useConfirm();
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [voidModalOpen, setVoidModalOpen] = useState(false);
    const [completeModalOpen, setCompleteModalOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [cashTendered, setCashTendered] = useState('');
    const [returnQuantities, setReturnQuantities] = useState({});
    const [actionLoading, setActionLoading] = useState(false);
    const [receiptSettings, setReceiptSettings] = useState(null);
    const receiptRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => receiptRef.current,
    });

    useEffect(() => {
        fetchPayment();
        fetchReceiptSettings();
    }, [id]);

    const authHeaders = () => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : undefined;
    };

    const fetchPayment = async () => {
        setLoading(true);
        try {
            const res = await axios.get(withApiBase(`/api/payments/${id}`), {
                headers: authHeaders()
            });
            setPayment(res.data);
        } catch (e) {
            console.error('Failed to fetch payment', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchReceiptSettings = async () => {
        try {
            const res = await axios.get(withApiBase('/api/payments/receipt-settings'), {
                headers: authHeaders()
            });
            setReceiptSettings(res.data || null);
        } catch (e) {
            console.error('Failed to fetch receipt settings', e);
            setReceiptSettings(null);
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
            await showAlert({ title: 'No Items Selected', message: 'Select at least one item to return.', type: 'warning' });
            return;
        }

        setActionLoading(true);
        try {
            const res = await axios.post(withApiBase(`/api/payments/${payment.id}/return-items`), {
                pin,
                items
            }, {
                headers: authHeaders()
            });
            setPayment(res.data);
            closeModals();
        } catch (e) {
            await showAlert({ title: 'Return Failed', message: e.response?.data?.error || 'Return failed', type: 'danger' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoidSubmit = async () => {
        if (!payment) return;
        setActionLoading(true);
        try {
            const res = await axios.post(withApiBase(`/api/payments/${payment.id}/void`), { pin }, {
                headers: authHeaders()
            });
            setPayment(res.data);
            closeModals();
        } catch (e) {
            await showAlert({ title: 'Void Failed', message: e.response?.data?.error || 'Void failed', type: 'danger' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCompleteSubmit = async () => {
        if (!payment) return;
        if (!cashTendered || Number(cashTendered) < payment.amount) {
            await showAlert({ title: 'Insufficient Amount', message: `Please enter at least ${formatPrice(payment.amount)}`, type: 'warning' });
            return;
        }

        setActionLoading(true);
        try {
            const res = await axios.post(withApiBase(`/api/payments/${payment.id}/complete`), {
                cashTendered: Number(cashTendered)
            }, {
                headers: authHeaders()
            });
            await showAlert({ title: 'Payment Completed!', message: 'The transaction has been marked as completed.', type: 'success' });
            fetchPayment();
            closeModals();
        } catch (e) {
            await showAlert({ title: 'Completion Failed', message: e.response?.data?.error || 'Completion failed', type: 'danger' });
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

    const explicitItems = Array.isArray(payment.items) ? payment.items : [];
    const trainingSessions = Array.isArray(payment.trainingSessions) ? payment.trainingSessions : [];
    const receiptItems = explicitItems.length > 0
        ? explicitItems.map((item) => ({
            name: item.name,
            price: item.unitPrice,
            quantity: item.quantity,
            returnedQuantity: Number(item.returnedQuantity || 0)
        }))
        : trainingSessions.length > 0
            ? trainingSessions.map((session, index) => ({
                name: `${session.trainer?.name || 'Trainer'} Session #${index + 1} (${new Date(session.date).toLocaleDateString()} ${new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                price: Number(session.price || 0),
                quantity: 1,
                returnedQuantity: 0
            }))
            : [{
                name: String(payment.type || 'Transaction').replaceAll('_', ' '),
                price: Number(payment.amount || 0),
                quantity: 1,
                returnedQuantity: 0
            }];
    const statusValue = String(payment.status || 'COMPLETED').toUpperCase();
    const statusStyles = {
        COMPLETED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        PENDING: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
        RETURNED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        VOIDED: 'bg-red-500/15 text-red-300 border-red-500/30'
    };
    const statusClass = statusStyles[statusValue] || 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    const totalItemQuantity = receiptItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const grossTotal = receiptItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    const discountRate = Number(payment.discount || 0);
    const discountAmount = Number((grossTotal * (discountRate / 100)).toFixed(2));
    const refundedAmount = Number(payment.refundedAmount || 0);
    const netCollected = Number(Math.max(0, Number(payment.amount || 0) - refundedAmount).toFixed(2));
    const memberName = payment.member ? `${payment.member.firstName} ${payment.member.lastName}` : 'Walk-in';
    const transactionType = String(payment.type || 'Transaction').replaceAll('_', ' ');
    const handleBackToTransactions = () => {
        const fallbackPath = location.state?.from || '/transactions';
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate(fallbackPath);
    };

    return (
        <div className="space-y-6">
            <header className="bg-surface rounded-3xl border border-white/10 p-5 lg:p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-white">Transaction #{payment.id}</h1>
                        <p className="text-text-muted text-sm">{new Date(payment.date).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-bold tracking-wide ${statusClass}`}>
                            {statusValue}
                        </span>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-text-secondary text-xs font-bold tracking-wide">
                            {payment.method || 'N/A'}
                        </span>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-text-secondary text-xs font-bold tracking-wide">
                            {transactionType}
                        </span>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Member</p>
                        <p className="text-sm text-white font-semibold mt-1 truncate">{memberName}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Cashier</p>
                        <p className="text-sm text-white font-semibold mt-1 truncate">{payment.cashier?.name || 'N/A'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Cash Tendered</p>
                        <p className="text-sm text-white font-semibold mt-1">{payment.method === 'CASH' ? formatPrice(payment.cashTendered || 0) : 'N/A'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Change Due</p>
                        <p className="text-sm text-white font-semibold mt-1">{payment.method === 'CASH' ? formatPrice(payment.changeDue || 0) : 'N/A'}</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7 bg-surface rounded-3xl border border-white/10 p-5 lg:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <h3 className="text-lg font-bold text-white">Items</h3>
                        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                            {totalItemQuantity} total item{totalItemQuantity === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                        <div className="hidden md:grid md:grid-cols-12 px-4 py-3 bg-white/[0.03] text-[11px] font-bold uppercase tracking-widest text-text-muted">
                            <span className="md:col-span-6">Item</span>
                            <span className="md:col-span-2 text-right">Qty</span>
                            <span className="md:col-span-2 text-right">Unit</span>
                            <span className="md:col-span-2 text-right">Total</span>
                        </div>
                        <div className="divide-y divide-white/10">
                        {receiptItems.map((item, index) => (
                                <div key={`${item.name}-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 bg-white/[0.02]">
                                    <div className="md:col-span-6 min-w-0">
                                        <p className="text-sm text-white font-semibold truncate">{item.name}</p>
                                    </div>
                                    <div className="md:col-span-2 text-left md:text-right">
                                        <p className="text-sm text-white">{item.quantity}</p>
                                    </div>
                                    <div className="md:col-span-2 text-left md:text-right">
                                        <p className="text-sm text-white">{formatPrice(item.price)}</p>
                                    </div>
                                    <div className="md:col-span-2 text-left md:text-right">
                                        <p className="text-sm font-bold text-white">{formatPrice(item.price * item.quantity)}</p>
                                    {item.returnedQuantity > 0 && (
                                            <p className="text-[10px] text-amber-400 mt-0.5">Returned: {item.returnedQuantity}</p>
                                    )}
                                    </div>
                                </div>
                        ))}
                        </div>
                    </div>

                    <div className="mt-6 border-t border-white/10 pt-5">
                        <h4 className="text-sm font-bold text-white mb-3">Transaction Summary</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                <p className="text-[11px] uppercase tracking-widest font-bold text-text-muted">Items Gross</p>
                                <p className="mt-1 text-base font-bold text-white">{formatPrice(grossTotal)}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                <p className="text-[11px] uppercase tracking-widest font-bold text-text-muted">Charged Total</p>
                                <p className="mt-1 text-base font-bold text-white">{formatPrice(payment.amount)}</p>
                            </div>
                            {discountRate > 0 && (
                                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-widest font-bold text-cyan-200">Discount ({discountRate}%)</p>
                                    <p className="mt-1 text-base font-bold text-cyan-200">-{formatPrice(discountAmount)}</p>
                                </div>
                            )}
                            <div className={`rounded-xl border px-4 py-3 ${refundedAmount > 0 ? 'border-amber-500/20 bg-amber-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
                                <p className={`text-[11px] uppercase tracking-widest font-bold ${refundedAmount > 0 ? 'text-amber-200' : 'text-text-muted'}`}>Refunded</p>
                                <p className={`mt-1 text-base font-bold ${refundedAmount > 0 ? 'text-amber-200' : 'text-white'}`}>
                                    {refundedAmount > 0 ? `-${formatPrice(refundedAmount)}` : formatPrice(0)}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] uppercase tracking-widest font-bold text-emerald-200">Net Collected</p>
                                <p className="text-lg font-bold text-emerald-200">{formatPrice(netCollected)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-5">
                    <div className="bg-surface rounded-3xl border border-white/10 p-5 lg:p-6 shadow-sm xl:sticky xl:top-6">
                        <h4 className="text-sm font-bold text-white mb-1">Receipt Preview</h4>
                        <p className="text-xs text-text-muted mb-3">This is the printable receipt layout.</p>
                        <div className="bg-white text-black rounded-lg p-3 max-h-[55vh] overflow-auto">
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
                                receiptSettings={receiptSettings}
                            />
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex w-full gap-2">
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                                >
                                    <span className="material-icons-round text-base">print</span>
                                    Print
                                </button>
                                {payment.status === 'PENDING' && (
                                    <button
                                        onClick={() => setCompleteModalOpen(true)}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 text-white font-bold shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all"
                                    >
                                        <span className="material-icons-round text-base">task_alt</span>
                                        Complete
                                    </button>
                                )}
                                <button
                                    onClick={openReturnModal}
                                    disabled={payment.status === 'VOIDED'}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                                >
                                    <span className="material-icons-round text-base">undo</span>
                                    Return
                                </button>
                                <button
                                    onClick={openVoidModal}
                                    disabled={payment.status !== 'COMPLETED'}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                                >
                                    <span className="material-icons-round text-base">block</span>
                                    Void
                                </button>
                            </div>
                            <div className="mt-2">
                                <button
                                    onClick={handleBackToTransactions}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
                                >
                                    <span className="material-icons-round text-base">arrow_back</span>
                                    Back to Transactions
                                </button>
                            </div>
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
                            {explicitItems.filter(item => item.productId).length === 0 && (
                                <p className="text-sm text-text-muted">No returnable items in this transaction.</p>
                            )}
                            {explicitItems.filter(item => item.productId).map((item) => {
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
