import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function PaymentMethods() {
    const { user } = useAuth();
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGcashForm, setShowGcashForm] = useState(false);
    const [showCardForm, setShowCardForm] = useState(false);

    const [gcashForm, setGcashForm] = useState({ label: '', name: '', phone: '' });
    const [cardForm, setCardForm] = useState({ label: '', name: '', brand: '', last4: '', expMonth: '', expYear: '' });

    useEffect(() => {
        const fetchMethods = async () => {
            if (!user?.id) return;
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/members/${user.id}/payment-methods`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                setMethods(res.data || []);
            } catch (error) {
                console.error('Failed to load payment methods', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMethods();
    }, [user?.id]);

    const setAsDefault = (id) => {
        if (!user?.id) return;
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        axios.patch(`http://localhost:5000/api/members/${user.id}/payment-methods/${id}`, { isDefault: true }, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }).then((res) => {
            const updated = res.data;
            setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === updated.id })));
        }).catch((error) => {
            console.error('Failed to set default method', error);
        });
    };

    const removeMethod = (id) => {
        if (!user?.id) return;
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        axios.delete(`http://localhost:5000/api/members/${user.id}/payment-methods/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }).then(() => {
            setMethods((prev) => prev.filter((m) => m.id !== id));
        }).catch((error) => {
            console.error('Failed to remove method', error);
        });
    };

    const handleAddGcash = (e) => {
        e.preventDefault();
        if (!gcashForm.phone.trim() || !gcashForm.name.trim()) return;
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        axios.post(`http://localhost:5000/api/members/${user.id}/payment-methods`, {
            type: 'GCASH',
            label: gcashForm.label.trim() || 'GCash Wallet',
            name: gcashForm.name.trim(),
            phone: gcashForm.phone.trim(),
            isDefault: methods.length === 0
        }, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }).then((res) => {
            setMethods((prev) => [res.data, ...prev]);
            setGcashForm({ label: '', name: '', phone: '' });
        }).catch((error) => {
            console.error('Failed to add GCash method', error);
        });
    };

    const handleAddCard = (e) => {
        e.preventDefault();
        if (!cardForm.name.trim() || !cardForm.last4.trim() || !cardForm.expMonth.trim() || !cardForm.expYear.trim()) return;
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        axios.post(`http://localhost:5000/api/members/${user.id}/payment-methods`, {
            type: 'CARD',
            label: cardForm.label.trim() || 'Card',
            name: cardForm.name.trim(),
            brand: cardForm.brand.trim(),
            last4: cardForm.last4.trim(),
            expMonth: cardForm.expMonth.trim(),
            expYear: cardForm.expYear.trim(),
            isDefault: methods.length === 0
        }, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }).then((res) => {
            setMethods((prev) => [res.data, ...prev]);
            setCardForm({ label: '', name: '', brand: '', last4: '', expMonth: '', expYear: '' });
        }).catch((error) => {
            console.error('Failed to add card method', error);
        });
    };

    return (
        <div className="pb-24 px-4 sm:px-6 max-w-2xl mx-auto space-y-6">
            <header className="pt-4">
                <h1 className="text-xl font-bold text-white">Payment Methods</h1>
                <p className="text-text-muted text-xs mt-0.5">Add and manage your GCash and card options</p>
            </header>

            <section className="bg-surface rounded-2xl p-5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-sm font-bold text-white">GCash Wallet</h2>
                        <p className="text-xs text-text-muted">Use for training and shop payments</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-primary font-bold">GCash</span>
                </div>
                {!showGcashForm ? (
                    <button
                        type="button"
                        onClick={() => setShowGcashForm(true)}
                        className="w-full py-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold border border-primary/30 hover:bg-primary/20 transition-colors"
                    >
                        Add GCash Wallet
                    </button>
                ) : (
                <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={handleAddGcash}>
                    <label className="space-y-1 text-xs text-text-muted">
                        Account Label (optional)
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="Personal wallet"
                            value={gcashForm.label}
                            onChange={(e) => setGcashForm((prev) => ({ ...prev, label: e.target.value }))}
                        />
                        <span className="block text-[11px] text-text-muted/80">Shown on receipts.</span>
                    </label>
                    <label className="space-y-1 text-xs text-text-muted">
                        Registered Name
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="Juan Dela Cruz"
                            value={gcashForm.name}
                            onChange={(e) => setGcashForm((prev) => ({ ...prev, name: e.target.value }))}
                            required
                        />
                        <span className="block text-[11px] text-text-muted/80">Match the name on your wallet.</span>
                    </label>
                    <label className="space-y-1 text-xs text-text-muted sm:col-span-2">
                        Mobile Number
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="09xx xxx xxxx"
                            value={gcashForm.phone}
                            onChange={(e) => setGcashForm((prev) => ({ ...prev, phone: e.target.value }))}
                            required
                        />
                        <span className="block text-[11px] text-text-muted/80">We only store the number for verification.</span>
                    </label>
                    <button
                        type="submit"
                        className="sm:col-span-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                    >
                        Save GCash Wallet
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGcashForm(false)}
                        className="sm:col-span-2 px-4 py-2 rounded-xl bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                </form>
                )}
            </section>

            <section className="bg-surface rounded-2xl p-5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-sm font-bold text-white">Cards</h2>
                        <p className="text-xs text-text-muted">Store credit or debit cards (last 4 digits only)</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Card</span>
                </div>
                {!showCardForm ? (
                    <button
                        type="button"
                        onClick={() => setShowCardForm(true)}
                        className="w-full py-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold border border-primary/30 hover:bg-primary/20 transition-colors"
                    >
                        Add Card
                    </button>
                ) : (
                <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={handleAddCard}>
                    <label className="space-y-1 text-xs text-text-muted">
                        Card Label (optional)
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="Payroll card"
                            value={cardForm.label}
                            onChange={(e) => setCardForm((prev) => ({ ...prev, label: e.target.value }))}
                        />
                        <span className="block text-[11px] text-text-muted/80">Shown on receipts.</span>
                    </label>
                    <label className="space-y-1 text-xs text-text-muted">
                        Name on Card
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="Juan Dela Cruz"
                            value={cardForm.name}
                            onChange={(e) => setCardForm((prev) => ({ ...prev, name: e.target.value }))}
                            required
                        />
                        <span className="block text-[11px] text-text-muted/80">As printed on the card.</span>
                    </label>
                    <label className="space-y-1 text-xs text-text-muted">
                        Card Brand
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="Visa or Mastercard"
                            value={cardForm.brand}
                            onChange={(e) => setCardForm((prev) => ({ ...prev, brand: e.target.value }))}
                        />
                    </label>
                    <label className="space-y-1 text-xs text-text-muted">
                        Last 4 Digits
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="1234"
                            value={cardForm.last4}
                            onChange={(e) => setCardForm((prev) => ({ ...prev, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            required
                        />
                    </label>
                    <label className="space-y-1 text-xs text-text-muted">
                        Expiry Month
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="MM"
                            value={cardForm.expMonth}
                            onChange={(e) => setCardForm((prev) => ({ ...prev, expMonth: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                            required
                        />
                    </label>
                    <label className="space-y-1 text-xs text-text-muted">
                        Expiry Year
                        <input
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="YYYY"
                            value={cardForm.expYear}
                            onChange={(e) => setCardForm((prev) => ({ ...prev, expYear: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            required
                        />
                    </label>
                    <button
                        type="submit"
                        className="sm:col-span-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                    >
                        Save Card
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCardForm(false)}
                        className="sm:col-span-2 px-4 py-2 rounded-xl bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                </form>
                )}
            </section>

            <section className="bg-surface rounded-2xl p-5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white">Saved Methods</h2>
                    <span className="text-xs text-text-muted">{methods.length} total</span>
                </div>
                {loading ? (
                    <div className="text-sm text-text-muted">Loading payment methods...</div>
                ) : methods.length === 0 ? (
                    <div className="text-sm text-text-muted">No payment methods yet.</div>
                ) : (
                    <div className="space-y-3">
                        {methods.map((method) => (
                            <div
                                key={method.id}
                                className="flex items-center justify-between gap-3 bg-surfaceHighlight border border-white/10 rounded-xl p-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-white text-sm font-semibold truncate">
                                        {method.label}
                                        {method.isDefault && (
                                            <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Default</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        {method.type === 'GCASH'
                                            ? `${method.name} - ${method.phone}`
                                            : `${method.brand || 'Card'} - **** ${method.last4} - ${method.expMonth}/${method.expYear}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!method.isDefault && (
                                        <button
                                            onClick={() => setAsDefault(method.id)}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                        >
                                            Set Default
                                        </button>
                                    )}
                                    <button
                                        onClick={() => removeMethod(method.id)}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
