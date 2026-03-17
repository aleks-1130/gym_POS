import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import MemberPageHeader from './components/MemberPageHeader';

export default function MemberShop() {
    const { user } = useAuth();
    const isTrainer = user?.role === 'TRAINER';
    const { formatPrice } = useCurrency();
    const navigate = useNavigate();
    const { alert: showAlert } = useConfirm();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [addingToCart, setAddingToCart] = useState({});
    const [showCartModal, setShowCartModal] = useState(false);
    const [cartPopup, setCartPopup] = useState({ show: false, itemName: '' });
    const cartPopupTimerRef = useRef(null);
    const [activeCategory, setActiveCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('featured');
    const [viewMode, setViewMode] = useState('compact'); // compact | detailed

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
        return () => {
            if (cartPopupTimerRef.current) {
                clearTimeout(cartPopupTimerRef.current);
            }
        };
    }, []);

    const showAddToCartPopup = (itemName) => {
        if (cartPopupTimerRef.current) {
            clearTimeout(cartPopupTimerRef.current);
        }
        setCartPopup({ show: true, itemName });
        cartPopupTimerRef.current = setTimeout(() => {
            setCartPopup((prev) => ({ ...prev, show: false }));
        }, 1600);
    };

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
            
            const res = await axios.get(`/api/members/${user?.id}/payment-methods`);
            setPaymentMethods(res.data);
            if (res.data.length > 0) setSelectedMethodId(res.data[0].id);
        } catch (error) {
            console.error("Failed to fetch payment methods", error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Failed to fetch products", error);
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

    const getSessionId = () => {
        let sid = sessionId;
        if (!sid) {
            sid = localStorage.getItem('guestSessionId');
            if (!sid) {
                sid = `SESSION_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
                localStorage.setItem('guestSessionId', sid);
            }
            setSessionId(sid);
        }
        return sid;
    };

    const addToCart = async (product) => {
        setAddingToCart(prev => ({ ...prev, [product.id]: true }));
        const sid = getSessionId();

        try {
            const existingItem = cart.find(item => item.id === product.id);
            const newQuantity = existingItem ? existingItem.quantity + 1 : 1;

            if (newQuantity > (product.stock || 0)) {
                await showAlert({ title: 'Stock Limit', message: `Cannot add more than available stock (${product.stock}).`, type: 'warning' });
                return;
            }

            
            

            await axios.post('/api/pos/reserve', {
                sessionId: sid,
                productId: product.id,
                quantity: newQuantity
            });

            let updatedCart;
            if (existingItem) {
                updatedCart = cart.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: newQuantity }
                        : item
                );
            } else {
                updatedCart = [...cart, { ...product, quantity: 1 }];
            }

            saveCart(updatedCart);
            showAddToCartPopup(product.name);
        } catch (error) {
            console.error("Failed to reserve stock", error);
            await showAlert({ 
                title: 'Reservation Failed', 
                message: error.response?.data?.error || 'Failed to add item to cart due to stock limits.', 
                type: 'warning' 
            });
        } finally {
            setAddingToCart(prev => ({ ...prev, [product.id]: false }));
        }
    };

    const updateCartQuantity = async (productId, newQuantity) => {
        if (newQuantity <= 0) {
            await removeFromCart(productId);
            return;
        }

        const product = products.find(p => p.id === productId);
        if (product && newQuantity > (product.stock || 0)) {
            await showAlert({ title: 'Stock Limit', message: `Cannot exceed available stock (${product.stock}).`, type: 'warning' });
            return;
        }

        const sid = getSessionId();
        try {
            
            

            await axios.post('/api/pos/reserve', {
                sessionId: sid,
                productId: productId,
                quantity: newQuantity
            });

            const updatedCart = cart.map(item =>
                item.id === productId
                    ? { ...item, quantity: newQuantity }
                    : item
            );
            saveCart(updatedCart);
        } catch (error) {
            console.error("Failed to update stock reservation", error);
            await showAlert({ title: 'Stock Update Failed', message: error.response?.data?.error || 'Failed to update quantity.', type: 'warning' });
        }
    };

    const removeFromCart = async (productId) => {
        const sid = getSessionId();
        try {
            
            

            await axios.delete(`/api/pos/reserve/${sid}/${productId}`);
            const updatedCart = cart.filter(item => item.id !== productId);
            saveCart(updatedCart);
        } catch (error) {
            console.error("Failed to release stock reservation", error);
            const updatedCart = cart.filter(item => item.id !== productId);
            saveCart(updatedCart);
        }
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

    const categories = useMemo(() => {
        const values = products
            .map((p) => String(p.category || '').trim())
            .filter(Boolean);
        return ['ALL', ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))];
    }, [products]);

    const visibleProducts = useMemo(() => {
        let list = products;

        if (activeCategory !== 'ALL') {
            list = list.filter((p) => String(p.category || '').trim() === activeCategory);
        }

        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((p) => {
                const name = String(p.name || '').toLowerCase();
                const desc = String(p.description || '').toLowerCase();
                const category = String(p.category || '').toLowerCase();
                return name.includes(q) || desc.includes(q) || category.includes(q);
            });
        }

        const sorted = [...list];
        if (sortBy === 'price-asc') sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        if (sortBy === 'price-desc') sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        if (sortBy === 'name-az') sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        if (sortBy === 'stock-desc') sorted.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));

        return sorted;
    }, [products, activeCategory, searchQuery, sortBy]);

    useEffect(() => {
        if (!categories.includes(activeCategory)) {
            setActiveCategory('ALL');
        }
    }, [categories, activeCategory]);
    const isDetailedView = viewMode === 'detailed';


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

            await axios.post('/api/members/checkout', payload);

            await axios.delete(`/api/pos/reserve/${sessionId || getSessionId()}`).catch(e => console.error("Failed to clear redis sessionId", e));

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
        <div className="max-w-6xl mx-auto">
            <MemberPageHeader
                title="Products"
                subtitle="Gym inventory and available items"
                icon="storefront"
            />

            <div className="mt-4 mb-3 space-y-2.5">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <span className="material-icons-round text-base text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products..."
                            className="w-full bg-surface border border-white/10 rounded-lg h-10 pl-9 pr-9 text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary/50"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded bg-white/10 text-text-muted hover:text-white"
                                aria-label="Clear search"
                            >
                                <span className="material-icons-round text-sm leading-none">close</span>
                            </button>
                        )}
                    </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-surface border border-white/10 rounded-lg h-10 px-2.5 text-xs font-semibold text-white focus:outline-none focus:border-primary/50"
                    >
                        <option value="featured">Featured</option>
                        <option value="price-asc">Price: Low-High</option>
                        <option value="price-desc">Price: High-Low</option>
                        <option value="name-az">Name A-Z</option>
                        <option value="stock-desc">Most Stock</option>
                    </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wide">Categories</p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => setActiveCategory(category)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${activeCategory === category
                                        ? 'bg-primary text-white border-primary/70'
                                        : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-surface border border-white/10 rounded-lg p-1 shrink-0 self-start">
                        <button
                            type="button"
                            onClick={() => setViewMode('compact')}
                            className={`w-8 h-8 rounded-md flex items-center justify-center ${viewMode === 'compact' ? 'bg-primary text-white' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                            aria-label="Compact view"
                        >
                            <span className="material-icons-round text-base">grid_view</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('detailed')}
                            className={`w-8 h-8 rounded-md flex items-center justify-center ${viewMode === 'detailed' ? 'bg-primary text-white' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                            aria-label="Detailed view"
                        >
                            <span className="material-icons-round text-base">view_agenda</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className={`grid ${isDetailedView ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'}`}>
                {products.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <span className="material-icons-round text-3xl text-text-muted">shopping_bag</span>
                        </div>
                        <p className="text-text-muted text-sm">No products available</p>
                    </div>
                ) : visibleProducts.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <span className="material-icons-round text-3xl text-text-muted">filter_alt_off</span>
                        </div>
                        <p className="text-text-muted text-sm">{searchQuery ? 'No products match your search' : 'No products in this category'}</p>
                    </div>
                ) : (
                    visibleProducts.map(p => {
                        const isSoldOut = !p.stock || p.stock === 0;
                        const cartQuantity = getCartItemQuantity(p.id);
                        const isAdding = Boolean(addingToCart?.[p.id]);

                        return (
                            <div
                                key={p.id}
                                className={`${isDetailedView ? 'rounded-2xl border-white/10' : 'rounded-xl border-white/5'} overflow-hidden border flex flex-col transition-all group  ${isSoldOut
                                    ? 'bg-black/40 opacity-60'
                                    : 'bg-surface hover:border-primary/30'
                                    }`}
                            >
                                {/* Product Image */}
                                <div className={`${isDetailedView ? 'aspect-[4/3]' : 'aspect-square'} bg-white/5 overflow-hidden relative`}>
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
                                    <h3 className={`${isDetailedView ? 'text-base min-h-[2.75rem]' : 'text-sm min-h-[2.5rem]'} font-bold text-white line-clamp-2 mb-2`}>{p.name}</h3>

                                    {/* Description */}
                                    <p className={`text-text-muted ${isDetailedView ? 'text-sm line-clamp-3' : 'text-xs line-clamp-2'} mb-3 flex-1`}>
                                        {p.description || 'No description available'}
                                    </p>

                                    <div className="space-y-2">
                                        {/* Price */}
                                        <div className={`text-primary font-bold ${isDetailedView ? 'text-lg' : 'text-base'}`}>{formatPrice(p.price)}</div>

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

            {cartPopup.show && (
                <div className="fixed right-4 sm:right-6 bottom-[10.25rem] sm:bottom-24 z-40 pointer-events-none">
                    <div className="bg-emerald-500/95 border border-emerald-300/40 text-white rounded-xl px-3 py-2 shadow-2xl shadow-black/40 animate-bounce">
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                            <span className="material-icons-round text-base">check_circle</span>
                            Added to cart
                        </div>
                        <p className="text-[11px] text-white/90 mt-0.5 max-w-[180px] truncate">{cartPopup.itemName}</p>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => setShowCartModal(true)}
                className="fixed right-4 sm:right-6 bottom-[5.25rem] sm:bottom-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-2xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center"
                aria-label="Open cart"
            >
                <span className="material-icons-round text-2xl">shopping_cart</span>
                {getTotalItems() > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-white text-primary text-[11px] font-bold flex items-center justify-center border border-primary/20">
                        {getTotalItems()}
                    </span>
                )}
            </button>

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
