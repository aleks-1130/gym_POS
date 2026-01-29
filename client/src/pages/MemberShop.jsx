import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function MemberShop() {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({}); // { productId: quantity }
    const [loading, setLoading] = useState(true);

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

    const handleCheckout = async () => {
        if (cartTotal === 0) return;
        if (!window.confirm(`Confirm purchase for $${cartTotal.toFixed(2)}?`)) return;

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
            fetchProducts();
        } catch (error) {
            alert("Checkout failed");
        }
    };

    if (loading) return <div className="text-white p-8">Loading Shop...</div>;

    return (
        <div className="space-y-6 pb-24">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Member Shop</h1>
                    <p className="text-text-muted mt-1">Gear, supplements, and more</p>
                </div>
                {cartTotal > 0 && (
                    <div className="text-right">
                        <div className="text-primary font-bold text-xl">${cartTotal.toFixed(2)}</div>
                        <button onClick={handleCheckout} className="bg-primary text-background px-4 py-2 rounded-lg font-bold text-sm mt-1 hover:brightness-110">
                            Checkout
                        </button>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(p => (
                    <div key={p.id} className="bg-surface rounded-2xl p-4 border border-white/5 flex flex-col">
                        <div className="aspect-square bg-white/5 rounded-xl mb-4 overflow-hidden relative">
                            {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/20">
                                    <span className="material-symbols-outlined text-4xl">shopping_bag</span>
                                </div>
                            )}
                            {cart[p.id] > 0 && (
                                <div className="absolute top-2 right-2 bg-primary text-background w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg">
                                    {cart[p.id]}
                                </div>
                            )}
                        </div>
                        <h3 className="font-bold text-white mb-1 line-clamp-1">{p.name}</h3>
                        <p className="text-text-muted text-xs mb-3">{p.category}</p>
                        <div className="mt-auto flex items-center justify-between">
                            <span className="text-primary font-bold">${p.price}</span>
                            <div className="flex gap-2">
                                {cart[p.id] > 0 && (
                                    <button onClick={() => removeFromCart(p.id)} className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20">-</button>
                                )}
                                <button onClick={() => addToCart(p.id)} className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30">+</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
