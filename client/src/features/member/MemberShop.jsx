import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function MemberShop() {
    const { user } = useAuth();
    const isTrainer = user?.role === 'TRAINER';
    const { formatPrice } = useCurrency();
    const navigate = useNavigate();
    const { alert: showAlert } = useConfirm();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [addingToCart, setAddingToCart] = useState({});
    const [showCartModal, setShowCartModal] = useState(false);

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethodId, setSelectedMethodId] = useState(null);
    const [selectedPaymentType, setSelectedPaymentType] = useState('CASH'); // CASH | E_WALLET | CARD
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const cartStorageKey = `gymCart_${user?.role || 'guest'}`;

    useEffect(() => {
        fetchProducts();
        loadCart();
        fetchPaymentMethods();
    }, [user?.role]);

    useEffect(() => {
        setSelectedPaymentType('CASH');
    }, [isTrainer]);

    useEffect(() => {
        if (selectedPaymentType === 'CARD') {
            const cards = paymentMethods.filter((m) => ['CARD', 'CREDIT_CARD'].includes(String(m.type || '').toUpperCase()));
            const preferred = cards.find((m) => m.isDefault) || cards[0] || null;
            setSelectedMethodId(preferred?.id || null);
            return;
        }
        if (selectedPaymentType === 'E_WALLET') {
            const wallets = paymentMethods.filter((m) => ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase()));
            const preferred = wallets.find((m) => m.isDefault) || wallets[0] || null;
            setSelectedMethodId(preferred?.id || null);
            return;
        }
        setSelectedMethodId(null);
    }, [selectedPaymentType, paymentMethods]);

    const fetchPaymentMethods = async () => {
        try {
            if (isTrainer) {
                setPaymentMethods([]);
                setSelectedMethodId(null);
                return;
            }
            if (!user?.id) return;
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) {
                const res = await axios.get(`/api/members/${user?.id}/payment-methods`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPaymentMethods(res.data);
                if (res.data.length > 0) setSelectedMethodId(res.data[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch payment methods");
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Failed to fetch products");
        } finally {
            setLoading(false);
        }
    };

    const loadCart = () => {
        const savedCart = localStorage.getItem(cartStorageKey);
        if (savedCart) {
            setCart(JSON.parse(savedCart));
        }
    };

    const saveCart = (updatedCart) => {
        localStorage.setItem(cartStorageKey, JSON.stringify(updatedCart));
        setCart(updatedCart);
    };

    const addToCart = (product) => {
        setAddingToCart(prev => ({ ...prev, [product.id]: true }));

        setTimeout(() => {
            const existingItem = cart.find(item => item.id === product.id);
            let updatedCart;

            if (existingItem) {
                // Increment quantity if already in cart
                updatedCart = cart.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                // Add new item to cart
                updatedCart = [...cart, { ...product, quantity: 1 }];
            }

            saveCart(updatedCart);
            setAddingToCart(prev => ({ ...prev, [product.id]: false }));
        }, 300);
    };

    const updateCartQuantity = (productId, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromCart(productId);
            return;
        }

        const updatedCart = cart.map(item =>
            item.id === productId
                ? { ...item, quantity: newQuantity }
                : item
        );
        saveCart(updatedCart);
    };

    const removeFromCart = (productId) => {
        const updatedCart = cart.filter(item => item.id !== productId);
        saveCart(updatedCart);
    };

    const getCartItemQuantity = (productId) => {
        const item = cart.find(item => item.id === productId);
        return item ? item.quantity : 0;
    };

    const getCartTotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const getTotalItems = () => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    };


    const handleCheckoutInit = () => {
        setShowCartModal(false);
        setShowPaymentModal(true);
    };

    const handleConfirmCheckout = async () => {
        if (isTrainer && selectedPaymentType !== 'CASH') {
            await showAlert({ title: 'Cash Only', message: 'Trainer shop currently supports cash checkout only.', type: 'warning' });
            return;
        }

        const selectedMethod = paymentMethods.find((m) => Number(m.id) === Number(selectedMethodId));
        const cardMethods = paymentMethods.filter((m) => ['CARD', 'CREDIT_CARD'].includes(String(m.type || '').toUpperCase()));
        const walletMethods = paymentMethods.filter((m) => ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase()));

        if (selectedPaymentType === 'CARD' && (!selectedMethodId || !selectedMethod || !cardMethods.some((m) => Number(m.id) === Number(selectedMethodId)))) {
            await showAlert({ title: 'Select Card', message: 'Please select a card method', type: 'warning' });
            return;
        }

        if (selectedPaymentType === 'E_WALLET' && (!selectedMethodId || !selectedMethod || !walletMethods.some((m) => Number(m.id) === Number(selectedMethodId)))) {
            await showAlert({ title: 'Select Wallet', message: 'Please select an e-wallet method', type: 'warning' });
            return;
        }

        setIsCheckingOut(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                items: cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price, name: i.name })),
                total: getCartTotal(),
                paymentType: selectedPaymentType === 'CASH'
                    ? 'CASH_PENDING'
                    : (selectedPaymentType === 'E_WALLET' ? String(selectedMethod?.type || '').toUpperCase() : 'CARD'),
                paymentMethodId: selectedPaymentType === 'CASH' ? null : selectedMethodId,
                gcashReference: null,
                gcashDate: null
            };

            await axios.post('/api/members/checkout', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setCart([]);
            saveCart([]);
            setShowPaymentModal(false);

            if (selectedPaymentType === 'CASH') {
                await showAlert({ title: 'Order Placed!', message: 'Please proceed to the cash register to complete your payment.', type: 'info' });
            } else {
                await showAlert({ title: 'Payment Successful!', message: 'Order placed successfully.', type: 'success' });
            }
        } catch (error) {
            console.error(error);
            await showAlert({ title: 'Checkout Failed', message: error.response?.data?.error || error.message, type: 'danger' });
        } finally {
            setIsCheckingOut(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading Shop...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 px-4 max-w-6xl mx-auto">
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white">Products</h1>
                        <p className="text-text-muted text-xs mt-0.5">{isTrainer ? 'Trainer shop products' : 'Gym inventory & available items'}</p>
                    </div>

                    {/* Cart Button */}
                    <button
                        onClick={() => setShowCartModal(true)}
                        className="relative flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded-lg px-3 py-2 transition-all active:scale-95"
                    >
                        <span className="material-icons-round text-primary text-lg">shopping_cart</span>
                        <span className="text-primary font-bold text-sm">
                            {getTotalItems()} items
                        </span>
                        {cart.length > 0 && (
                            <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                                {cart.length}
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {products.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <span className="material-icons-round text-3xl text-text-muted">shopping_bag</span>
                        </div>
                        <p className="text-text-muted text-sm">No products available</p>
                    </div>
                ) : (
                    products.map(p => {
                        const isSoldOut = !p.stock || p.stock === 0;
                        const cartQuantity = getCartItemQuantity(p.id);
                        const isAdding = addingToCart[p.id];

                        return (
                            <div
                                key={p.id}
                                className={`rounded-xl border border-white/5 overflow-hidden flex flex-col transition-all group  ${isSoldOut
                                    ? 'bg-black/40 opacity-60 border-white/5'
                                    : 'bg-surface hover:border-primary/30'
                                    }`}
                            >
                                {/* Product Image */}
                                <div className="aspect-square bg-white/5 overflow-hidden relative">
                                    {p.imageUrl ? (
                                        <img
                                            src={p.imageUrl}
                                            alt={p.name}
                                            className={`w-full h-full object-cover ${!isSoldOut && 'group-hover:scale-105 transition-transform duration-300'
                                                }`}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-icons-round text-5xl text-white/10">shopping_bag</span>
                                        </div>
                                    )}

                                    {/* Sold Out Overlay */}
                                    {isSoldOut && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                            <div className="text-center">
                                                <span className="material-icons-round text-4xl text-white/80 block mb-1">block</span>
                                                <p className="text-white font-bold text-sm">Sold Out</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Category Tag */}
                                    {p.category && (
                                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md">
                                            <span className="text-white/90 text-xs font-medium">{p.category}</span>
                                        </div>
                                    )}

                                    {/* Cart Quantity Badge */}
                                    {cartQuantity > 0 && (
                                        <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow-lg">
                                            {cartQuantity}
                                        </div>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="p-3 flex flex-col flex-1">
                                    <h3 className="font-bold text-white text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{p.name}</h3>

                                    {/* Description */}
                                    <p className="text-text-muted text-xs line-clamp-2 mb-3 flex-1">
                                        {p.description || 'No description available'}
                                    </p>

                                    <div className="space-y-2">
                                        {/* Price */}
                                        <div className="text-primary font-bold text-base">{formatPrice(p.price)}</div>

                                        {/* Stock Status */}
                                        <div className={`text-xs font-medium ${isSoldOut
                                            ? 'text-red-400/70'
                                            : p.stock <= 5
                                                ? 'text-yellow-400'
                                                : 'text-green-400'
                                            }`}>
                                            {isSoldOut
                                                ? 'Out of Stock'
                                                : p.stock <= 5
                                                    ? `Only ${p.stock} left`
                                                    : `${p.stock} in stock`
                                            }
                                        </div>

                                        {/* Add to Cart Button */}
                                        {!isSoldOut && (
                                            <button
                                                onClick={() => addToCart(p)}
                                                disabled={isAdding}
                                                className="w-full bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-lg py-2.5 px-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-3"
                                            >
                                                {isAdding ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        <span>Adding...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-icons-round text-lg">add_shopping_cart</span>
                                                        <span>Add to Cart</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {cart.length > 0 && (
                <div className="fixed left-4 right-4 bottom-[5.25rem] sm:left-auto sm:right-6 sm:bottom-6 sm:w-[360px] z-40">
                    <div className="bg-surface/95 backdrop-blur border border-primary/30 rounded-2xl p-3 shadow-2xl shadow-black/40">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0">
                                <p className="text-white text-sm font-semibold truncate">
                                    {getTotalItems()} item{getTotalItems() > 1 ? 's' : ''} in cart
                                </p>
                                <p className="text-primary text-sm font-bold">{formatPrice(getCartTotal())}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCartModal(true)}
                                className="px-3 py-2 rounded-lg border border-white/10 text-text-secondary hover:text-white hover:bg-white/10 text-xs font-semibold"
                            >
                                View Cart
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleCheckoutInit}
                            className="w-full bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl py-3 text-sm font-bold transition-all"
                        >
                            Proceed to Checkout
                        </button>
                    </div>
                </div>
            )}

            {/* Cart Modal */}
            {showCartModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div
                        className="bg-surface border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <span className="material-icons-round text-primary text-2xl">shopping_cart</span>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Shopping Cart</h2>
                                    <p className="text-text-muted text-xs">{getTotalItems()} items in cart</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCartModal(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                            >
                                <span className="material-icons-round text-white/70">close</span>
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {cart.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <span className="material-icons-round text-4xl text-text-muted">shopping_cart</span>
                                    </div>
                                    <p className="text-text-muted text-sm mb-2">Your cart is empty</p>
                                    <p className="text-text-muted text-xs">Add some products to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cart.map(item => (
                                        <div key={item.id} className="bg-black/20 border border-white/5 rounded-xl p-3 flex gap-3">
                                            {/* Product Image */}
                                            <div className="w-20 h-20 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                                                {item.imageUrl ? (
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <span className="material-icons-round text-2xl text-white/10">shopping_bag</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Product Info */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-white text-sm mb-1 line-clamp-1">{item.name}</h3>
                                                <p className="text-primary font-bold text-sm mb-2">{formatPrice(item.price)}</p>

                                                {/* Quantity Controls */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                                        className="w-7 h-7 bg-white/10 hover:bg-white/15 rounded-lg flex items-center justify-center transition-all"
                                                    >
                                                        <span className="material-icons-round text-white text-sm">remove</span>
                                                    </button>
                                                    <span className="text-white font-semibold text-sm min-w-[2rem] text-center">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                                        className="w-7 h-7 bg-white/10 hover:bg-white/15 rounded-lg flex items-center justify-center transition-all"
                                                    >
                                                        <span className="material-icons-round text-white text-sm">add</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Remove Button & Subtotal */}
                                            <div className="flex flex-col items-end justify-between">
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 rounded-lg flex items-center justify-center transition-all"
                                                >
                                                    <span className="material-icons-round text-red-400 text-sm">delete</span>
                                                </button>
                                                <p className="text-white font-bold text-sm">{formatPrice(item.price * item.quantity)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart Footer */}
                        {cart.length > 0 && (
                            <div className="p-4 border-t border-white/10 space-y-3">
                                {/* Total */}
                                <div className="flex items-center justify-between">
                                    <span className="text-text-muted text-sm">Total ({getTotalItems()} items)</span>
                                    <span className="text-white font-bold text-xl">{formatPrice(getCartTotal())}</span>
                                </div>

                                {/* Checkout Button */}
                                <button
                                    onClick={handleCheckoutInit}
                                    className="w-full bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl py-3.5 px-4 font-bold text-base transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round">shopping_bag</span>
                                    <span>Proceed to Checkout</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Payment Selection Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#111111] border border-white/5 rounded-3xl w-full max-w-md p-6 space-y-6 my-auto shadow-2xl">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-white">Order Details</h2>
                            <p className="text-text-muted text-xs">Review your items and choose payment method</p>
                        </div>

                        {/* Items Section */}
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-4">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-white font-bold text-sm">Items</h3>
                                <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">{getTotalItems()} total</span>
                            </div>

                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <div className="w-14 h-14 bg-black/40 rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <span className="material-icons-round text-xl text-white/10">shopping_bag</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-white text-sm font-bold truncate">{item.name}</h4>
                                                <span className="text-white text-sm font-bold ml-2">
                                                    {formatPrice(item.price * item.quantity)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <p className="text-text-muted text-xs">Qty: {item.quantity}</p>
                                                <p className="text-text-muted text-[10px]">{formatPrice(item.price)} each</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                <span className="text-text-muted text-sm font-medium">Subtotal</span>
                                <span className="text-white font-bold text-lg">{formatPrice(getCartTotal())}</span>
                            </div>
                        </div>

                        {/* Payment Method Section */}
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-white font-bold text-sm">Payment Method</h3>
                                {!isTrainer && (
                                    <button
                                        onClick={() => { setShowPaymentModal(false); navigate('/payment-methods'); }}
                                        className="text-primary text-[10px] font-bold uppercase hover:underline"
                                    >
                                        Manage methods
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                                {(isTrainer ? ['CASH'] : ['CASH', 'E_WALLET', 'CARD']).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedPaymentType(type)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedPaymentType === type
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'text-text-muted hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {type === 'CARD' ? 'Card' : type === 'E_WALLET' ? 'E-Wallet' : 'Cash'}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {selectedPaymentType === 'CASH' && (
                                    <div className="text-center py-4 px-2 border border-white/5 rounded-xl bg-black/20">
                                        <span className="material-icons-round text-3xl text-primary/80 mb-2">storefront</span>
                                        <p className="text-white text-xs font-bold mb-1">Pay at Counter</p>
                                        <p className="text-text-muted text-[10px] leading-relaxed">
                                            Your order will be saved as PENDING. Please proceed to the cash register to complete your payment.
                                        </p>
                                    </div>
                                )}

                                {selectedPaymentType === 'CARD' && (
                                    paymentMethods.filter((method) => ['CARD', 'CREDIT_CARD'].includes(String(method.type || '').toUpperCase())).length === 0 ? (
                                        <div className="text-center py-6 border border-white/5 rounded-xl bg-black/20">
                                            <p className="text-white text-xs mb-1">No linked cards found</p>
                                            <p className="text-text-muted text-[10px]">Please go to Profile to add a card.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {paymentMethods.filter((method) => ['CARD', 'CREDIT_CARD'].includes(String(method.type || '').toUpperCase())).map(method => (
                                                <label
                                                    key={method.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMethodId === method.id
                                                        ? 'bg-primary/5 border-primary/40'
                                                        : 'bg-black/20 border-white/5 hover:border-white/10'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="paymentMethod"
                                                        className="hidden"
                                                        checked={selectedMethodId === method.id}
                                                        onChange={() => setSelectedMethodId(method.id)}
                                                    />
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedMethodId === method.id
                                                        ? 'border-primary ring-2 ring-primary/20'
                                                        : 'border-white/20'
                                                        }`}>
                                                        {selectedMethodId === method.id && <div className="w-2 h-2 bg-primary rounded-full" />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white text-xs uppercase tracking-tight">{method.brand || 'CARD'}</span>
                                                            {method.isDefault && <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-black uppercase">Default</span>}
                                                        </div>
                                                        <span className="text-text-muted text-[10px] block mt-0.5 tracking-wider">**** {method.last4}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )
                                )}

                                {selectedPaymentType === 'E_WALLET' && (
                                    paymentMethods.filter((method) => ['GCASH', 'MAYA'].includes(String(method.type || '').toUpperCase())).length === 0 ? (
                                        <div className="text-center py-6 border border-white/5 rounded-xl bg-black/20">
                                            <p className="text-white text-xs mb-1">No linked e-wallets found</p>
                                            <p className="text-text-muted text-[10px]">Please go to Profile to add GCash or Maya.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {paymentMethods
                                                .filter((method) => ['GCASH', 'MAYA'].includes(String(method.type || '').toUpperCase()))
                                                .map((method) => (
                                                    <label
                                                        key={method.id}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMethodId === method.id
                                                            ? 'bg-primary/5 border-primary/40'
                                                            : 'bg-black/20 border-white/5 hover:border-white/10'
                                                            }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="paymentMethod"
                                                            className="hidden"
                                                            checked={selectedMethodId === method.id}
                                                            onChange={() => setSelectedMethodId(method.id)}
                                                        />
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedMethodId === method.id
                                                            ? 'border-primary ring-2 ring-primary/20'
                                                            : 'border-white/20'
                                                            }`}>
                                                            {selectedMethodId === method.id && <div className="w-2 h-2 bg-primary rounded-full" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-white text-xs uppercase tracking-tight">
                                                                    {String(method.type || '').toUpperCase() === 'MAYA' ? 'Maya' : 'GCash'}
                                                                </span>
                                                                {method.isDefault && <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-black uppercase">Default</span>}
                                                            </div>
                                                            <span className="text-text-muted text-[10px] block mt-0.5 tracking-wider">**** {method.last4}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3 pt-2">
                            <button
                                onClick={handleConfirmCheckout}
                                disabled={
                                    isCheckingOut ||
                                    ((selectedPaymentType === 'CARD' || selectedPaymentType === 'E_WALLET') && !selectedMethodId)
                                }
                                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-2 text-base"
                            >
                                {isCheckingOut ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <span>Place Order</span>
                                )}
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="w-full bg-white/5 hover:bg-white/10 text-text-muted font-bold py-4 rounded-2xl transition-all active:scale-95 text-base"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
