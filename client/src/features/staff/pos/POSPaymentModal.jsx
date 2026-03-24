import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePOSStore } from '../../../stores/usePOSStore';
import { useCurrency } from '../../../context/CurrencyContext';
import { PAYMENT_METHODS } from '../../../config/businessConfig';

/**
 * POSPaymentModal Component - Handles payment method selection and transaction details.
 */
export default function POSPaymentModal({ processPayment, loading, totalDue }) {
    const { formatPrice: globalFormatPrice, currency: globalCurrency } = useCurrency();
    
    const formatPrice = (amount, currencyCode = globalCurrency) => {
        const locale = currencyCode === 'SGD' ? 'en-SG' : 'en-PH';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    // Zustand Store
    const {
        paymentDetails, setPaymentField, closeModal,
        setSplitPayment, addCollection, removeCollection, updateCollection
    } = usePOSStore(useShallow(state => ({
        paymentDetails: state.paymentDetails,
        setPaymentField: state.setPaymentField,
        closeModal: state.closeModal,
        setSplitPayment: state.setSplitPayment,
        addCollection: state.addCollection,
        removeCollection: state.removeCollection,
        updateCollection: state.updateCollection
    })));

    const collectionsTotal = paymentDetails.collections.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const remainingBalance = totalDue - collectionsTotal;
    const isReadyToComplete = paymentDetails.isSplit ? (Math.abs(remainingBalance) < 0.01) : !!paymentDetails.method;

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-up">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Checkout</h2>
                    <p className="text-text-muted">Total Amount Due</p>
                    <p className="text-4xl font-bold text-primary mt-1">{formatPrice(totalDue)}</p>
                    
                    <div className="flex items-center justify-center gap-3 mt-4 py-2 px-4 bg-white/5 rounded-full inline-flex">
                        <span className={`text-sm font-medium ${!paymentDetails.isSplit ? 'text-primary' : 'text-text-muted'}`}>Single</span>
                        <button 
                            type="button"
                            onClick={() => setSplitPayment(!paymentDetails.isSplit)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${paymentDetails.isSplit ? 'bg-primary' : 'bg-white/20'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${paymentDetails.isSplit ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-sm font-medium ${paymentDetails.isSplit ? 'text-primary' : 'text-text-muted'}`}>Split Payment</span>
                    </div>
                </div>

                {paymentDetails.isSplit ? (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {paymentDetails.collections.map((col, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 relative group">
                                <button 
                                    type="button"
                                    onClick={() => removeCollection(idx)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="material-icons-round text-xs">close</span>
                                </button>
                                
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-primary uppercase">{col.method}</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₱</span>
                                        <input 
                                            type="number"
                                            className="w-28 bg-surfaceHighlight border border-white/5 rounded-lg py-1 pl-6 pr-2 text-white text-right font-bold focus:border-primary outline-none"
                                            value={col.amount}
                                            onChange={(e) => updateCollection(idx, 'amount', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(col.method) && (
                                    <div className="space-y-2">
                                        <input 
                                            type="text"
                                            className="w-full bg-surfaceHighlight border border-white/5 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-primary"
                                            placeholder="Reference ID"
                                            value={col.reference}
                                            onChange={(e) => updateCollection(idx, 'reference', e.target.value)}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input 
                                                type="date"
                                                className="bg-surfaceHighlight border border-white/5 rounded-lg py-1 px-2 text-[10px] text-white outline-none"
                                                value={col.date}
                                                onChange={(e) => updateCollection(idx, 'date', e.target.value)}
                                            />
                                            <input 
                                                type="time"
                                                className="bg-surfaceHighlight border border-white/5 rounded-lg py-1 px-2 text-[10px] text-white outline-none"
                                                value={col.time}
                                                onChange={(e) => updateCollection(idx, 'time', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {remainingBalance > 0 && (
                            <div className="grid grid-cols-3 gap-2 py-4">
                                {PAYMENT_METHODS.filter(m => m.value !== 'LOYALTY_POINTS').map(m => (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => addCollection(m.value, remainingBalance)}
                                        className="py-3 px-1 rounded-xl bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 transition-all flex flex-col items-center gap-1"
                                    >
                                        <span className="material-icons-round text-xl">{m.icon}</span>
                                        <span className="text-[10px] uppercase font-bold text-text-muted">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className={`p-4 rounded-xl flex justify-between items-center ${remainingBalance <= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-orange-500/10 border border-orange-500/20'}`}>
                            <span className="text-text-secondary text-sm">Remaining Balance:</span>
                            <span className={`font-bold ${remainingBalance <= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                                {formatPrice(remainingBalance)}
                            </span>
                        </div>

                        <div className="flex gap-3 pt-2">
                             <button
                                type="button"
                                onClick={() => closeModal('payment')}
                                className="flex-1 py-4 text-text-muted font-bold hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => processPayment('SPLIT')}
                                disabled={loading || Math.abs(remainingBalance) > 0.01}
                                className="flex-[2] py-4 bg-primary hover:bg-primary-dark disabled:opacity-30 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                Complete Split Sale
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {!paymentDetails.method ? (
                            <div className="grid grid-cols-2 gap-4">
                                {PAYMENT_METHODS.filter(m => m.value !== 'LOYALTY_POINTS').map((method) => (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() => {
                                            if (['CASH', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method.value)) {
                                                setPaymentField('method', method.value);
                                            } else {
                                                processPayment(method.value);
                                            }
                                        }}
                                        disabled={loading}
                                        className={`p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-[1.02] text-white
                                            ${method.value === 'CASH' ? 'bg-green-600 hover:bg-green-700' :
                                                method.value === 'GCASH' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                                    method.value === 'PAYMAYA' ? 'bg-blue-600 hover:bg-blue-700' :
                                                        'bg-indigo-600 hover:bg-indigo-700'}`}
                                    >
                                        {loading && !['CASH', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method.value) ? (
                                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <span className="material-icons-round text-4xl">{method.icon}</span>
                                                <span className="font-bold text-lg uppercase">{method.label}</span>
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* E-Wallet / Card / Bank Transfer Details */}
                                {['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(paymentDetails.method) && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-text-muted text-sm font-medium mb-2">
                                                {paymentDetails.method === 'CARD' ? 'Terminal / Reference ID' :
                                                    paymentDetails.method === 'GCASH' ? 'GCash Reference ID' :
                                                        paymentDetails.method === 'PAYMAYA' ? 'PayMaya Reference ID' :
                                                            'Bank Reference ID'}
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base font-bold focus:border-primary outline-none"
                                                placeholder={paymentDetails.method === 'CARD' ? "Enter terminal transaction ID" : "Enter transaction reference ID"}
                                                value={paymentDetails.gcashReference}
                                                onChange={(e) => setPaymentField('gcashReference', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-text-muted text-sm font-medium mb-2">Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base focus:border-primary outline-none"
                                                    value={paymentDetails.gcashDate}
                                                    onChange={(e) => setPaymentField('gcashDate', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-text-muted text-sm font-medium mb-2">Time</label>
                                                <input
                                                    type="time"
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base focus:border-primary outline-none"
                                                    value={paymentDetails.gcashTime}
                                                    onChange={(e) => setPaymentField('gcashTime', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {paymentDetails.method === 'CASH' && (
                                    <>
                                        <div>
                                            <label className="block text-text-muted text-sm font-medium mb-2">Amount Tendered</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold">₱</span>
                                                <input
                                                    type="number"
                                                    autoFocus
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 pl-8 pr-4 text-white text-xl font-bold focus:border-green-500 outline-none"
                                                    placeholder="0.00"
                                                    value={paymentDetails.amountTendered}
                                                    onChange={(e) => setPaymentField('amountTendered', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                            <span className="text-text-secondary">Change Due:</span>
                                            <span className={`text-2xl font-bold ${(parseFloat(paymentDetails.amountTendered) || 0) >= totalDue ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatPrice(Math.max(0, (parseFloat(paymentDetails.amountTendered) || 0) - totalDue))}
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentField('method', '')}
                                        className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => processPayment(paymentDetails.method)}
                                        disabled={
                                            loading ||
                                            (paymentDetails.method === 'CASH' && (parseFloat(paymentDetails.amountTendered) || 0) < totalDue) ||
                                            (['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(paymentDetails.method) && (!paymentDetails.gcashReference || !paymentDetails.gcashDate || !paymentDetails.gcashTime))
                                        }
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                        Complete Sale
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {!paymentDetails.method && (
                            <button
                                type="button"
                                onClick={() => closeModal('payment')}
                                className="w-full mt-6 py-3 text-text-muted hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
