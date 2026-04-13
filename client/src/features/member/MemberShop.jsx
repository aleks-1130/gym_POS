import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import MemberPageHeader from './components/MemberPageHeader';
import CustomSelect from '../../components/common/CustomSelect';

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
        <div className="max-w-6xl mx-auto px-1 sm:px-2 pb-24">
            <MemberPageHeader
                title="Supplements & Gear"
                subtitle="Fuel your performance with our curated selection"
                icon="shopping_basket"
            />

            <div className="mt-8 mb-8 space-y-6">
                {/* Unified Search & Filters */}
                <div className="relative z-[100] rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl p-3 sm:p-4 shadow-2xl flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <span className="material-icons-round text-xl text-primary absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Find products..."
                            className="w-full bg-white/5 border border-white/5 rounded-2xl h-14 pl-12 pr-12 text-[15px] font-medium text-white placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/10 transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-white/10 text-white/50 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all"
                                aria-label="Clear search"
                            >
                                <span className="material-icons-round text-base">close</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        <div className="flex-1 md:w-48 md:flex-none">
                            <CustomSelect
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                options={[
                                    { value: 'featured', label: 'Featured' },
                                    { value: 'price-asc', label: 'Price: Low-High' },
                                    { value: 'price-desc', label: 'Price: High-Low' },
                                    { value: 'name-az', label: 'Name A-Z' },
                                    { value: 'stock-desc', label: 'Stock Status' }
                                ]}
                                className="w-full"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-2xl p-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setViewMode('compact')}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${viewMode === 'compact' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                                aria-label="Grid view"
                            >
                                <span className="material-icons-round text-xl">grid_view</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('detailed')}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${viewMode === 'detailed' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                                aria-label="List view"
                            >
                                <span className="material-icons-round text-xl">view_agenda</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Categories Scrollable Tray */}
                <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] ml-2">Shop Categories</p>
                    <div className="flex flex-wrap gap-2.5">
                        {categories.map((category) => {
                            const isActive = activeCategory === category;
                            return (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => setActiveCategory(category)}
                                    className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${isActive
                                        ? 'bg-white text-background shadow-xl shadow-white/10 scale-105 z-10'
                                        : 'bg-white/5 border border-white/5 text-text-muted hover:text-white hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    {category}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className={`grid ${isDetailedView ? 'grid-cols-1 md:grid-cols-2 gap-6' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}`}>
                {products.length === 0 ? (
                    <div className="col-span-full text-center py-24 rounded-[40px] border border-white/5 bg-white/5">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-icons-round text-4xl text-text-muted/30">shopping_bag</span>
                        </div>
                        <p className="text-text-muted font-bold">No products available yet</p>
                    </div>
                ) : visibleProducts.length === 0 ? (
                    <div className="col-span-full text-center py-24 rounded-[40px] border border-white/5 bg-white/5">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-icons-round text-4xl text-text-muted/30">filter_alt_off</span>
                        </div>
                        <p className="text-text-muted font-bold">{searchQuery ? 'No matches for your search' : 'No products in this category'}</p>
                    </div>
                ) : (
                    visibleProducts.map(p => {
                        const isSoldOut = !p.stock || p.stock === 0;
                        const cartQuantity = getCartItemQuantity(p.id);
                        const isAdding = Boolean(addingToCart?.[p.id]);

                        return (
                            <div
                                key={p.id}
                                className={`group relative flex flex-col rounded-[32px] border transition-all duration-500 hover:-translate-y-2 ${isSoldOut
                                    ? 'bg-black/40 border-white/5 grayscale pointer-events-none'
                                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]'
                                    }`}
                            >
                                {/* Media Container */}
                                <div className={`relative overflow-hidden ${isDetailedView ? 'aspect-[16/10]' : 'aspect-square'} rounded-[28px] m-2`}>
                                    {p.imageUrl ? (
                                        <img
                                            src={p.imageUrl}
                                            alt={p.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                            <span className="material-icons-round text-6xl text-white/10">inventory_2</span>
                                        </div>
                                    )}

                                    {/* Glassy Overlays */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                                    
                                    {p.category && (
                                        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10">
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{p.category}</span>
                                        </div>
                                    )}

                                    {cartQuantity > 0 && (
                                        <div className="absolute top-4 right-4 w-10 h-10 rounded-2xl bg-primary text-background flex items-center justify-center font-black text-sm shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)] animate-in zoom-in">
                                            {cartQuantity}
                                        </div>
                                    )}

                                    {isSoldOut && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                            <div className="px-5 py-2 rounded-2xl bg-rose-500/20 border border-rose-500/30 backdrop-blur-xl">
                                                <p className="text-[11px] font-black text-rose-400 uppercase tracking-widest">Sold Out</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-5 pt-3 flex flex-col flex-1">
                                    <div className="flex justify-between items-start gap-4 mb-3">
                                        <h3 className="text-lg font-black text-white leading-tight line-clamp-2">{p.name}</h3>
                                        <div className="text-xl font-black text-primary shrink-0">{formatPrice(p.price)}</div>
                                    </div>

                                    <p className="text-[13px] text-text-muted font-medium line-clamp-2 mb-6 leading-relaxed flex-1">
                                        {p.description || 'Premium gym gear designed for performance and longevity.'}
                                    </p>

                                    <div className="flex items-center justify-between gap-4 mt-auto">
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isSoldOut
                                            ? 'bg-rose-500/5 border-rose-500/10 text-rose-400/50'
                                            : p.stock <= 5
                                                ? 'bg-amber-500/5 border-amber-500/10 text-amber-400'
                                                : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${isSoldOut ? 'bg-rose-500/30' : p.stock <= 5 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                {isSoldOut ? 'Restocking' : p.stock <= 5 ? `Only ${p.stock}` : `${p.stock} in stock`}
                                            </span>
                                        </div>

                                        {!isSoldOut && (
                                            <button
                                                onClick={() => addToCart(p)}
                                                disabled={isAdding}
                                                className="h-12 flex-1 rounded-2xl bg-white text-background hover:bg-primary hover:text-white transition-all duration-300 font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-black/20"
                                            >
                                                {isAdding ? (
                                                    <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <span className="material-icons-round text-base">add_shopping_cart</span>
                                                        <span>Add</span>
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
                <div className="fixed right-6 bottom-32 z-[60] pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-emerald-500 border border-emerald-400/30 text-white rounded-[24px] px-5 py-4 shadow-[0_20px_40px_rgba(16,185,129,0.3)] backdrop-blur-xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center uppercase font-black text-xs">
                            <span className="material-icons-round text-xl">done</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/80 leading-none mb-1">Added to Cart</p>
                            <p className="text-[13px] font-bold text-white max-w-[180px] truncate">{cartPopup.itemName}</p>
                        </div>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => setShowCartModal(true)}
                className="fixed right-6 bottom-28 z-50 w-16 h-16 rounded-[24px] bg-primary text-background shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)] hover:scale-110 active:scale-90 transition-all duration-300 flex items-center justify-center group"
                aria-label="Open cart"
            >
                <span className="material-icons-round text-2xl group-hover:rotate-12 transition-transform">shopping_basket</span>
                {getTotalItems() > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-xl bg-white text-background text-[11px] font-black flex items-center justify-center shadow-lg animate-in zoom-in border border-primary/10">
                        {getTotalItems()}
                    </span>
                )}
            </button>

            {/* Cart Drawer-style Modal */}
            {showCartModal && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowCartModal(false)} />
                    <div className="relative w-full max-w-lg bg-[#14161a] border-l border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                        {/* Drawer Header */}
                        <div className="p-8 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-1">Your Basket</p>
                                <h2 className="text-3xl font-black text-white">Shopping Cart</h2>
                            </div>
                            <button
                                onClick={() => setShowCartModal(false)}
                                className="w-12 h-12 rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                            >
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-4 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                                    <div className="w-24 h-24 rounded-[32px] bg-white/5 flex items-center justify-center">
                                        <span className="material-icons-round text-5xl">remove_shopping_cart</span>
                                    </div>
                                    <p className="text-sm font-bold text-white px-8">Your cart feels a bit lonely. Add some fuel to your workout!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {cart.map(item => (
                                        <div key={item.id} className="group relative bg-white/[0.03] border border-white/5 rounded-[28px] p-4 flex gap-5 transition-all hover:bg-white/[0.06]">
                                            {/* Media */}
                                            <div className="w-20 h-20 bg-black/40 rounded-[20px] overflow-hidden flex-shrink-0 border border-white/10">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white/10">
                                                        <span className="material-icons-round text-3xl">inventory_2</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0 py-1">
                                                <h3 className="text-sm font-black text-white line-clamp-1 mb-1">{item.name}</h3>
                                                <p className="text-[15px] font-black text-primary mb-3">{formatPrice(item.price)}</p>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center bg-black/40 border border-white/5 rounded-xl p-1">
                                                        <button
                                                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-75"
                                                        >
                                                            <span className="material-icons-round text-lg">remove</span>
                                                        </button>
                                                        <span className="text-[13px] font-black text-white w-8 text-center">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-75"
                                                        >
                                                            <span className="material-icons-round text-lg">add</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row Total & Remove */}
                                            <div className="flex flex-col items-end justify-between py-1">
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <span className="material-icons-round text-lg text-rose-500">delete</span>
                                                </button>
                                                <p className="text-sm font-black text-white">{formatPrice(item.price * item.quantity)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {cart.length > 0 && (
                            <div className="p-8 border-t border-white/5 bg-black/20 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Total Balance</p>
                                        <p className="text-4xl font-black text-white">{formatPrice(getCartTotal())}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Basket Size</p>
                                        <p className="text-xl font-black text-white/50">{getTotalItems()} Items</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCheckoutInit}
                                    className="w-full h-16 rounded-[24px] bg-primary text-background font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                >
                                    <span className="material-icons-round">payments</span>
                                    <span>Initiate Checkout</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Payment Selection Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="relative w-full max-w-sm rounded-[40px] border border-white/10 bg-[#16181d] p-8 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
                        <div className="text-center space-y-2">
                            <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Secure Checkout</p>
                            <h2 className="text-2xl font-black text-white">Select Payment</h2>
                        </div>

                        {/* Order Summary Lite */}
                        <div className="rounded-3xl bg-white/5 border border-white/5 p-5 space-y-4">
                            <div className="space-y-2 max-h-32 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center text-[13px]">
                                        <span className="text-text-muted font-medium truncate pr-4">{item.quantity}x {item.name}</span>
                                        <span className="text-white font-black">{formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                                <span className="text-sm font-black text-white uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-primary">{formatPrice(getCartTotal())}</span>
                            </div>
                        </div>

                        {/* Payment Options */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-2 p-1.5 bg-black/40 rounded-3xl border border-white/5">
                                {(isTrainer ? ['CASH'] : ['CASH', 'E_WALLET', 'CARD']).map(type => {
                                    const isActive = selectedPaymentType === type;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setSelectedPaymentType(type)}
                                            className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${isActive
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

                            {/* Sub-selection for methods if needed */}
                            {(selectedPaymentType === 'CARD' || selectedPaymentType === 'E_WALLET') && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-2">Choose Source</p>
                                    <div className="space-y-2">
                                        {paymentMethods
                                            .filter(m => {
                                                if (selectedPaymentType === 'CARD') return ['CARD', 'CREDIT_CARD'].includes(String(m.type || '').toUpperCase());
                                                return ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase());
                                            })
                                            .map(method => (
                                                <button
                                                    key={method.id}
                                                    onClick={() => setSelectedMethodId(method.id)}
                                                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedMethodId === method.id
                                                        ? 'bg-primary/10 border-primary text-white shadow-lg shadow-primary/10'
                                                        : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20'
                                                        }`}
                                                >
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="text-[11px] font-black uppercase tracking-widest">{method.brand || method.type}</span>
                                                        <span className="text-[10px] font-medium opacity-50">**** {method.last4}</span>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedMethodId === method.id ? 'border-primary bg-primary' : 'border-white/20'}`}>
                                                        {selectedMethodId === method.id && <span className="material-icons-round text-[14px] text-background font-black">done</span>}
                                                    </div>
                                                </button>
                                            ))}
                                        
                                        {paymentMethods.filter(m => {
                                            if (selectedPaymentType === 'CARD') return ['CARD', 'CREDIT_CARD'].includes(String(m.type || '').toUpperCase());
                                            return ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase());
                                        }).length === 0 && (
                                            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-center">
                                                <p className="text-[11px] text-rose-400 font-black uppercase tracking-widest">No Sources Linked</p>
                                                <button onClick={() => navigate('/payment-methods')} className="text-[10px] text-primary font-black uppercase tracking-widest mt-2 hover:underline">Add Method</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-4 pt-4">
                            <button
                                onClick={handleConfirmCheckout}
                                disabled={isCheckingOut || ((selectedPaymentType === 'CARD' || selectedPaymentType === 'E_WALLET') && !selectedMethodId)}
                                className="w-full h-16 rounded-[24px] bg-primary text-background font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                            >
                                {isCheckingOut ? (
                                    <div className="w-6 h-6 border-4 border-background/30 border-t-background rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-icons-round">verified</span>
                                        <span>Confirm Payment</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="w-full h-14 rounded-[24px] bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-white/50 hover:text-white hover:bg-white/10 transition-all"
                            >
                                Cancel Transaction
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
