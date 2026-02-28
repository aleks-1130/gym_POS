import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';

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

export default function PaymentMethods() {
    const { user } = useAuth();
    const { alert: showAlert } = useConfirm();
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeForm, setActiveForm] = useState('E_WALLET');

    const [walletForm, setWalletForm] = useState({ provider: 'GCASH', label: '', name: '', phone: '' });
    const [cardForm, setCardForm] = useState({ label: '', name: '', brand: '', last4: '', expMonth: '', expYear: '' });

    const walletMethods = useMemo(
        () => methods.filter((m) => ['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase())),
        [methods]
    );
    const cardMethods = useMemo(
        () => methods.filter((m) => !['GCASH', 'MAYA'].includes(String(m.type || '').toUpperCase())),
        [methods]
    );

    useEffect(() => {
        const fetchMethods = async () => {
            if (!user?.id) return;
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const res = await axios.get(`/api/members/${user.id}/payment-methods`, {
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
        axios.patch(`/api/members/${user.id}/payment-methods/${id}`, { isDefault: true }, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }).then((res) => {
            const updated = res.data;
            setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === updated.id })));
        }).catch((error) => {
            console.error('Failed to set default method', error);
            showAlert({ title: 'Update Failed', message: error?.response?.data?.error || 'Failed to set default method.', type: 'danger' });
        });
    };

    const removeMethod = (id) => {
        if (!user?.id) return;
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        axios.delete(`/api/members/${user.id}/payment-methods/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }).then(() => {
            setMethods((prev) => prev.filter((m) => m.id !== id));
        }).catch((error) => {
            console.error('Failed to remove method', error);
            showAlert({ title: 'Remove Failed', message: error?.response?.data?.error || 'Failed to remove method.', type: 'danger' });
        });
    };

    const handleAddWallet = (e) => {
        e.preventDefault();
        const phoneDigits = walletForm.phone.replace(/\D/g, '');
        if (!walletForm.phone.trim() || !walletForm.name.trim()) return;
        if (phoneDigits.length < 4) {
            showAlert({ title: 'Invalid Number', message: 'Please enter a valid wallet number (at least 4 digits).', type: 'warning' });
            return;
        }

        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        const isMaya = walletForm.provider === 'MAYA';

        axios.post(`/api/members/${user.id}/payment-methods`, {
            type: walletForm.provider,
            label: walletForm.label.trim() || (isMaya ? 'Maya Wallet' : 'GCash Wallet'),
            name: walletForm.name.trim(),
            phone: walletForm.phone.trim(),
            isDefault: methods.length === 0
        }, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }).then((res) => {
            setMethods((prev) => [res.data, ...prev]);
            setWalletForm((prev) => ({ ...prev, label: '', name: '', phone: '' }));
        }).catch((error) => {
            console.error('Failed to add e-wallet method', error);
            showAlert({ title: 'Add Failed', message: error?.response?.data?.error || 'Failed to add e-wallet method.', type: 'danger' });
        });
    };

    const handleAddCard = (e) => {
        e.preventDefault();
        if (!cardForm.name.trim() || !cardForm.last4.trim() || !cardForm.expMonth.trim() || !cardForm.expYear.trim()) return;

        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        axios.post(`/api/members/${user.id}/payment-methods`, {
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
            showAlert({ title: 'Add Failed', message: error?.response?.data?.error || 'Failed to add card method.', type: 'danger' });
        });
    };

    const renderMethodRow = (method) => (
        <div
            key={method.id}
            className="flex items-center justify-between gap-3 bg-surfaceHighlight border border-white/10 rounded-xl p-3"
        >
            <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">
                    {method.label}
                    {method.isDefault && <DefaultBadge />}
                </p>
                <p className="text-xs text-text-muted">
                    {['GCASH', 'MAYA'].includes(String(method.type || '').toUpperCase())
                        ? `${String(method.type || '').toUpperCase() === 'MAYA' ? 'Maya' : 'GCash'} - ${method.phone}`
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
    );

    return (
        <div className="space-y-6 pb-24 max-w-3xl mx-auto">
            <header className="pt-4">
                <h1 className="text-xl font-bold text-white">Payment Methods</h1>
                <p className="text-text-muted text-xs mt-0.5">Manage your E-Wallets and Cards for faster checkout</p>
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
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${activeForm === 'E_WALLET'
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'bg-surfaceHighlight border-white/10 text-text-muted hover:text-white'
                            }`}
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
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${activeForm === 'CARD'
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'bg-surfaceHighlight border-white/10 text-text-muted hover:text-white'
                            }`}
                    >
                        <CardIcon className="w-5 h-5" />
                        <div className="text-left">
                            <p className="text-sm font-bold">Card</p>
                            <p className="text-[10px]">Credit / Debit</p>
                        </div>
                    </button>
                </div>

                {activeForm === 'E_WALLET' ? (
                    <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleAddWallet}>
                        <select
                            className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white sm:col-span-2"
                            value={walletForm.provider}
                            onChange={(e) => setWalletForm((prev) => ({ ...prev, provider: e.target.value }))}
                        >
                            <option style={{ color: '#111', backgroundColor: '#fff' }} value="GCASH">GCash</option>
                            <option style={{ color: '#111', backgroundColor: '#fff' }} value="MAYA">Maya</option>
                        </select>
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Label (optional)" value={walletForm.label} onChange={(e) => setWalletForm((prev) => ({ ...prev, label: e.target.value }))} />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Account Name" value={walletForm.name} onChange={(e) => setWalletForm((prev) => ({ ...prev, name: e.target.value }))} required />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white sm:col-span-2" placeholder="Mobile Number" value={walletForm.phone} onChange={(e) => setWalletForm((prev) => ({ ...prev, phone: e.target.value }))} required />
                        <button type="submit" className="sm:col-span-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-orange-600">Add E-Wallet</button>
                    </form>
                ) : (
                    <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleAddCard}>
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Label (optional)" value={cardForm.label} onChange={(e) => setCardForm((prev) => ({ ...prev, label: e.target.value }))} />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Name on Card" value={cardForm.name} onChange={(e) => setCardForm((prev) => ({ ...prev, name: e.target.value }))} required />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Brand (Visa, Mastercard)" value={cardForm.brand} onChange={(e) => setCardForm((prev) => ({ ...prev, brand: e.target.value }))} />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Last 4 digits" value={cardForm.last4} onChange={(e) => setCardForm((prev) => ({ ...prev, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Exp. Month (MM)" value={cardForm.expMonth} onChange={(e) => setCardForm((prev) => ({ ...prev, expMonth: e.target.value.replace(/\D/g, '').slice(0, 2) }))} required />
                        <input className="bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-sm text-white" placeholder="Exp. Year (YYYY)" value={cardForm.expYear} onChange={(e) => setCardForm((prev) => ({ ...prev, expYear: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
                        <button type="submit" className="sm:col-span-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-orange-600">Add Card</button>
                    </form>
                )}
            </section>

            <section className="bg-surface rounded-2xl p-5 border border-white/5 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">Saved Methods</h2>
                    <span className="text-xs text-text-muted">{methods.length} total</span>
                </div>

                {loading ? (
                    <div className="text-sm text-text-muted">Loading payment methods...</div>
                ) : methods.length === 0 ? (
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
