import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useConfirm } from '../../context/ConfirmContext';
import MemberPageHeader from './components/MemberPageHeader';

export default function ShopCheckout() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { alert: showAlert } = useConfirm();
    const navigate = useNavigate();

    const [cart, setCart] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethodId, setSelectedMethodId] = useState(null);
    const [selectedPaymentType, setSelectedPaymentType] = useState('CASH'); // CASH | E_WALLET | CARD
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const cartStorageKey = `gymCart_${user?.role || 'guest'}`;

    useEffect(() => {
        const savedCart = localStorage.getItem(cartStorageKey) || localStorage.getItem('gymCart');
        if (!savedCart) {
            setCart([]);
            return;
        }
        try {
            setCart(JSON.parse(savedCart));
        } catch {
            setCart([]);
        }
    }, [cartStorageKey]);

    useEffect(() => {
        const fetchMethods = async () => {
            if (!user?.id) return;
            try {
                const res = await axios.get(`/api/members/${user.id}/payment-methods`);
                const methods = Array.isArray(res.data) ? res.data : [];
                setPaymentMethods(methods);
                const defaultMethod = methods.find((m) => m.isDefault);
                if (defaultMethod) setSelectedMethodId(defaultMethod.id);
            } catch (error) {
                console.error('Failed to load payment methods', error);
            }
        };

        fetchMethods();
    }, [user?.id]);

    const walletMethods = useMemo(
        () => paymentMethods.filter((m) => ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase())),
        [paymentMethods]
    );
    const cardMethods = useMemo(
        () => paymentMethods.filter((m) => ['CARD', 'CREDIT_CARD'].includes(String(m.type || '').toUpperCase())),
        [paymentMethods]
    );

    useEffect(() => {
        if (selectedPaymentType === 'CASH') {
            setSelectedMethodId(null);
            return;
        }
        const candidates = selectedPaymentType === 'CARD' ? cardMethods : walletMethods;
        const preferred = candidates.find((m) => m.isDefault) || candidates[0] || null;
        setSelectedMethodId(preferred?.id || null);
    }, [selectedPaymentType, cardMethods, walletMethods]);

    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    const selectedMethod = paymentMethods.find((m) => Number(m.id) === Number(selectedMethodId));
    const requiresMethod = selectedPaymentType === 'CARD' || selectedPaymentType === 'E_WALLET';
    const hasValidMethod = selectedPaymentType === 'CARD'
        ? cardMethods.some((m) => Number(m.id) === Number(selectedMethodId))
        : walletMethods.some((m) => Number(m.id) === Number(selectedMethodId));
    const canConfirm = cart.length > 0 && !isCheckingOut && (!requiresMethod || hasValidMethod);

    const getSessionId = () => {
        let sid = localStorage.getItem('guestSessionId');
        if (!sid) {
            sid = `SESSION_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
            localStorage.setItem('guestSessionId', sid);
        }
        return sid;
    };

    const clearLocalCart = () => {
        localStorage.removeItem('gymCart');
        localStorage.removeItem(cartStorageKey);
        setCart([]);
    };

    const handleConfirmPayment = async () => {
        if (cart.length === 0) {
            await showAlert({ title: 'Cart Empty', message: 'Add items before checkout.', type: 'warning' });
            return;
        }
        if (requiresMethod && !hasValidMethod) {
            await showAlert({
                title: selectedPaymentType === 'CARD' ? 'Select Card' : 'Select Wallet',
                message: selectedPaymentType === 'CARD'
                    ? 'Please choose a card payment method.'
                    : 'Please choose an e-wallet payment method.',
                type: 'warning'
            });
            return;
        }

        setIsCheckingOut(true);
        try {
            const payload = {
                items: cart.map((i) => ({
                    productId: i.id,
                    quantity: i.quantity,
                    price: i.price,
                    name: i.name
                })),
                total: subtotal,
                paymentType: selectedPaymentType === 'CASH'
                    ? 'CASH_PENDING'
                    : (selectedPaymentType === 'E_WALLET' ? String(selectedMethod?.type || '').toUpperCase() : 'CARD'),
                paymentMethodId: selectedPaymentType === 'CASH' ? null : selectedMethodId,
                gcashReference: null,
                gcashDate: null
            };

            await axios.post('/api/members/checkout', payload);
            await axios.delete(`/api/pos/reserve/${getSessionId()}`).catch(() => {});
            clearLocalCart();

            if (selectedPaymentType === 'CASH') {
                await showAlert({
                    title: 'Order Placed',
                    message: 'Please proceed to the cash register to complete payment.',
                    type: 'info'
                });
            } else {
                await showAlert({
                    title: 'Payment Successful',
                    message: 'Order placed successfully.',
                    type: 'success'
                });
            }
            navigate('/purchase-history');
        } catch (error) {
            console.error('Checkout failed', error);
            await showAlert({
                title: 'Checkout Failed',
                message: error.response?.data?.error || error.message || 'Unable to complete checkout.',
                type: 'danger'
            });
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-8">
            <MemberPageHeader
                title="Order Details"
                subtitle="Review your cart and complete secure checkout"
                icon="shopping_cart_checkout"
            />

            <section className="bg-[#16181d] border border-white/10 rounded-[2rem] p-5 sm:p-6 space-y-6 shadow-2xl">
                <div className="space-y-1">
                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Secure Checkout</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">Select Payment</h2>
                </div>

                <div className="rounded-3xl bg-white/5 border border-white/10 p-4 sm:p-5 space-y-3">
                    {cart.length === 0 ? (
                        <div className="text-center py-6">
                            <p className="text-sm text-text-muted">Your cart is empty.</p>
                            <button
                                onClick={() => navigate('/shop')}
                                className="mt-3 text-primary text-sm font-bold hover:underline"
                            >
                                Back to shop
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="max-h-44 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                                        <span className="text-text-muted truncate">{item.quantity}x {item.name}</span>
                                        <span className="text-white font-black whitespace-nowrap">{formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-3 border-t border-white/10 space-y-1">
                                <div className="flex items-center justify-between text-text-muted text-sm">
                                    <span>Items selected</span>
                                    <span>{totalItems} items</span>
                                </div>
                                <div className="flex items-center justify-between text-white">
                                    <span className="text-sm font-black uppercase tracking-widest">Total</span>
                                    <span className="text-2xl font-black text-primary">{formatPrice(subtotal)}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 p-1.5 bg-black/40 rounded-3xl border border-white/10">
                        {['CASH', 'E_WALLET', 'CARD'].map((type) => {
                            const isActive = selectedPaymentType === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setSelectedPaymentType(type)}
                                    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${isActive
                                        ? 'bg-white text-background shadow-xl'
                                        : 'text-text-muted hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <span className="material-icons-round text-xl">
                                        {type === 'CARD' ? 'credit_card' : type === 'E_WALLET' ? 'account_balance_wallet' : 'payments'}
                                    </span>
                                    <span className="text-[12px] font-black uppercase tracking-widest">
                                        {type === 'CARD' ? 'Credit Card' : type === 'E_WALLET' ? 'Digital Wallet' : 'Cash Counter'}
                                    </span>
                                    {isActive && <span className="material-icons-round ml-auto text-lg">check_circle</span>}
                                </button>
                            );
                        })}
                    </div>

                    {requiresMethod && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-2">Choose Source</p>
                                <button
                                    onClick={() => navigate('/payment-methods')}
                                    className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline"
                                >
                                    Manage methods
                                </button>
                            </div>

                            {(selectedPaymentType === 'CARD' ? cardMethods : walletMethods).length === 0 ? (
                                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-center">
                                    <p className="text-[11px] text-rose-400 font-black uppercase tracking-widest">
                                        {selectedPaymentType === 'CARD' ? 'No Cards Linked' : 'No Wallet Linked'}
                                    </p>
                                    <button
                                        onClick={() => navigate('/payment-methods')}
                                        className="text-[10px] text-primary font-black uppercase tracking-widest mt-2 hover:underline"
                                    >
                                        Add Method
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {(selectedPaymentType === 'CARD' ? cardMethods : walletMethods).map((method) => (
                                        <button
                                            key={method.id}
                                            onClick={() => setSelectedMethodId(method.id)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedMethodId === method.id
                                                ? 'bg-primary/10 border-primary text-white shadow-lg shadow-primary/10'
                                                : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="text-[11px] font-black uppercase tracking-widest">
                                                    {selectedPaymentType === 'CARD'
                                                        ? (method.brand || 'Card')
                                                        : (String(method.type || '').toUpperCase() === 'MAYA' ? 'Maya' : 'GCash')}
                                                </span>
                                                <span className="text-[10px] font-medium opacity-50">**** {method.last4}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedMethodId === method.id ? 'border-primary bg-primary' : 'border-white/20'}`}>
                                                {selectedMethodId === method.id && <span className="material-icons-round text-[14px] text-background font-black">done</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-3 pt-2">
                    <button
                        onClick={handleConfirmPayment}
                        disabled={!canConfirm}
                        className="w-full h-14 rounded-[1.25rem] bg-primary text-background font-black text-[12px] uppercase tracking-[0.16em] shadow-2xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all flex items-center justify-center gap-3"
                    >
                        {isCheckingOut ? (
                            <div className="w-5 h-5 border-4 border-background/30 border-t-background rounded-full animate-spin" />
                        ) : (
                            <>
                                <span className="material-icons-round">verified</span>
                                <span>Confirm Payment</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => navigate('/shop')}
                        className="w-full h-12 rounded-[1.25rem] bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.16em] text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    >
                        Cancel Transaction
                    </button>
                </div>
            </section>
        </div>
    );
}
