import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'trainerPaymentMethods';

const CardIcon = ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 15h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
);

const WalletIcon = ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h10A2.5 2.5 0 0 1 19 8.5V10h-3.5A2.5 2.5 0 0 0 13 12.5v1A2.5 2.5 0 0 0 15.5 16H19v.5A2.5 2.5 0 0 1 16.5 19h-10A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M14 12.5a1.5 1.5 0 0 1 1.5-1.5H20v5h-4.5A1.5 1.5 0 0 1 14 14.5v-2Z" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="16" cy="13.5" r=".8" fill="currentColor" />
    </svg>
);

const DefaultBadge = () => (
    <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Default</span>
);

export default function TrainerPaymentMethods() {
    const [methods, setMethods] = useState([]);
    const [activeForm, setActiveForm] = useState('E_WALLET');

    const [cardForm, setCardForm] = useState({ label: '', brand: '', last4: '' });
    const [walletForm, setWalletForm] = useState({ provider: 'GCASH', label: '', name: '', phone: '' });

    const walletMethods = useMemo(
        () => methods.filter((m) => ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase())),
        [methods]
    );
    const cardMethods = useMemo(
        () => methods.filter((m) => !['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase())),
        [methods]
    );

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

    const addWallet = (e) => {
        e.preventDefault();
        if (!walletForm.name || !walletForm.phone) return;
        const next = [{
            id: Date.now(),
            type: walletForm.provider,
            label: walletForm.label || (walletForm.provider === 'MAYA' ? 'Maya Wallet' : 'GCash Wallet'),
            name: walletForm.name,
            phone: walletForm.phone,
            isDefault: methods.length === 0
        }, ...methods.map((m) => ({ ...m, isDefault: methods.length === 0 ? false : m.isDefault }))];
        persist(next);
        setWalletForm((prev) => ({ ...prev, label: '', name: '', phone: '' }));
    };

    const renderMethodRow = (method) => (
        <div key={method.id} className="flex items-center justify-between gap-3 bg-surfaceHighlight border border-white/10 rounded-xl p-3">
            <div>
                <p className="text-white text-sm font-semibold">
                    {method.label}
                    {method.isDefault && <DefaultBadge />}
                </p>
                <p className="text-xs text-text-muted">
                    {method.type === 'GCASH' || method.type === 'MAYA'
                        ? `${method.type === 'MAYA' ? 'Maya' : 'GCash'} - ${method.phone}`
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
    );

    return (
        <div className="space-y-6 pb-24 max-w-3xl mx-auto px-4">
            <header className="pt-4">
                <h1 className="text-xl font-bold text-white">Trainer Payment Methods</h1>
                <p className="text-text-muted text-xs mt-0.5">Saved locally on this device for Trainer Shop checkout</p>
            </header>

            <section className="bg-surface rounded-2xl p-5 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white">Add Method</h2>
                    <span className="text-xs text-text-muted">Choose type first</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveForm('E_WALLET')}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${activeForm === 'E_WALLET' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surfaceHighlight border-white/10 text-text-muted hover:text-white'}`}
                    >
                        <WalletIcon className="w-5 h-5" />
                        <div className="text-left">
                            <p className="text-sm font-bold">E-Wallet</p>
                            <p className="text-[10px]">GCash / Maya</p>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveForm('CARD')}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${activeForm === 'CARD' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-surfaceHighlight border-white/10 text-text-muted hover:text-white'}`}
                    >
                        <CardIcon className="w-5 h-5" />
                        <div className="text-left">
                            <p className="text-sm font-bold">Card</p>
                            <p className="text-[10px]">Credit / Debit</p>
                        </div>
                    </button>
                </div>

                {activeForm === 'E_WALLET' ? (
                    <form className="grid grid-cols-1 sm:grid-cols-3 gap-3" onSubmit={addWallet}>
                        <select
                            className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white sm:col-span-3"
                            value={walletForm.provider}
                            onChange={(e) => setWalletForm((p) => ({ ...p, provider: e.target.value }))}
                        >
                            <option style={{ color: '#111', backgroundColor: '#fff' }} value="GCASH">GCash</option>
                            <option style={{ color: '#111', backgroundColor: '#fff' }} value="MAYA">Maya</option>
                        </select>
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Label" value={walletForm.label} onChange={(e) => setWalletForm((p) => ({ ...p, label: e.target.value }))} />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Account Name" value={walletForm.name} onChange={(e) => setWalletForm((p) => ({ ...p, name: e.target.value }))} required />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Phone" value={walletForm.phone} onChange={(e) => setWalletForm((p) => ({ ...p, phone: e.target.value }))} required />
                        <button className="sm:col-span-3 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold" type="submit">Add E-Wallet</button>
                    </form>
                ) : (
                    <form className="grid grid-cols-1 sm:grid-cols-3 gap-3" onSubmit={addCard}>
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Label" value={cardForm.label} onChange={(e) => setCardForm((p) => ({ ...p, label: e.target.value }))} />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Brand" value={cardForm.brand} onChange={(e) => setCardForm((p) => ({ ...p, brand: e.target.value }))} />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Last 4 digits" value={cardForm.last4} onChange={(e) => setCardForm((p) => ({ ...p, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
                        <button className="sm:col-span-3 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold" type="submit">Add Card</button>
                    </form>
                )}
            </section>

            <section className="bg-surface rounded-2xl p-5 border border-white/5 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">Saved Methods</h2>
                    <span className="text-xs text-text-muted">{methods.length} total</span>
                </div>

                {methods.length === 0 ? (
                    <div className="text-sm text-text-muted">No payment methods yet.</div>
                ) : (
                    <>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                                <WalletIcon className="w-4 h-4" />
                                <span>E-Wallet</span>
                                <span className="text-text-muted">({walletMethods.length})</span>
                            </div>
                            {walletMethods.length === 0 ? (
                                <div className="text-xs text-text-muted bg-surfaceHighlight border border-white/10 rounded-lg p-3">No e-wallet methods added.</div>
                            ) : walletMethods.map(renderMethodRow)}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-white/90 text-xs font-bold uppercase tracking-wider">
                                <CardIcon className="w-4 h-4" />
                                <span>Card</span>
                                <span className="text-text-muted">({cardMethods.length})</span>
                            </div>
                            {cardMethods.length === 0 ? (
                                <div className="text-xs text-text-muted bg-surfaceHighlight border border-white/10 rounded-lg p-3">No card methods added.</div>
                            ) : cardMethods.map(renderMethodRow)}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
