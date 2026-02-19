import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'trainerPaymentMethods';

export default function TrainerPaymentMethods() {
    const [methods, setMethods] = useState([]);
    const [cardForm, setCardForm] = useState({ label: '', brand: '', last4: '' });
    const [gcashForm, setGcashForm] = useState({ label: '', name: '', phone: '' });

    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setMethods(Array.isArray(parsed) ? parsed : []);
    }, []);

    const persist = (next) => {
        setMethods(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const setDefault = (id) => {
        persist(methods.map((m) => ({ ...m, isDefault: m.id === id })));
    };

    const removeMethod = (id) => {
        const next = methods.filter((m) => m.id !== id);
        if (next.length > 0 && !next.some((m) => m.isDefault)) {
            next[0].isDefault = true;
        }
        persist(next);
    };

    const addCard = (e) => {
        e.preventDefault();
        if (!cardForm.last4 || cardForm.last4.length !== 4) return;
        const next = [{
            id: Date.now(),
            type: 'CARD',
            label: cardForm.label || 'Card',
            brand: cardForm.brand || 'CARD',
            last4: cardForm.last4,
            isDefault: methods.length === 0
        }, ...methods.map((m) => ({ ...m, isDefault: methods.length === 0 ? false : m.isDefault }))];
        persist(next);
        setCardForm({ label: '', brand: '', last4: '' });
    };

    const addGcash = (e) => {
        e.preventDefault();
        if (!gcashForm.name || !gcashForm.phone) return;
        const next = [{
            id: Date.now(),
            type: 'GCASH',
            label: gcashForm.label || 'GCash',
            name: gcashForm.name,
            phone: gcashForm.phone,
            isDefault: methods.length === 0
        }, ...methods.map((m) => ({ ...m, isDefault: methods.length === 0 ? false : m.isDefault }))];
        persist(next);
        setGcashForm({ label: '', name: '', phone: '' });
    };

    return (
        <div className="space-y-6 pb-24 max-w-2xl mx-auto px-4">
            <header className="pt-4">
                <h1 className="text-xl font-bold text-white">Trainer Payment Methods</h1>
                <p className="text-text-muted text-xs mt-0.5">Saved locally on this device for Trainer Shop checkout</p>
            </header>

            <section className="bg-surface rounded-2xl p-5 border border-white/5">
                <h2 className="text-sm font-bold text-white mb-3">Add Card</h2>
                <form className="grid grid-cols-1 sm:grid-cols-3 gap-3" onSubmit={addCard}>
                    <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Label" value={cardForm.label} onChange={(e) => setCardForm((p) => ({ ...p, label: e.target.value }))} />
                    <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Brand" value={cardForm.brand} onChange={(e) => setCardForm((p) => ({ ...p, brand: e.target.value }))} />
                    <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Last 4 digits" value={cardForm.last4} onChange={(e) => setCardForm((p) => ({ ...p, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
                    <button className="sm:col-span-3 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold" type="submit">Add Card</button>
                </form>
            </section>

            <section className="bg-surface rounded-2xl p-5 border border-white/5">
                <h2 className="text-sm font-bold text-white mb-3">Add GCash</h2>
                <form className="grid grid-cols-1 sm:grid-cols-3 gap-3" onSubmit={addGcash}>
                    <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Label" value={gcashForm.label} onChange={(e) => setGcashForm((p) => ({ ...p, label: e.target.value }))} />
                    <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Account Name" value={gcashForm.name} onChange={(e) => setGcashForm((p) => ({ ...p, name: e.target.value }))} required />
                    <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Phone" value={gcashForm.phone} onChange={(e) => setGcashForm((p) => ({ ...p, phone: e.target.value }))} required />
                    <button className="sm:col-span-3 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold" type="submit">Add GCash</button>
                </form>
            </section>

            <section className="bg-surface rounded-2xl p-5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white">Saved Methods</h2>
                    <span className="text-xs text-text-muted">{methods.length} total</span>
                </div>
                {methods.length === 0 ? (
                    <div className="text-sm text-text-muted">No payment methods yet.</div>
                ) : (
                    <div className="space-y-3">
                        {methods.map((method) => (
                            <div key={method.id} className="flex items-center justify-between gap-3 bg-surfaceHighlight border border-white/10 rounded-xl p-3">
                                <div>
                                    <p className="text-white text-sm font-semibold">
                                        {method.label}
                                        {method.isDefault && <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Default</span>}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        {method.type === 'GCASH'
                                            ? `${method.name} - ${method.phone}`
                                            : `${method.brand || 'CARD'} - **** ${method.last4}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!method.isDefault && (
                                        <button onClick={() => setDefault(method.id)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Set Default</button>
                                    )}
                                    <button onClick={() => removeMethod(method.id)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
