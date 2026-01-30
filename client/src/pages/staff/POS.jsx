import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useReactToPrint } from 'react-to-print';
import Receipt from '../../components/Receipt';

export default function POS() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [members, setMembers] = useState([]); // For POS member selection
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(false);
    const [discount, setDiscount] = useState(0); // in dollars
    const [viewMode, setViewMode] = useState('POS');
    const [history, setHistory] = useState([]);

    // Receipt Printing
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [lastTransaction, setLastTransaction] = useState(null);
    const receiptRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => receiptRef.current,
    });

    useEffect(() => {
        fetchProducts();
        fetchPlans();
        fetchMembers();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Failed to fetch products");
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/plans');
            setPlans(res.data);
        } catch (error) {
            console.error("Failed to fetch plans");
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/members');
            setMembers(res.data);
        } catch (error) {
            console.error("Failed to fetch members");
        }
    }

    const fetchHistory = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/payments');
            setHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch history");
        }
    }

    // Calculate Total
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const cartTotal = Math.max(0, subtotal - discount);

    const addToCart = (item, type = 'PRODUCT') => {
        setCart(prev => {
            // Plans are unique items usually, but if we want to allow multiple?
            // For simplicity, if it's a plan, we just add it. Or treat same as products.
            const existing = prev.find(p => p.id === item.id && p.type === type);
            if (existing) {
                return prev.map(p => p.id === item.id && p.type === type ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { ...item, type: type === 'PLAN' ? 'PLAN' : undefined, quantity: 1 }];
        });
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        // Validation for Membership
        const hasPlan = cart.some(item => item.type === 'PLAN');
        if (hasPlan && !selectedMemberId) {
            alert("A Member must be selected when purchasing a Membership Plan.");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/payments', {
                amount: cartTotal,
                type: 'POS_SALE',
                method: 'CARD', // Default for now
                items: cart,
                discount: discount,
                memberId: selectedMemberId || null
            });

            // Prepare Reciept Data
            const transactionData = res.data;
            const memberData = members.find(m => m.id === Number(selectedMemberId));

            setLastTransaction({
                transaction: transactionData,
                items: cart,
                member: memberData,
                discount: discount,
                cashierName: user?.name
            });

            // Show Preview
            setShowReceiptPreview(true);

            // Clear Cart (will happen after modal close or separate)
            setCart([]);
            setDiscount(0);
            setSelectedMemberId('');
            fetchProducts(); // Refresh stock levels
        } catch (e) {
            alert("Transaction Failed: " + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = selectedCategory === 'All'
        ? products
        : products.filter(p => p.category === selectedCategory);

    // Combine Products and Plans for display if category is Memberships
    const displayItems = selectedCategory === 'MEMBERSHIP' ? plans : filteredProducts;

    if (viewMode === 'HISTORY') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-white">Transaction History</h1>
                    <button onClick={() => setViewMode('POS')} className="text-primary hover:text-orange-400 font-bold flex items-center gap-1">
                        <span className="material-icons-round">arrow_back</span> Back to POS
                    </button>
                </div>

                <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Method</th>
                                <th className="px-6 py-4">Member</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {history.length === 0 && (
                                <tr><td colSpan="6" className="p-6 text-center text-text-muted">No transactions found.</td></tr>
                            )}
                            {history.map(pay => (
                                <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-white font-medium">{new Date(pay.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(pay.date).toLocaleTimeString()}</span></td>
                                    <td className="px-6 py-4"><span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold">{pay.type}</span></td>
                                    <td className="px-6 py-4 text-white font-bold">{formatPrice(pay.amount)}</td>
                                    <td className="px-6 py-4 text-text-secondary">{pay.method}</td>
                                    <td className="px-6 py-4 text-white">{pay.member ? `${pay.member.firstName} ${pay.member.lastName}` : 'Walk-in'}</td>
                                    <td className="px-6 py-4">
                                        {/* Simple reprint not fully wired as we don't store items perfectly yet, but placeholder */}
                                        <button className="text-text-muted hover:text-white" title="Reprint functionality requires item storage update">
                                            <span className="material-icons-round text-sm">print</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] gap-6 overflow-hidden relative">

            {/* Receipt Preview Modal */}
            {showReceiptPreview && lastTransaction && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white text-black rounded-lg shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-100 rounded-t-lg">
                            <h3 className="font-bold text-lg">Receipt Preview</h3>
                            <button onClick={() => setShowReceiptPreview(false)} className="text-gray-500 hover:text-gray-700">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 flex-1 bg-gray-500/10">
                            <Receipt
                                ref={receiptRef}
                                transaction={lastTransaction.transaction}
                                items={lastTransaction.items}
                                member={lastTransaction.member}
                                discount={lastTransaction.discount}
                                cashierName={lastTransaction.cashierName}
                            />
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex gap-4">
                            <button
                                onClick={() => setShowReceiptPreview(false)}
                                className="flex-1 py-3 rounded-lg font-bold border border-gray-300 hover:bg-gray-100 transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <span className="material-icons-round">print</span> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Left: Product Grid */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Touch-First POS</h1>
                        <p className="text-text-muted text-sm">Select items to add to cart</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => { fetchHistory(); setViewMode('HISTORY'); }} className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors">
                            <span className="material-icons-round">history</span> History
                        </button>
                        {/* Category Filter */}
                        <div className="flex gap-2 bg-surface p-1 rounded-xl border border-white/10">
                            {['All', 'SUPPLEMENT', 'DRINK', 'MERCH', 'MEMBERSHIP'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedCategory === cat
                                        ? 'bg-primary/10 text-primary shadow-sm'
                                        : 'text-text-muted hover:text-text-secondary'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-20 pr-2 scrollbar-hide">
                    {displayItems.length === 0 && (
                        <div className="col-span-full text-center text-text-muted py-10">No items found in this category.</div>
                    )}
                    {displayItems.map(item => (
                        <div
                            key={item.id}
                            onClick={() => addToCart(item, selectedCategory === 'MEMBERSHIP' ? 'PLAN' : 'PRODUCT')}
                            className={`group bg-surface hover:bg-primary/5 rounded-3xl p-3 cursor-pointer transition-all duration-300 border border-white/5 hover:border-primary/20 shadow-sm hover:shadow-primary/10 active:scale-95 ${selectedCategory === 'MEMBERSHIP' ? 'ring-1 ring-yellow-500/30' : ''}`}
                        >
                            <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-3 relative bg-white/5">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-muted group-hover:text-primary/50 transition-colors">
                                        <span className="material-icons-round text-4xl">{selectedCategory === 'MEMBERSHIP' ? 'card_membership' : 'inventory_2'}</span>
                                    </div>
                                )}
                                {item.stock !== undefined && (
                                    <div className="absolute top-2 right-2 bg-surface/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg border border-white/10 shadow-sm">
                                        {item.stock}
                                    </div>
                                )}
                                {selectedCategory === 'MEMBERSHIP' && (
                                    <div className="absolute top-2 right-2 bg-yellow-500/90 backdrop-blur-sm text-black text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                                        {item.duration} Days
                                    </div>
                                )}
                            </div>
                            <div className="px-1 mt-2">
                                <h3 className="text-white font-bold truncate text-sm">{item.name}</h3>
                                <p className="text-primary font-bold mt-1">{formatPrice(item.price)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Cart Panel */}
            <div className="w-96 flex flex-col bg-surface rounded-3xl border border-white/10 shadow-xl shadow-black/50 overflow-hidden">
                {/* Cart Header */}
                <div className="p-6 border-b border-white/5 bg-white/5">
                    <div className="flex justify-between items-center mb-1">
                        <h2 className="text-white font-bold text-lg">Current Cart</h2>
                        <span className="material-icons-round text-text-muted">shopping_bag</span>
                    </div>

                    {/* Member Selector */}
                    <div className="mt-4">
                        <select
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                        >
                            <option value="">Guest / Walk-in</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-text-muted mt-2 ml-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedMemberId ? 'bg-emerald-500' : 'bg-gray-600'}`}></span>
                        <span>{selectedMemberId ? 'Member Linked' : 'No Member Linked'}</span>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-text-muted">
                            <span className="material-icons-round text-6xl mb-4 bg-white/5 p-4 rounded-full">shopping_cart_checkout</span>
                            <p className="font-medium text-text-muted">Cart is empty</p>
                        </div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-2xl group transition-colors border border-transparent hover:border-white/5">
                                <div>
                                    <p className="text-white font-bold text-sm">
                                        {item.name}
                                        {item.type === 'PLAN' && <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/30">PLAN</span>}
                                    </p>
                                    <p className="text-text-muted text-xs mt-0.5">{formatPrice(item.price)} x {item.quantity}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-white font-bold text-sm">{formatPrice(item.price * item.quantity)}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                        className="w-6 h-6 flex items-center justify-center bg-white/10 text-text-muted hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <span className="material-icons-round text-[14px]">close</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Checkout Footer */}
                <div className="p-6 border-t border-white/5 bg-surfaceHighlight/50 backdrop-blur-sm">
                    <div className="flex justify-between items-end mb-2 text-text-secondary text-sm font-medium">
                        <span>Subtotal</span>
                        <span>{formatPrice(subtotal)}</span>
                    </div>

                    {/* Discount Input */}
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-text-secondary text-sm font-medium">Discount</span>
                        <input
                            type="number"
                            min="0"
                            className="w-24 bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1 text-right text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={discount}
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        />
                    </div>

                    <div className="flex justify-between items-end mb-6">
                        <span className="text-white font-bold text-lg">Total</span>
                        <span className="text-3xl font-bold text-white">{formatPrice(cartTotal)}</span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || loading}
                        className="w-full bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex flex-col items-center justify-center"
                    >
                        <span className="text-xs uppercase tracking-wider opacity-90 font-bold mb-1">Charge {selectedMemberId ? 'Member' : 'Guest'}</span>
                        <span className="text-xl">{formatPrice(cartTotal)}</span>
                    </button>
                </div>
            </div>

        </div>
    );
}
