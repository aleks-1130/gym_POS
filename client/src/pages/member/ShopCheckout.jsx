import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export default function ShopCheckout() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const navigate = useNavigate();
    const [cart, setCart] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethodId, setSelectedMethodId] = useState('');

    useEffect(() => {
        const savedCart = localStorage.getItem('gymCart');
        setCart(savedCart ? JSON.parse(savedCart) : []);
    }, []);

    useEffect(() => {
        const fetchMethods = async () => {
            if (!user?.id) return;
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/members/${user.id}/payment-methods`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                const methods = res.data || [];
                setPaymentMethods(methods);
                const defaultMethod = methods.find((m) => m.isDefault);
                if (defaultMethod) setSelectedMethodId(defaultMethod.id);
            } catch (error) {
                console.error('Failed to load payment methods', error);
            }
        };

        fetchMethods();
    }, [user?.id]);

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const hasPaymentMethods = paymentMethods.length > 0;
    const canPlaceOrder = cart.length > 0 && hasPaymentMethods && selectedMethodId;

    const handlePlaceOrder = async () => {
        if (!canPlaceOrder) return;
        if (!user?.id) {
            console.error('Missing member id for checkout');
            return;
        }
        const method = paymentMethods.find((m) => m.id === selectedMethodId);
        if (!method) return;

        const payload = {
            amount: subtotal,
            type: 'IN_APP_PURCHASE',
            method: method.type === 'GCASH' ? 'GCASH' : 'CARD',
            memberId: user.id,
            items: cart.map((item) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                type: 'PRODUCT'
            })),
            discount: 0
        };

        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/payments', payload, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            localStorage.removeItem('gymCart');
            navigate('/purchase-history');
        } catch (error) {
            console.error('Failed to place order', error);
        }
    };

    return (
        <div className="pb-20 px-4 max-w-3xl mx-auto space-y-6">
            <div className="pt-4">
                <h1 className="text-xl font-bold text-white">Order Details</h1>
                <p className="text-text-muted text-xs mt-0.5">Review your items and choose payment method</p>
            </div>

            <section className="bg-surface rounded-2xl border border-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">Items</h2>
                    <span className="text-xs text-text-muted">{totalItems} total</span>
                </div>
                {cart.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <span className="material-icons-round text-3xl text-text-muted">shopping_cart</span>
                        </div>
                        <p className="text-text-muted text-sm">Your cart is empty</p>
                        <button
                            onClick={() => navigate('/shop')}
                            className="mt-3 text-primary text-sm font-medium underline"
                        >
                            Back to shop
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {cart.map((item) => (
                            <div key={item.id} className="bg-black/20 border border-white/5 rounded-xl p-3 flex gap-3">
                                <div className="w-16 h-16 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-icons-round text-2xl text-white/10">shopping_bag</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-semibold line-clamp-1">{item.name}</p>
                                    <p className="text-text-muted text-xs">Qty: {item.quantity}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white text-sm font-bold">{formatPrice(item.price * item.quantity)}</p>
                                    <p className="text-text-muted text-xs">{formatPrice(item.price)} each</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {cart.length > 0 && (
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-text-muted text-sm">Subtotal</span>
                        <span className="text-white font-bold text-lg">{formatPrice(subtotal)}</span>
                    </div>
                )}
            </section>

            <section className="bg-surface rounded-2xl border border-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">Payment Method</h2>
                    <button
                        onClick={() => navigate('/payment-methods')}
                        className="text-primary text-xs font-semibold underline"
                    >
                        Manage methods
                    </button>
                </div>

                {!hasPaymentMethods ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-text-muted">
                        No saved payment methods. Please add a GCash or card first.
                        <div className="mt-3">
                            <button
                                onClick={() => navigate('/payment-methods')}
                                className="px-3 py-2 rounded-lg bg-primary text-background text-xs font-bold"
                            >
                                Add Payment Method
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {paymentMethods.map((method) => (
                            <label
                                key={method.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                    selectedMethodId === method.id
                                        ? 'bg-primary/10 border-primary/40'
                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    checked={selectedMethodId === method.id}
                                    onChange={() => setSelectedMethodId(method.id)}
                                    className="accent-orange-500"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-semibold truncate">
                                        {method.label}
                                        {method.isDefault && (
                                            <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Default</span>
                                        )}
                                    </p>
                                    <p className="text-text-muted text-xs">
                                        {method.type === 'GCASH'
                                            ? `${method.name} • ${method.phone}`
                                            : `${method.brand || 'Card'} • **** ${method.last4} • ${method.expMonth}/${method.expYear}`}
                                    </p>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-surface rounded-2xl border border-white/5 p-4">
                <button
                    disabled={!canPlaceOrder}
                    className={`w-full py-3 rounded-xl font-bold text-base transition-all ${
                        canPlaceOrder
                            ? 'bg-primary text-background hover:brightness-110 active:scale-95'
                            : 'bg-white/10 text-text-muted cursor-not-allowed'
                    }`}
                    onClick={handlePlaceOrder}
                >
                    Place Order
                </button>
                <button
                    onClick={() => navigate('/shop')}
                    className="w-full mt-2 py-3 rounded-xl font-bold text-base transition-all bg-white/5 text-text-muted hover:text-white hover:bg-white/10"
                >
                    Cancel
                </button>
                {!hasPaymentMethods && (
                    <p className="text-xs text-text-muted mt-2 text-center">
                        Add a GCash or card payment method to continue.
                    </p>
                )}
            </section>
        </div>
    );
}
