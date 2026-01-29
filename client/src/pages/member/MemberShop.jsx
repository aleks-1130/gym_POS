import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';

export default function MemberShop() {
    const { formatPrice } = useCurrency();
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({});
    const [loading, setLoading] = useState(true);
    const [showCart, setShowCart] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

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

    const addToCart = (id) => {
        setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    };

    const removeFromCart = (id) => {
        setCart(prev => {
            const newCart = { ...prev };
            if (newCart[id] > 1) newCart[id]--;
            else delete newCart[id];
            return newCart;
        });
    };

    const cartTotal = products.reduce((sum, p) => sum + (p.price * (cart[p.id] || 0)), 0);
    const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

    const handleCheckout = async () => {
        if (cartTotal === 0) return;
        if (!window.confirm(`Confirm purchase for ${formatPrice(cartTotal)}?`)) return;

        const items = Object.entries(cart).map(([pid, qty]) => {
            const product = products.find(p => p.id === Number(pid));
            return {
                productId: Number(pid),
                quantity: qty,
                price: product.price
            };
        });

        try {
            await axios.post('http://localhost:5000/api/members/checkout', { items, total: cartTotal });
            alert("Order Successful!");
            setCart({});
            setShowCart(false);
            fetchProducts();
        } catch (error) {
            alert("Checkout failed");
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
            {/* Header with Cart */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-4 mb-4">
                <div className="flex justify-between items-center gap-3 mb-3">
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white">Shop</h1>
                        <p className="text-text-muted text-xs mt-0.5">Gear, supplements & more</p>
                    </div>
                    
                    {/* Cart Button */}
                    <button
                        onClick={() => setShowCart(!showCart)}
                        className="relative p-2.5 rounded-xl bg-surface border border-white/5 hover:bg-white/5 active:scale-95 transition-all flex-shrink-0"
                    >
                        <span className="material-icons-round text-white text-xl">shopping_cart</span>
                        {cartCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 bg-primary text-background text-xs font-bold rounded-full flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Cart Summary Bar */}
                {cartCount > 0 && (
                    <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-xl p-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                <span className="material-icons-round text-primary text-lg">shopping_bag</span>
                            </div>
                            <div>
                                <p className="text-xs text-white/70">{cartCount} {cartCount === 1 ? 'item' : 'items'}</p>
                                <p className="text-base font-bold text-white">{formatPrice(cartTotal)}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleCheckout}
                            className="px-4 py-2 bg-primary text-background rounded-lg font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg"
                        >
                            Checkout
                        </button>
                    </div>
                )}
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
                    products.map(p => (
                        <div key={p.id} className="bg-surface rounded-xl border border-white/5 overflow-hidden flex flex-col hover:border-primary/30 transition-all group">
                            {/* Product Image */}
                            <div className="aspect-square bg-white/5 overflow-hidden relative">
                                {p.imageUrl ? (
                                    <img 
                                        src={p.imageUrl} 
                                        alt={p.name} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="material-icons-round text-5xl text-white/10">shopping_bag</span>
                                    </div>
                                )}
                                
                                {/* Quantity Badge */}
                                {cart[p.id] > 0 && (
                                    <div className="absolute top-2 right-2 min-w-[28px] h-7 px-2 bg-primary text-background rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                                        {cart[p.id]}
                                    </div>
                                )}

                                {/* Category Tag */}
                                {p.category && (
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md">
                                        <span className="text-white/90 text-xs font-medium">{p.category}</span>
                                    </div>
                                )}
                            </div>

                            {/* Product Info */}
                            <div className="p-3 flex flex-col flex-1">
                                <h3 className="font-bold text-white text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{p.name}</h3>
                                
                                <div className="mt-auto space-y-2">
                                    <div className="text-primary font-bold text-base">{formatPrice(p.price)}</div>
                                    
                                    {/* Cart Controls */}
                                    {cart[p.id] > 0 ? (
                                        <div className="flex gap-2 items-center">
                                            <button
                                                onClick={() => removeFromCart(p.id)}
                                                className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
                                            >
                                                <span className="material-icons-round text-lg">remove</span>
                                            </button>
                                            <div className="flex-1 text-center">
                                                <span className="text-white font-bold text-sm">{cart[p.id]}</span>
                                            </div>
                                            <button
                                                onClick={() => addToCart(p.id)}
                                                className="w-9 h-9 rounded-lg bg-primary text-background flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
                                            >
                                                <span className="material-icons-round text-lg">add</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => addToCart(p.id)}
                                            className="w-full py-2.5 rounded-lg font-bold text-sm transition-all active:scale-95 bg-primary text-background hover:brightness-110 flex items-center justify-center gap-1"
                                        >
                                            <span className="material-icons-round text-base">add_shopping_cart</span>
                                            Add to Cart
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Mobile Cart Detail Modal */}
            {showCart && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowCart(false)}>
                    <div 
                        className="w-full bg-surface rounded-t-3xl border-t border-white/10 max-h-[85vh] flex flex-col" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white">Shopping Cart</h2>
                            <button 
                                onClick={() => setShowCart(false)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                                <span className="material-icons-round text-white text-xl">close</span>
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            {cartCount === 0 ? (
                                <div className="text-center py-8">
                                    <span className="material-icons-round text-4xl text-text-muted block mb-2">shopping_cart</span>
                                    <p className="text-text-muted text-sm">Your cart is empty</p>
                                </div>
                            ) : (
                                Object.entries(cart).map(([pid, qty]) => {
                                    const product = products.find(p => p.id === Number(pid));
                                    if (!product) return null;
                                    return (
                                        <div key={pid} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                            <div className="w-16 h-16 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                                                {product.imageUrl ? (
                                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <span className="material-icons-round text-white/20">shopping_bag</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-white text-sm line-clamp-1">{product.name}</h4>
                                                <p className="text-text-muted text-xs mb-1">{product.category}</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-primary font-bold text-sm">{formatPrice(product.price)}</span>
                                                    <span className="text-xs text-text-muted">x{qty}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white font-bold text-sm">{formatPrice(product.price * qty)}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Cart Footer */}
                        {cartCount > 0 && (
                            <div className="border-t border-white/10 p-5 space-y-3 bg-background">
                                <div className="flex justify-between items-center">
                                    <span className="text-text-muted text-sm">Subtotal ({cartCount} items)</span>
                                    <span className="text-white font-bold text-lg">{formatPrice(cartTotal)}</span>
                                </div>
                                <button
                                    onClick={handleCheckout}
                                    className="w-full py-3.5 bg-primary text-background rounded-xl font-bold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round text-xl">check_circle</span>
                                    Checkout - {formatPrice(cartTotal)}
                                </button>
                                <button
                                    onClick={() => setShowCart(false)}
                                    className="w-full py-3 bg-white/5 text-white rounded-xl font-medium text-sm hover:bg-white/10 transition-colors"
                                >
                                    Continue Shopping
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}