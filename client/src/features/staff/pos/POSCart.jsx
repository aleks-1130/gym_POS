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
    getCalendarCells
} from './POSUtils';

/**
 * POSCart Component - Manages the cart items, member selection, and training details.
 */
export default function POSCart({ members, trainers, discountOptions, initiateCheckout, openReceiptTemplatePreview }) {
    const { formatPrice } = useCurrency();

    // Zustand Store
    const {
        cart, selectedMemberId, discount,
        removeFromCart, updateQuantity, setSelectedMemberId, setDiscount,
        updateTrainingDetails, clearCart
    } = usePOSStore(useShallow(state => ({
        cart: state.cart,
        selectedMemberId: state.selectedMemberId,
        discount: state.discount,
        removeFromCart: state.removeFromCart,
        updateQuantity: state.updateQuantity,
        setSelectedMemberId: state.setSelectedMemberId,
        setDiscount: state.setDiscount,
        updateTrainingDetails: state.updateTrainingDetails,
        clearCart: state.clearCart
    })));

    const { subtotal, discountAmount, total: cartTotal } = usePOSStore(useShallow(state => state.getTotals()));

    // Local UI State for Calendar
    const [openCalendarLineId, setOpenCalendarLineId] = useState(null);
    const [calendarMonthByLine, setCalendarMonthByLine] = useState({});
    const [selectedDiscountPresetId, setSelectedDiscountPresetId] = useState('');

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
            setSelectedDiscountPresetId('');
            setDiscount(0);
            return;
        }
        const preset = discountOptions.find((item) => item.id === presetId);
        if (!preset) {
            setSelectedDiscountPresetId('');
            setDiscount(0);
            return;
        }
        setSelectedDiscountPresetId(preset.id);
        setDiscount(Number(preset.rate));
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
                    <option value="">Guest / Walk-in</option>
                    {members.map(m => (
                        <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
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
                                </div>
                                <button onClick={() => removeFromCart(item.cartLineId)} className="text-text-muted hover:text-red-400 transition-colors">
                                    <span className="material-icons-round text-lg">close</span>
                                </button>
                            </div>

                            {/* Quantity Controls for Products */}
                            {item.type === 'PRODUCT' && (
                                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateQuantity(item.cartLineId, item.quantity - 1)}
                                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                                        >
                                            <span className="material-icons-round text-sm">remove</span>
                                        </button>
                                        <span className="text-white font-bold w-6 text-center text-sm">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.cartLineId, item.quantity + 1, item.stock)}
                                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                                        >
                                            <span className="material-icons-round text-sm">add</span>
                                        </button>
                                    </div>
                                    <p className="text-white font-bold text-sm tracking-tighter">{formatPrice(item.price * item.quantity)}</p>
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
                                            <option value="">Time</option>
                                            {item.date && trainers.find(t => t.id === item.trainerId) && getAvailableTimeSlotsForTrainer(trainers.find(t => t.id === item.trainerId), item.date, item.duration).map(slot => (
                                                <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
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
                                                <option key={d} value={d.trim()}>{d.trim()} Min</option>
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
                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-white font-bold">Total Due</span>
                        <span className="text-xl font-black text-primary">{formatPrice(cartTotal)}</span>
                    </div>
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
