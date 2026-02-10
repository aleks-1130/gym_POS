import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function MemberShop() {
    const { formatPrice } = useCurrency();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [addingToCart, setAddingToCart] = useState({});
    const [showCartModal, setShowCartModal] = useState(false);

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethodId, setSelectedMethodId] = useState(null);
    const [selectedPaymentType, setSelectedPaymentType] = useState('CARD'); // 'CARD' or 'GCASH'
    const [gcashDetails, setGcashDetails] = useState({ reference: '', date: '', time: '' });
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        fetchProducts();
        loadCart();
        fetchPaymentMethods();
    }, []);

    const fetchPaymentMethods = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const res = await axios.get('http://localhost:5000/api/payment-methods', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPaymentMethods(res.data);
                // Default to first card if exists
                if (res.data.length > 0) setSelectedMethodId(res.data[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch payment methods");
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Failed to fetch products");
        } finally {
            setLoading(false);
        }
    };

    const loadCart = () => {
        const savedCart = localStorage.getItem('gymCart');
        if (savedCart) {
            setCart(JSON.parse(savedCart));
        }
    };

    const saveCart = (updatedCart) => {
        localStorage.setItem('gymCart', JSON.stringify(updatedCart));
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
        if (selectedPaymentType === 'CARD' && !selectedMethodId && paymentMethods.length > 0) {
            alert("Please select a card");
            return;
        }

        if (selectedPaymentType === 'GCASH' && (!gcashDetails.reference || !gcashDetails.date || !gcashDetails.time)) {
            alert("Please enter GCash details");
            return;
        }

        setIsCheckingOut(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                items: cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price, name: i.name })),
                total: getCartTotal(),
                paymentType: selectedPaymentType === 'CASH' ? 'CASH_PENDING' : selectedPaymentType,
                paymentMethodId: selectedPaymentType === 'CARD' ? selectedMethodId : null,
                gcashReference: selectedPaymentType === 'GCASH' ? gcashDetails.reference : null,
                gcashDate: selectedPaymentType === 'GCASH' ? `${gcashDetails.date}T${gcashDetails.time}` : null
            };

            await axios.post('http://localhost:5000/api/members/checkout', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Success
            setCart([]);
            saveCart([]);
            setShowPaymentModal(false);

            if (selectedPaymentType === 'CASH') {
                alert("Order Placed! Please proceed to the cash register to complete your payment.");
            } else {
                alert("Payment Successful! Order placed.");
            }
        } catch (error) {
            console.error(error);
            alert("Checkout Failed: " + (error.response?.data?.error || error.message));
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
                        <p className="text-text-muted text-xs mt-0.5">Gym inventory & available items</p>
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Select Payment</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="text-text-muted hover:text-white">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-text-muted text-sm">Total Amount</span>
                                    <span className="text-primary font-bold text-2xl">{formatPrice(getCartTotal())}</span>
                                </div>
                            </div>

                            <h3 className="text-xs font-bold text-text-muted uppercase">Payment Method</h3>

                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setSelectedPaymentType('CARD')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${selectedPaymentType === 'CARD'
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white/5 text-text-muted border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    Saved Cards
                                </button>
                                <button
                                    onClick={() => setSelectedPaymentType('GCASH')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${selectedPaymentType === 'GCASH'
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white/5 text-text-muted border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    GCash
                                </button>
                                <button
                                    onClick={() => setSelectedPaymentType('CASH')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${selectedPaymentType === 'CASH'
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white/5 text-text-muted border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    Cash
                                </button>
                            </div>

                            {selectedPaymentType === 'CASH' && (
                                <div className="text-center py-6 border border-white/10 rounded-xl border-dashed bg-white/5">
                                    <span className="material-icons-round text-4xl text-white mb-2">storefront</span>
                                    <p className="text-white text-sm font-bold mb-1">Pay at Counter</p>
                                    <p className="text-text-muted text-xs px-4">
                                        Your order will be saved as PENDING. Please proceed to the cash register to complete your payment.
                                    </p>
                                </div>
                            )}

                            {selectedPaymentType === 'CARD' && (
                                paymentMethods.length === 0 ? (
                                    <div className="text-center py-6 border border-white/10 rounded-xl border-dashed bg-white/5">
                                        <p className="text-white text-sm mb-2">No linked cards found</p>
                                        <p className="text-text-muted text-xs">Please go to Profile to add a card.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {paymentMethods.map(method => (
                                            <label
                                                key={method.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMethodId === method.id
                                                    ? 'bg-primary/20 border-primary'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    className="hidden"
                                                    checked={selectedMethodId === method.id}
                                                    onChange={() => setSelectedMethodId(method.id)}
                                                />
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedMethodId === method.id ? 'border-primary' : 'border-white/30'
                                                    }`}>
                                                    {selectedMethodId === method.id && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                                </div>

                                                <div className="flex-1">
                                                    <span className="font-bold text-white text-sm mr-2">{method.brand}</span>
                                                    <span className="text-text-muted text-sm">•••• {method.last4}</span>
                                                </div>

                                                {method.isDefault && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/70">Default</span>}
                                            </label>
                                        ))}
                                    </div>
                                )
                            )}

                            {selectedPaymentType === 'GCASH' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text w-full text-text-muted text-xs font-medium mb-1">GCash Reference No.</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-primary outline-none"
                                            placeholder="Enter Transaction Ref No."
                                            value={gcashDetails.reference}
                                            onChange={e => setGcashDetails({ ...gcashDetails, reference: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-text-muted text-xs font-medium mb-1">Date</label>
                                            <input
                                                type="date"
                                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-primary outline-none"
                                                value={gcashDetails.date}
                                                onChange={e => setGcashDetails({ ...gcashDetails, date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-text-muted text-xs font-medium mb-1">Time</label>
                                            <input
                                                type="time"
                                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-primary outline-none"
                                                value={gcashDetails.time}
                                                onChange={e => setGcashDetails({ ...gcashDetails, time: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-text-muted bg-white/5 p-2 rounded-lg">
                                        <span className="material-icons-round text-xs align-middle mr-1">info</span>
                                        Please ensure details match your GCash receipt SMS/App.
                                    </p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleConfirmCheckout}
                            disabled={
                                isCheckingOut ||
                                (selectedPaymentType === 'CARD' && paymentMethods.length > 0 && !selectedMethodId) ||
                                (selectedPaymentType === 'GCASH' && (!gcashDetails.reference || !gcashDetails.date || !gcashDetails.time))
                            }
                            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isCheckingOut ? 'Processing...' : (selectedPaymentType === 'CASH' ? 'Place Order (Pay at Counter)' : `Pay ${formatPrice(getCartTotal())}`)}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
