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
        paymentDetails, setPaymentField, closeModal
    } = usePOSStore(useShallow(state => ({
        paymentDetails: state.paymentDetails,
        setPaymentField: state.setPaymentField,
        closeModal: state.closeModal
    })));

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-up">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Select Payment Method</h2>
                    <p className="text-text-muted">Total Amount Due</p>
                    <p className="text-4xl font-bold text-primary mt-1">{formatPrice(totalDue)}</p>
                </div>

                {!paymentDetails.method ? (
                    <div className="grid grid-cols-2 gap-4">
                        {PAYMENT_METHODS.filter(m => m.value !== 'LOYALTY_POINTS').map((method) => (
                            <button
                                key={method.value}
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
                                onClick={() => setPaymentField('method', '')}
                                className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => processPayment(paymentDetails.method)}
                                disabled={
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
                        onClick={() => closeModal('payment')}
                        className="w-full mt-6 py-3 text-text-muted hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}
