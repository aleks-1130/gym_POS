import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../../context/ConfirmContext';
import TrainerPageHeader from './components/TrainerPageHeader';
import CustomSelect from '../../components/common/CustomSelect';

const STORAGE_KEYS = {
    cart: 'trainerShopCart',
    methods: 'trainerPaymentMethods'
};

export default function TrainerShop() {
    const { formatPrice } = useCurrency();
    const navigate = useNavigate();
    const { alert: showAlert } = useConfirm();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const [addingToCart, setAddingToCart] = useState({});
    const [showCartModal, setShowCartModal] = useState(false);
    const [buyNowModal, setBuyNowModal] = useState({ open: false, product: null, quantity: '1' });
    const [cartPopup, setCartPopup] = useState({ show: false, itemName: '' });
    const cartPopupTimerRef = useRef(null);
    const [activeCategory, setActiveCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('featured');
    const [viewMode, setViewMode] = useState('compact'); // compact | detailed

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedMethodId, setSelectedMethodId] = useState(null);
    const [selectedPaymentType, setSelectedPaymentType] = useState('CASH');
    const [markAsSessionMaterial, setMarkAsSessionMaterial] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.cart);
        if (saved) setCart(JSON.parse(saved));

        const fetchProducts = async () => {
            try {
                const res = await axios.get('/api/products');
                setProducts(res.data || []);
            } catch (error) {
                console.error('Failed to fetch products', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const paymentMethods = useMemo(() => {
        const raw = localStorage.getItem(STORAGE_KEYS.methods);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    }, [showPaymentModal]);

    const cardMethods = paymentMethods.filter((m) => String(m.type || '').toUpperCase() === 'CARD');
    const walletMethods = paymentMethods.filter((m) => ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase()));

    useEffect(() => {
        const cards = paymentMethods.filter((m) => String(m.type || '').toUpperCase() === 'CARD');
        const wallets = paymentMethods.filter((m) => ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase()));

        if (selectedPaymentType === 'CARD') {
            const defaultMethod = cards.find((m) => m.isDefault) || cards[0] || null;
            setSelectedMethodId(defaultMethod?.id || null);
            return;
        }
        if (selectedPaymentType === 'E_WALLET') {
            const defaultMethod = wallets.find((m) => m.isDefault) || wallets[0] || null;
            setSelectedMethodId(defaultMethod?.id || null);
            return;
        }
        setSelectedMethodId(null);
    }, [selectedPaymentType, showPaymentModal, paymentMethods]);

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

    const saveCart = (updatedCart) => {
        localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(updatedCart));
        setCart(updatedCart);
    };

    const getSessionId = () => {
        let sid = sessionId;
        if (!sid) {
            sid = localStorage.getItem('trainerSessionId');
            if (!sid) {
                sid = `SESSION_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
                localStorage.setItem('trainerSessionId', sid);
            }
            setSessionId(sid);
        }
        return sid;
    };

    const addToCart = async (product) => {
        setAddingToCart((prev) => ({ ...prev, [product.id]: true }));
        const sid = getSessionId();

        try {
            const existingItem = cart.find((item) => item.id === product.id);
            const newQuantity = existingItem ? existingItem.quantity + 1 : 1;

            if (newQuantity > (product.stock || 0)) {
                await showAlert({ title: 'Stock Limit', message: `Cannot add more than available stock (${product.stock}).`, type: 'warning' });
                return false;
            }

            
            

            await axios.post('/api/pos/reserve', {
                sessionId: sid,
                productId: product.id,
                quantity: newQuantity
            });

            let updatedCart;
            if (existingItem) {
                updatedCart = cart.map((item) =>
                    item.id === product.id ? { ...item, quantity: newQuantity } : item
                );
            } else {
                updatedCart = [...cart, { ...product, quantity: 1 }];
            }
            saveCart(updatedCart);
            showAddToCartPopup(product.name);
            return true;
        } catch (error) {
            console.error("Failed to reserve stock", error);
            await showAlert({ 
                title: 'Reservation Failed', 
                message: error.response?.data?.error || 'Failed to add item to cart due to stock limits.', 
                type: 'warning' 
            });
            return false;
        } finally {
            setAddingToCart((prev) => ({ ...prev, [product.id]: false }));
        }
    };

    const handleBuyNow = (product) => {
        if (!product) return;
        const currentQty = Number(cart.find((item) => item.id === product.id)?.quantity || 0);
        const defaultQty = currentQty > 0 ? currentQty : 1;
        setBuyNowModal({ open: true, product, quantity: String(defaultQty) });
    };

    const closeBuyNowModal = () => {
        setBuyNowModal({ open: false, product: null, quantity: '1' });
    };

    const adjustBuyNowQuantity = (delta) => {
        setBuyNowModal((prev) => {
            const productStock = Number(prev.product?.stock || 0);
            const current = Number.parseInt(prev.quantity, 10) || 1;
            const next = Math.max(1, Math.min(productStock || 1, current + delta));
            return { ...prev, quantity: String(next) };
        });
    };

    const confirmBuyNowQuantity = async () => {
        const product = buyNowModal.product;
        if (!product) return;

        const maxStock = Number(product.stock || 0);
        const desiredQty = Number.parseInt(String(buyNowModal.quantity || '').trim(), 10);
        const quantity = Number.isInteger(desiredQty) ? desiredQty : 1;

        if (quantity < 1) {
            await showAlert({ title: 'Invalid Quantity', message: 'Quantity must be at least 1.', type: 'warning' });
            return;
        }

        if (quantity > maxStock) {
            await showAlert({ title: 'Stock Limit', message: `Only ${maxStock} item(s) available.`, type: 'warning' });
            return;
        }

        const sid = getSessionId();
        setAddingToCart((prev) => ({ ...prev, [product.id]: true }));
        try {
            await axios.post('/api/pos/reserve', {
                sessionId: sid,
                productId: product.id,
                quantity
            });

            const existingItem = cart.find((item) => item.id === product.id);
            const updatedCart = existingItem
                ? cart.map((item) => (item.id === product.id ? { ...item, quantity } : item))
                : [...cart, { ...product, quantity }];

            saveCart(updatedCart);
            closeBuyNowModal();
            handleCheckoutInit();
        } catch (error) {
            console.error('Failed to reserve stock for buy now', error);
            await showAlert({
                title: 'Reservation Failed',
                message: error.response?.data?.error || 'Unable to set selected quantity.',
                type: 'warning'
            });
        } finally {
            setAddingToCart((prev) => ({ ...prev, [product.id]: false }));
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

            saveCart(cart.map((item) => (item.id === productId ? { ...item, quantity: newQuantity } : item)));
        } catch (error) {
            console.error("Failed to update stock reservation", error);
            await showAlert({ title: 'Stock Update Failed', message: error.response?.data?.error || 'Failed to update quantity.', type: 'warning' });
        }
    };

    const removeFromCart = async (productId) => {
        const sid = getSessionId();
        try {
            
            

            await axios.delete(`/api/pos/reserve/${sid}/${productId}`);
            saveCart(cart.filter((item) => item.id !== productId));
        } catch (error) {
            console.error("Failed to release stock reservation", error);
            saveCart(cart.filter((item) => item.id !== productId));
        }
    };

    const getCartItemQuantity = (productId) => {
        const item = cart.find((i) => i.id === productId);
        return item ? item.quantity : 0;
    };

    const getCartTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);
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
        setSelectedPaymentType('CASH');
        setSelectedMethodId(null);
        setMarkAsSessionMaterial(false);
        setShowPaymentModal(true);
    };

    const handleConfirmCheckout = async () => {
        if (!markAsSessionMaterial && selectedPaymentType === 'CARD' && cardMethods.length === 0) {
            await showAlert({ title: 'No Cards Found', message: 'No saved cards found. Add card in Trainer Payment Methods.', type: 'warning' });
            return;
        }
        if (!markAsSessionMaterial && selectedPaymentType === 'CARD' && !selectedMethodId) {
            await showAlert({ title: 'Select a Card', message: 'Please select a saved card', type: 'warning' });
            return;
        }
        if (!markAsSessionMaterial && selectedPaymentType === 'E_WALLET' && walletMethods.length === 0) {
            await showAlert({ title: 'No E-Wallets Found', message: 'No saved e-wallet found. Add GCash or Maya in Trainer Payment Methods.', type: 'warning' });
            return;
        }
        if (!markAsSessionMaterial && selectedPaymentType === 'E_WALLET' && !selectedMethodId) {
            await showAlert({ title: 'Select an E-Wallet', message: 'Please select a saved e-wallet', type: 'warning' });
            return;
        }

        setIsCheckingOut(true);
        try {
            
            await axios.post('/api/members/checkout', {
                items: cart.map((i) => ({ productId: i.id, quantity: i.quantity, price: i.price, name: i.name })),
                total: getCartTotal(),
                paymentType: markAsSessionMaterial
                    ? 'COMMISSION_DEDUCTION'
                    : (selectedPaymentType === 'CASH'
                        ? 'CASH_PENDING'
                        : (selectedPaymentType === 'E_WALLET'
                            ? String(walletMethods.find((m) => Number(m.id) === Number(selectedMethodId))?.type || '').toUpperCase()
                            : 'CARD')),
                paymentMethodId: markAsSessionMaterial || selectedPaymentType === 'CASH' ? null : selectedMethodId,
                gcashReference: null,
                gcashDate: null,
                markAsSessionMaterial,
                sessionId: sessionId || getSessionId()
            });

            await axios.delete(`/api/pos/reserve/${sessionId || getSessionId()}`).catch(e => console.error("Failed to clear redis sessionId", e));

            setCart([]);
            saveCart([]);
            setShowPaymentModal(false);
            setMarkAsSessionMaterial(false);
            await showAlert({
                title: 'Order Placed',
                message: markAsSessionMaterial
                    ? 'Material purchase saved. Cost will be deducted from trainer commission payout.'
                    : (selectedPaymentType === 'CASH' ? 'Order placed. Please pay at counter.' : 'Order placed successfully.'),
                type: 'success'
            });
            navigate('/trainer/purchase-history');
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
            <TrainerPageHeader
                title="Products"
                subtitle="Gym inventory and available items"
                icon="storefront"
            />

            <div className="mt-4 mb-3 space-y-2.5 relative z-[100]">
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
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded bg-white/10 text-white/50 hover:text-white"
                                aria-label="Clear search"
                            >
                                <span className="material-icons-round text-sm leading-none">close</span>
                            </button>
                        )}
                    </div>
                    <div className="w-[140px] shrink-0">
                        <CustomSelect
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            options={[
                                { value: 'featured', label: 'Featured' },
                                { value: 'price-asc', label: 'Price: Low-High' },
                                { value: 'price-desc', label: 'Price: High-Low' },
                                { value: 'name-az', label: 'Name A-Z' },
                                { value: 'stock-desc', label: 'Most Stock' }
                            ]}
                            className="w-full"
                        />
                    </div>
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

            <div className={`grid ${isDetailedView ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5'}`}>
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
                    visibleProducts.map((p) => {
                        const isSoldOut = !p.stock || p.stock === 0;
                        const cartQuantity = getCartItemQuantity(p.id);
                        const isAdding = Boolean(addingToCart?.[p.id]);
                        const stockCount = Number(p.stock || 0);
                        const stockLabel = isSoldOut
                            ? 'Out of stock'
                            : p.stock <= 5
                                ? `Only ${stockCount} left`
                                : `${stockCount} available`;
                        const stockChipClass = isSoldOut
                            ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                            : p.stock <= 5
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200';
                        const stockDotClass = isSoldOut
                            ? 'bg-rose-400'
                            : p.stock <= 5
                                ? 'bg-amber-300'
                                : 'bg-emerald-300';

                        return (
                            <div
                                key={p.id}
                                className={`${isDetailedView ? 'rounded-2xl border-white/10' : 'rounded-xl border-white/5'} overflow-hidden border flex flex-col transition-all group ${isSoldOut ? 'bg-black/40 opacity-60' : 'bg-surface hover:border-primary/30'}`}
                            >
                                <div className={`${isDetailedView ? 'aspect-[4/3]' : 'aspect-[4/5]'} bg-white/5 overflow-hidden relative`}>
                                    {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.name} className={`w-full h-full object-cover ${!isSoldOut && 'group-hover:scale-105 transition-transform duration-300'}`} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-icons-round text-5xl text-white/10">shopping_bag</span>
                                        </div>
                                    )}

                                    {isSoldOut && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                            <div className="text-center">
                                                <span className="material-icons-round text-4xl text-white/80 block mb-1">block</span>
                                                <p className="text-white font-bold text-sm">Sold Out</p>
                                            </div>
                                        </div>
                                    )}

                                    {p.category && (
                                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md">
                                            <span className="text-white/90 text-xs font-medium">{p.category}</span>
                                        </div>
                                    )}

                                    {cartQuantity > 0 && (
                                        <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow-lg">
                                            {cartQuantity}
                                        </div>
                                    )}
                                </div>

                                <div className={`${isDetailedView ? 'p-3' : 'p-2'} flex flex-col flex-1`}>
                                    <h3 className={`${isDetailedView ? 'text-base min-h-[2.75rem]' : 'text-[12px] min-h-[2rem]'} font-bold text-white line-clamp-2`}>{p.name}</h3>
                                    <div className={`text-primary font-bold ${isDetailedView ? 'text-lg mt-1 mb-2' : 'text-sm mt-0.5 mb-1.5'}`}>{formatPrice(p.price)}</div>
                                    <p className={`text-text-muted ${isDetailedView ? 'text-sm line-clamp-3 mb-2' : 'text-[10px] line-clamp-2 mb-1.5'}`}>{p.description || 'No description available'}</p>

                                    <div className="mt-auto">
                                        <div className={`${isDetailedView ? 'mb-2.5' : 'mb-2'}`}>
                                            <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${stockChipClass}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${stockDotClass}`}></span>
                                                <span className={`${isDetailedView ? 'text-[11px]' : 'text-[10px]'} font-semibold`}>
                                                    {stockLabel}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`pt-2 flex items-center gap-2 ${isSoldOut ? 'invisible pointer-events-none' : ''}`}>
                                            <button
                                                onClick={() => handleBuyNow(p)}
                                                className={`${isDetailedView ? 'py-2.5 text-sm' : 'py-2 text-[11px]'} flex-1 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-lg px-3 font-semibold transition-all`}
                                            >
                                                Buy
                                            </button>
                                            <button
                                                onClick={() => addToCart(p)}
                                                disabled={isAdding}
                                                className={`${isDetailedView ? 'w-10 h-10' : 'w-9 h-9'} bg-white/10 hover:bg-white/15 rounded-lg border border-white/10 text-white flex items-center justify-center transition-all disabled:opacity-50`}
                                                aria-label={`Add ${p.name} to cart`}
                                                title="Add to cart"
                                            >
                                                {isAdding ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <span className="material-icons-round text-lg">add_shopping_cart</span>
                                                )}
                                            </button>
                                        </div>
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/80 leading-none mb-1">Added to Basket</p>
                            <p className="text-[13px] font-bold text-white max-w-[180px] truncate">{cartPopup.itemName}</p>
                        </div>
                    </div>
                </div>
            )}

            {buyNowModal.open && (
                <div className="fixed inset-0 z-[135] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeBuyNowModal} />
                    <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#14161a] p-5 sm:p-6 shadow-2xl space-y-5">
                        <div className="space-y-1">
                            <p className="text-[10px] text-primary font-bold uppercase tracking-[0.16em]">Buy Now</p>
                            <h3 className="text-xl font-extrabold text-white leading-tight">{buyNowModal.product?.name}</h3>
                            <p className="text-xs text-text-muted">Choose quantity before proceeding to order details.</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted uppercase tracking-wider">Available Stock</span>
                                <span className="text-white font-bold">{Number(buyNowModal.product?.stock || 0)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => adjustBuyNowQuantity(-1)}
                                    className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                >
                                    <span className="material-icons-round text-base">remove</span>
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max={Number(buyNowModal.product?.stock || 1)}
                                    value={buyNowModal.quantity}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^\d]/g, '');
                                        setBuyNowModal((prev) => ({ ...prev, quantity: raw }));
                                    }}
                                    onBlur={() => {
                                        setBuyNowModal((prev) => {
                                            const stock = Number(prev.product?.stock || 1);
                                            const parsed = Number.parseInt(prev.quantity, 10);
                                            const normalized = Number.isInteger(parsed) ? Math.max(1, Math.min(stock, parsed)) : 1;
                                            return { ...prev, quantity: String(normalized) };
                                        });
                                    }}
                                    className="flex-1 h-10 rounded-xl border border-white/10 bg-black/30 text-center text-white font-bold focus:outline-none focus:border-primary"
                                />
                                <button
                                    type="button"
                                    onClick={() => adjustBuyNowQuantity(1)}
                                    className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                                >
                                    <span className="material-icons-round text-base">add</span>
                                </button>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-text-muted uppercase tracking-wider">Estimated Total</span>
                                <span className="text-primary font-black">
                                    {formatPrice((Number(buyNowModal.product?.price || 0) || 0) * (Number.parseInt(buyNowModal.quantity, 10) || 1))}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={closeBuyNowModal}
                                className="flex-1 h-11 rounded-xl border border-white/10 bg-white/5 text-white/70 font-bold uppercase tracking-wider hover:text-white hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmBuyNowQuantity}
                                disabled={Boolean(addingToCart[buyNowModal.product?.id])}
                                className="flex-1 h-11 rounded-xl bg-primary text-background font-black uppercase tracking-wider hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {addingToCart[buyNowModal.product?.id] ? (
                                    <div className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-icons-round text-base">shopping_bag</span>
                                        Continue
                                    </>
                                )}
                            </button>
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
                <div className="fixed inset-0 z-[100] flex items-end sm:items-stretch sm:justify-end">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowCartModal(false)} />
                    <div className="relative w-full h-[72vh] sm:h-full sm:max-w-md bg-[#14161a] border-t sm:border-t-0 sm:border-l border-white/5 rounded-t-3xl sm:rounded-none sm:rounded-l-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-right duration-500">
                        <div className="sm:hidden pt-2 pb-1 flex justify-center">
                            <div className="h-1 w-12 rounded-full bg-white/20"></div>
                        </div>
                        {/* Drawer Header */}
                        <div className="p-3.5 sm:p-4 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] text-primary font-bold uppercase tracking-[0.16em] mb-1">Your Basket</p>
                                <h2 className="text-2xl sm:text-[26px] leading-tight font-extrabold tracking-tight text-white">Ready to checkout</h2>
                            </div>
                            <button
                                onClick={() => setShowCartModal(false)}
                                className="w-8 h-8 rounded-lg bg-transparent border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all active:scale-90"
                            >
                                <span className="material-icons-round text-[18px]">close</span>
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-1.5 space-y-2.5 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center">
                                        <span className="material-icons-round text-4xl">remove_shopping_cart</span>
                                    </div>
                                    <p className="text-xs font-bold text-white px-8">Your basket is empty. Add a few items to continue.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {cart.map(item => (
                                        <div key={item.id} className="group relative bg-white/[0.03] border border-white/10 rounded-xl p-2.5 flex gap-2.5 transition-all hover:bg-white/[0.06]">
                                            {/* Media */}
                                            <div className="w-12 h-12 bg-black/40 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                                                {item.imageUrl ? (
                                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white/10">
                                                        <span className="material-icons-round text-2xl">inventory_2</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0 py-0.5">
                                                <h3 className="font-semibold text-white text-sm mb-0.5 line-clamp-1">{item.name}</h3>
                                                <p className="text-primary font-semibold text-xs mb-1.5">{formatPrice(item.price)}</p>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center bg-black/50 border border-white/10 rounded-lg p-1 w-[104px]">
                                                        <button
                                                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-75"
                                                        >
                                                            <span className="material-icons-round text-xs">remove</span>
                                                        </button>
                                                        <span className="text-sm font-semibold text-white w-full text-center">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-75"
                                                        >
                                                            <span className="material-icons-round text-xs">add</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row Total & Remove */}
                                            <div className="flex flex-col items-end justify-between py-0.5">
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="w-6 h-6 rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-all opacity-70 hover:opacity-100"
                                                >
                                                    <span className="material-icons-round text-sm text-rose-500">close</span>
                                                </button>
                                                <p className="text-lg leading-none font-bold text-white">{formatPrice(item.price * item.quantity)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {cart.length > 0 && (
                            <div className="p-3.5 sm:p-4 border-t border-white/10 bg-black/20 space-y-3">
                                <div className="space-y-2 text-[13px]">
                                    <div className="flex items-center justify-between text-text-muted">
                                        <span>Items selected</span>
                                        <span>{getTotalItems()} items</span>
                                    </div>
                                    <div className="flex items-center justify-between text-text-muted">
                                        <span>Subtotal</span>
                                        <span>{formatPrice(getCartTotal())}</span>
                                    </div>
                                </div>
                                <div className="border-t border-white/10" />
                                <div className="flex items-end justify-between">
                                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-[0.16em]">Order Total</p>
                                    <p className="text-3xl sm:text-[34px] leading-none font-extrabold text-white">{formatPrice(getCartTotal())}</p>
                                </div>

                                <button
                                    onClick={handleCheckoutInit}
                                    className="w-full h-12 rounded-xl bg-primary text-background font-semibold text-xs tracking-[0.08em] shadow-2xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round">payments</span>
                                    <span>Continue to payment</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[130] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#111111] border border-white/5 rounded-3xl w-full max-w-md p-6 space-y-6 my-auto shadow-2xl">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-white">Order Details</h2>
                            <p className="text-text-muted text-xs">Review your items and choose payment method</p>
                        </div>

                        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-4">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-white font-bold text-sm">Items</h3>
                                <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">{getTotalItems()} total</span>
                            </div>
                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <div className="w-14 h-14 bg-black/40 rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
                                            {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="material-icons-round text-xl text-white/10">shopping_bag</span></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-white text-sm font-bold truncate">{item.name}</h4>
                                                <span className="text-white text-sm font-bold ml-2">{formatPrice(item.price * item.quantity)}</span>
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

                        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-white font-bold text-sm">Payment Method</h3>
                                <button
                                    onClick={() => { setShowPaymentModal(false); navigate('/trainer/payment-methods'); }}
                                    className="text-primary text-[10px] font-bold uppercase hover:underline disabled:opacity-40"
                                    disabled={markAsSessionMaterial}
                                >
                                    Manage methods
                                </button>
                            </div>
                            {markAsSessionMaterial && (
                                <p className="text-[10px] text-text-muted">
                                    Payment selection is disabled. This order will be deducted from trainer commissions.
                                </p>
                            )}

                            <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                                {['CASH', 'E_WALLET', 'CARD'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedPaymentType(type)}
                                        disabled={markAsSessionMaterial}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedPaymentType === type ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
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
                                        <p className="text-text-muted text-[10px] leading-relaxed">Your order will be saved as PENDING. Please proceed to the cash register to complete payment.</p>
                                    </div>
                                )}

                                {selectedPaymentType === 'CARD' && (
                                    cardMethods.length === 0 ? (
                                        <div className="text-center py-6 border border-white/5 rounded-xl bg-black/20">
                                            <p className="text-white text-xs mb-1">No linked cards found</p>
                                            <p className="text-text-muted text-[10px]">Please add one in Payment Methods.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {cardMethods.map((method) => (
                                                <label key={method.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMethodId === method.id ? 'bg-primary/5 border-primary/40' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                                                    <input type="radio" name="paymentMethod" className="hidden" checked={selectedMethodId === method.id} onChange={() => setSelectedMethodId(method.id)} />
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedMethodId === method.id ? 'border-primary ring-2 ring-primary/20' : 'border-white/20'}`}>
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
                                    walletMethods.length === 0 ? (
                                        <div className="text-center py-6 border border-white/5 rounded-xl bg-black/20">
                                            <p className="text-white text-xs mb-1">No linked e-wallets found</p>
                                            <p className="text-text-muted text-[10px]">Please add GCash or Maya in Payment Methods.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {walletMethods.map((method) => (
                                                <label key={method.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMethodId === method.id ? 'bg-primary/5 border-primary/40' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                                                    <input type="radio" name="paymentMethod" className="hidden" checked={selectedMethodId === method.id} onChange={() => setSelectedMethodId(method.id)} />
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedMethodId === method.id ? 'border-primary ring-2 ring-primary/20' : 'border-white/20'}`}>
                                                        {selectedMethodId === method.id && <div className="w-2 h-2 bg-primary rounded-full" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white text-xs uppercase tracking-tight">{String(method.type || '').toUpperCase() === 'MAYA' ? 'Maya' : 'GCash'}</span>
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

                        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-bold text-sm">Trainer Option</h3>
                                {markAsSessionMaterial && (
                                    <span className="text-[9px] bg-primary/20 text-primary px-2 py-1 rounded-md font-black uppercase tracking-wider">
                                        Commission Mode
                                    </span>
                                )}
                            </div>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={markAsSessionMaterial}
                                    onChange={(e) => setMarkAsSessionMaterial(e.target.checked)}
                                    className="mt-0.5 accent-primary"
                                />
                                <div>
                                    <p className="text-white text-sm font-bold">Tag as Session Material Purchase</p>
                                    <p className="text-text-muted text-[11px] leading-relaxed mt-0.5">
                                        Tagged items can be added quickly in Admin Training Sessions when completing a trainer session.
                                    </p>
                                </div>
                            </label>
                        </div>

                        <div className="space-y-4 pt-2">
                            <button
                                onClick={handleConfirmCheckout}
                                disabled={isCheckingOut || (!markAsSessionMaterial && ((selectedPaymentType === 'CARD' || selectedPaymentType === 'E_WALLET') && !selectedMethodId))}
                                className="w-full h-14 rounded-[1.25rem] bg-primary text-background font-black text-[12px] uppercase tracking-[0.16em] shadow-2xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all flex items-center justify-center gap-3"
                            >
                                {isCheckingOut ? (
                                    <div className="w-5 h-5 border-4 border-background/30 border-t-background rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-icons-round">verified</span>
                                        <span>{markAsSessionMaterial ? 'Save For Commission Deduction' : 'Confirm Payment'}</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="w-full h-12 rounded-[1.25rem] bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.16em] text-white/60 hover:text-white hover:bg-white/10 transition-all"
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
