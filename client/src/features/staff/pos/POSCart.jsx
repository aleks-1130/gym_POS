import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePOSStore } from '../../../stores/usePOSStore';
import { useCurrency } from '../../../context/CurrencyContext';
import { POS_VIEWS } from '../../../constants/categories';
import {
    formatTimeLabel,
    toIsoDate,
    getAvailableTimeSlotsForTrainer,
    isTrainerDateAvailable,
    getCalendarCells,
    getMembershipDurationLabel
} from './POSUtils';
import { useConfirm } from '../../../context/ConfirmContext';
import axios from 'axios';
import { withApiBase } from '../../../config/api';
import { authHeaders } from './POSUtils';
import { useAuth } from '../../../context/AuthContext';
import { LOYALTY_CONFIG } from '../../../config/businessConfig';

/**
 * POSCart Component - Manages the cart items, member selection, and training details.
 */
export default function POSCart({ members, products, trainers, discountOptions, initiateCheckout, openReceiptTemplatePreview }) {
    const { user } = useAuth();
    const branchTaxRate = user?.gym?.taxRate ?? 12;
    const { currency: globalCurrency } = useCurrency();
    
    // Local currency formatting for flexibility (SGD/PHP)
    const formatPrice = (amount, currencyCode = globalCurrency) => {
        const locale = currencyCode === 'SGD' ? 'en-SG' : 'en-PH';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };
    const { alert: showAlert } = useConfirm();

    // Zustand Store
    const {
        cart, selectedMemberId, discount, appliedCoupon,
        removeFromCart, updateQuantity, setSelectedMemberId, setDiscount, setAppliedCoupon,
        updateTrainingDetails, setSelectedBundleItems, clearCart
    } = usePOSStore(useShallow(state => ({
        cart: state.cart,
        selectedMemberId: state.selectedMemberId,
        discount: state.discount,
        appliedCoupon: state.appliedCoupon,
        removeFromCart: state.removeFromCart,
        updateQuantity: state.updateQuantity,
        setSelectedMemberId: state.setSelectedMemberId,
        setDiscount: state.setDiscount,
        setAppliedCoupon: state.setAppliedCoupon,
        updateTrainingDetails: state.updateTrainingDetails,
        setSelectedBundleItems: state.setSelectedBundleItems,
        clearCart: state.clearCart
    })));

    const { subtotal, discountAmount, couponDiscount, total: cartTotal } = usePOSStore(useShallow(state => state.getTotals()));

    // Local UI State
    const [openCalendarLineId, setOpenCalendarLineId] = useState(null);
    const [calendarMonthByLine, setCalendarMonthByLine] = useState({});
    const [couponInput, setCouponInput] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [openBundleLineId, setOpenBundleLineId] = useState(null);

    const selectedDiscountPresetId = (discountOptions.find((option) => Number(option.rate) === Number(discount)) || {}).id || '';

    // Helpers
    const getCalendarMonthForLine = (lineId) => {
        const now = new Date();
        return calendarMonthByLine[lineId] || new Date(now.getFullYear(), now.getMonth(), 1);
    };

    const shiftCalendarMonthForLine = (lineId, delta) => {
        setCalendarMonthByLine((prev) => {
            const current = getCalendarMonthForLine(lineId);
            const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
            return { ...prev, [lineId]: next };
        });
    };

    const applyDiscountPreset = (presetId) => {
        if (!presetId) {
            setDiscount(0);
            return;
        }
        if (selectedDiscountPresetId === presetId) {
            setDiscount(0);
            return;
        }
        const preset = discountOptions.find((item) => item.id === presetId);
        if (!preset) {
            setDiscount(0);
            return;
        }
        setDiscount(Number(preset.rate));
    };

    const applyCoupon = async () => {
        if (!couponInput.trim()) return;
        setCouponLoading(true);
        setCouponError('');
        try {
            // New endpoint that parses cart items to support BOGO/product-scoped rules
            const { data } = await axios.post(
                withApiBase('/api/pos/promo-codes/apply'),
                { 
                    code: couponInput.trim(), 
                    cartItems: cart, 
                    memberId: selectedMemberId || null 
                },
                { headers: authHeaders() }
            );
            
            // Expected data: { valid: true, discountAmount: 123.45, type, label, code... }
            setAppliedCoupon({ 
                ...data,
                code: couponInput.trim().toUpperCase() 
            });
            setCouponInput('');
        } catch (e) {
            setCouponError(e.response?.data?.error || 'Invalid or inapplicable promo/coupon code');
        }
        setCouponLoading(false);
    };

    const removeCoupon = () => {
        setAppliedCoupon(null);
        setCouponInput('');
        setCouponError('');
    };

    return (
        <div className="w-[340px] h-full flex-shrink-0 flex flex-col bg-surface rounded-3xl border border-white/10 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-white/5">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-white font-bold text-base">Current Cart</h2>
                    <button onClick={clearCart} className="text-[10px] text-text-muted hover:text-red-400 transition-colors uppercase font-bold tracking-wider">Clear Cart</button>
                </div>

                {/* Member Selector */}
                <select
                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-primary outline-none"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                >
                    <option value="" className="bg-[#181B21] text-white">Guest / Walk-in</option>
                    {members.map(m => (
                        <option key={m.id} value={m.id} className="bg-[#181B21] text-white">{m.firstName} {m.lastName}</option>
                    ))}
                </select>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-50 space-y-4">
                        <span className="material-icons-round text-5xl">shopping_cart</span>
                        <p className="text-sm font-medium">Cart is empty</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.cartLineId} className="bg-surfaceHighlight rounded-2xl border border-white/5 p-3 group">
                            <div className="flex justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white text-sm font-bold truncate leading-tight mb-1">{item.name}</h4>
                                    <p className="text-primary text-xs font-bold">{formatPrice(item.price)}</p>
                                    {item.type === 'PLAN' && (
                                        <p className="mt-1 text-[11px] text-text-muted">
                                            Duration: {getMembershipDurationLabel(item)}
                                        </p>
                                    )}
                                </div>
                                <button onClick={async () => await removeFromCart(item.cartLineId)} className="text-text-muted hover:text-red-400 transition-colors">
                                    <span className="material-icons-round text-lg">close</span>
                                </button>
                            </div>

                            {/* Quantity Controls for Products */}
                            {item.type === 'PRODUCT' && (
                                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={async () => await updateQuantity(item.cartLineId, item.quantity - 1)}
                                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                                        >
                                            <span className="material-icons-round text-sm">remove</span>
                                        </button>
                                        <span className="text-white font-bold w-6 text-center text-sm">{item.quantity}</span>
                                        <button
                                            onClick={async () => {
                                                const res = await updateQuantity(item.cartLineId, item.quantity + 1, item.stock);
                                                if (res && !res.success) {
                                                    await showAlert({ title: 'Stock Limit', message: res.error, type: 'warning' });
                                                }
                                            }}
                                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                                        >
                                            <span className="material-icons-round text-sm">add</span>
                                        </button>
                                    </div>
                                    <p className="text-white font-bold text-sm tracking-tighter">{formatPrice(item.price * item.quantity)}</p>
                                </div>
                            )}

                            {/* Bundle Details & Item Selection */}
                            {item.type === 'SERVICE_BUNDLE' && (
                                <div className="mt-2 space-y-2">
                                    {(item.buckets || []).map((bucket, bIdx) => {
                                        const isCategoryBucket = bucket.type === 'PRODUCT' && bucket.productCategory;
                                        const selectedItems = bucket.selectedItems || [];
                                        const selectedTotal = selectedItems.reduce((sum, si) => sum + (si.price * si.quantity), 0);
                                        const needsSelection = isCategoryBucket && selectedTotal < bucket.referencePrice;

                                        return (
                                            <div key={bIdx} className="bg-white/5 rounded-xl p-2 border border-white/5">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div>
                                                        <p className="text-[10px] text-text-muted uppercase font-bold">
                                                            Bucket {bIdx + 1}: {isCategoryBucket ? `Category ${bucket.productCategory}` : 'Specific Product'}
                                                        </p>
                                                        <p className="text-[11px] text-white">
                                                            {isCategoryBucket ? `Select up to ${formatPrice(bucket.referencePrice)}` : bucket.product?.name}
                                                        </p>
                                                    </div>
                                                    {isCategoryBucket && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedTotal >= bucket.referencePrice ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                            {formatPrice(selectedTotal)} / {formatPrice(bucket.referencePrice)}
                                                        </span>
                                                    )}
                                                </div>

                                                {isCategoryBucket && (
                                                    <div className="space-y-1.5 mt-2">
                                                        {selectedItems.map((si, siIdx) => (
                                                            <div key={siIdx} className="flex justify-between items-center bg-black/20 rounded-lg px-2 py-1">
                                                                <span className="text-[10px] text-white truncate max-w-[140px]">{si.name} (x{si.quantity})</span>
                                                                <button 
                                                                    onClick={() => {
                                                                        const updated = selectedItems.filter((_, i) => i !== siIdx);
                                                                        setSelectedBundleItems(item.cartLineId, bIdx, updated);
                                                                    }}
                                                                    className="text-text-muted hover:text-red-400"
                                                                >
                                                                    <span className="material-icons-round text-sm">remove_circle</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                        
                                                        {needsSelection && (
                                                            <select
                                                                className="w-full bg-surface border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-primary"
                                                                value=""
                                                                onChange={(e) => {
                                                                    const prod = products.find(p => p.id === Number(e.target.value));
                                                                    if (prod) {
                                                                        const existing = selectedItems.find(si => si.id === prod.id);
                                                                        if (existing) {
                                                                            const updated = selectedItems.map(si => si.id === prod.id ? { ...si, quantity: si.quantity + 1 } : si);
                                                                            setSelectedBundleItems(item.cartLineId, bIdx, updated);
                                                                        } else {
                                                                            setSelectedBundleItems(item.cartLineId, bIdx, [...selectedItems, { ...prod, quantity: 1 }]);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <option value="" className="bg-[#181B21] text-white">+ Add Item from {bucket.productCategory}</option>
                                                                {products
                                                                    .filter(p => !bucket.productCategory || p.category === bucket.productCategory)
                                                                    .map(p => (
                                                                        <option key={p.id} value={p.id} className="bg-[#181B21] text-white">{p.name} ({formatPrice(p.price)})</option>
                                                                    ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Training Session Details */}
                            {item.type === 'TRAINING' && (
                                <div className="mt-2 space-y-2">
                                    {/* Date Selection */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenCalendarLineId(openCalendarLineId === item.cartLineId ? null : item.cartLineId)}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-white/5 border border-white/5 rounded-lg text-xs text-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons-round text-sm text-primary">event</span>
                                                <span className="font-medium truncate">{item.date ? new Date(item.date).toLocaleDateString() : 'Select Date'}</span>
                                            </div>
                                            <span className="material-icons-round text-base transition-transform" style={{ transform: openCalendarLineId === item.cartLineId ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                        </button>

                                        {openCalendarLineId === item.cartLineId && (
                                            <div className="absolute top-11 left-0 right-0 z-30 bg-surface border border-white/10 rounded-xl shadow-2xl p-2 animate-scale-up">
                                                <div className="flex items-center justify-between mb-2 px-1">
                                                    <button onClick={() => shiftCalendarMonthForLine(item.cartLineId, -1)} className="p-1 hover:bg-white/5 rounded-lg transition-colors"><span className="material-icons-round text-base text-white">chevron_left</span></button>
                                                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">{getCalendarMonthForLine(item.cartLineId).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                                                    <button onClick={() => shiftCalendarMonthForLine(item.cartLineId, 1)} className="p-1 hover:bg-white/5 rounded-lg transition-colors"><span className="material-icons-round text-base text-white">chevron_right</span></button>
                                                </div>
                                                <div className="grid grid-cols-7 gap-1 text-center">
                                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, ix) => <div key={ix} className="text-[10px] font-bold text-text-muted py-1">{day}</div>)}
                                                    {getCalendarCells(getCalendarMonthForLine(item.cartLineId)).map((cell, idx) => {
                                                        if (!cell) return <div key={idx} />;
                                                        const iso = toIsoDate(cell);
                                                        const trainerObj = trainers.find(t => t.id === item.trainerId);
                                                        const avail = trainerObj ? isTrainerDateAvailable(trainerObj, iso) : false;
                                                        const isSelected = item.date === iso;
                                                        return (
                                                            <button
                                                                key={idx}
                                                                disabled={!avail}
                                                                onClick={() => {
                                                                    updateTrainingDetails(item.cartLineId, 'date', iso);
                                                                    updateTrainingDetails(item.cartLineId, 'time', ''); // Reset time
                                                                    setOpenCalendarLineId(null);
                                                                }}
                                                                className={`h-7 w-7 rounded-lg text-[10px] font-bold transition-all ${isSelected ? 'bg-primary text-background' : avail ? 'text-white hover:bg-primary/20' : 'text-text-muted opacity-20 cursor-not-allowed'}`}
                                                            >
                                                                {cell.getDate()}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Time and Duration Selection */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            disabled={!item.date}
                                            value={item.time || ''}
                                            onChange={(e) => updateTrainingDetails(item.cartLineId, 'time', e.target.value)}
                                            className="bg-white/5 border border-white/5 rounded-lg px-2 py-2 text-xs text-white outline-none disabled:opacity-50"
                                        >
                                            <option value="" className="bg-[#181B21] text-white">Time</option>
                                            {item.date && trainers.find(t => t.id === item.trainerId) && getAvailableTimeSlotsForTrainer(trainers.find(t => t.id === item.trainerId), item.date, item.duration).map(slot => (
                                                <option key={slot} value={slot} className="bg-[#181B21] text-white">{formatTimeLabel(slot)}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={item.duration || 60}
                                            onChange={(e) => {
                                                updateTrainingDetails(item.cartLineId, 'duration', Number(e.target.value));
                                                updateTrainingDetails(item.cartLineId, 'time', ''); // Reset time
                                            }}
                                            className="bg-white/5 border border-white/5 rounded-lg px-2 py-2 text-xs text-white outline-none"
                                        >
                                            {trainers.find(t => t.id === item.trainerId)?.sessionDurations?.split(',').map(d => (
                                                <option key={d} value={d.trim()} className="bg-[#181B21] text-white">{d.trim()} Min</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Cart Footer */}
            <div className="p-4 bg-white/5 border-t border-white/5 space-y-4">
                {/* Discount Pre-sets */}
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Discount Options</p>
                    <div className="grid grid-cols-4 gap-2">
                        {discountOptions.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyDiscountPreset(preset.id)}
                                className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-all ${selectedDiscountPresetId === preset.id ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-white/5 text-text-muted border border-white/5 hover:border-primary/30'}`}
                            >
                                <span className="material-icons-round text-base">{preset.icon || 'local_offer'}</span>
                                <span className="text-[9px] font-black">{preset.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Totals */}
                <div className="space-y-2 bg-black/20 p-3 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted">Subtotal</span>
                        <span className="text-white font-medium">{formatPrice(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-400">Discount ({discount}%)</span>
                            <span className="text-emerald-400 font-medium">-{formatPrice(discountAmount)}</span>
                        </div>
                    )}
                    {appliedCoupon && couponDiscount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-amber-400">Code ({appliedCoupon.label || appliedCoupon.code})</span>
                            <span className="text-amber-400 font-medium">-{formatPrice(couponDiscount)}</span>
                        </div>
                    )}
                    <div className="pt-2 border-t border-white/5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] opacity-50">
                            <span>Taxable Amount</span>
                            <span>{formatPrice(cartTotal / (1 + branchTaxRate / 100))}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] opacity-50">
                            <span>VAT ({branchTaxRate}%)</span>
                            <span>{formatPrice(cartTotal - (cartTotal / (1 + branchTaxRate / 100)))}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <div className="flex flex-col">
                            <span className="text-white font-bold">Total Due</span>
                            {selectedMemberId && cartTotal > 0 && (
                                <span className="text-[10px] text-emerald-400 font-bold tracking-wide mt-0.5">
                                    Earn +{Math.floor(cartTotal * (posSettings?.loyaltyPointsRate ?? 0.1))} Points
                                </span>
                            )}
                        </div>
                        <span className="text-xl font-black text-primary">{formatPrice(cartTotal)}</span>
                    </div>
                </div>

                {/* Coupon Input */}
                <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Coupon Code</p>
                    {appliedCoupon ? (
                        <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 ${appliedCoupon.source === 'PROMO' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                            <span className={`material-icons-round text-base ${appliedCoupon.source === 'PROMO' ? 'text-blue-400' : 'text-amber-400'}`}>local_offer</span>
                            <span className={`text-xs font-bold flex-1 truncate ${appliedCoupon.source === 'PROMO' ? 'text-blue-300' : 'text-amber-300'}`}>{appliedCoupon.code} — {appliedCoupon.label}</span>
                            <button onClick={removeCoupon} className="text-text-muted hover:text-red-400 transition-colors">
                                <span className="material-icons-round text-sm">close</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-400 uppercase placeholder:normal-case"
                                    placeholder="Enter coupon code..."
                                    value={couponInput}
                                    onChange={e => { setCouponInput(e.target.value); setCouponError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                                    disabled={couponLoading}
                                />
                                <button
                                    onClick={applyCoupon}
                                    disabled={!couponInput.trim() || couponLoading}
                                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-bold text-xs rounded-xl transition-all"
                                >
                                    {couponLoading ? '...' : 'Apply'}
                                </button>
                            </div>
                            {couponError && <p className="text-red-400 text-[10px]">{couponError}</p>}
                        </>
                    )}
                </div>

                {/* Checkout Actions */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={openReceiptTemplatePreview}
                        className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/5"
                    >
                        <span className="material-icons-round text-base">receipt</span> Preview
                    </button>
                    <button
                        disabled={cart.length === 0}
                        onClick={initiateCheckout}
                        className="py-3 bg-primary text-background rounded-xl text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                    >
                        Pay Now
                    </button>
                </div>
            </div>
        </div>
    );
}
