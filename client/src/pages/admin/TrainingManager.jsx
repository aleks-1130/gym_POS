import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export default function TrainingManager() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [sessions, setSessions] = useState([]);
    const [products, setProducts] = useState([]);
    const [addedMaterials, setAddedMaterials] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);

    // Missing states restored
    const [selectedSession, setSelectedSession] = useState(null);
    const [viewSession, setViewSession] = useState(null); // New State for viewing details
    // materialsCost removed
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Custom Item State
    const [isCustomItem, setIsCustomItem] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customCost, setCustomCost] = useState('');

    useEffect(() => {
        fetchSessions();
        fetchProducts();
    }, []);

    const fetchSessions = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/training-sessions?t=${new Date().getTime()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Sessions fetched:", res.data);
            if (Array.isArray(res.data)) {
                // Filter out any null/undefined items
                const validSessions = res.data.filter(s => s && s.id);
                setSessions(validSessions);
            } else {
                console.error("Sessions response is not an array:", res.data);
                setSessions([]);
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
            setSessions([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/products', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Products fetched:", res.data);
            if (Array.isArray(res.data)) {
                setProducts(res.data);
            } else {
                console.error("Products response is not an array:", res.data);
                setProducts([]);
            }
        } catch (e) {
            console.error("Failed to fetch products", e);
            setProducts([]);
        }
    };

    const addMaterial = () => {
        if (isCustomItem) {
            if (!customName || !customCost) return;
            const newItem = {
                productId: null,
                name: customName,
                category: 'OTHER',
                cost: parseFloat(customCost) || 0,
                quantity: parseInt(quantity) || 1
            };
            setAddedMaterials([...addedMaterials, newItem]);
            setCustomName('');
            setCustomCost('');
            setQuantity(1);
            setIsCustomItem(false); // Reset to dropdown
        } else {
            if (!selectedProduct) return;
            const product = products.find(p => p.id === parseInt(selectedProduct));
            if (!product) return;

            const newItem = {
                productId: product.id,
                name: product.name,
                category: product.category,
                // Fallback to retail price if supply cost is missing/zero (better than 0)
                cost: product.supplyCost || product.price || 0,
                quantity: parseInt(quantity) || 1
            };

            setAddedMaterials([...addedMaterials, newItem]);
            setSelectedProduct('');
            setQuantity(1);
        }
    };

    const removeMaterial = (index) => {
        const newMaterials = [...addedMaterials];
        newMaterials.splice(index, 1);
        setAddedMaterials(newMaterials);
    };

    const totalMaterialCost = addedMaterials.reduce((sum, item) => sum + (item.cost * item.quantity), 0);

    const handleComplete = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`http://localhost:5000/api/training-sessions/${selectedSession.id}/complete`, {
                materialsCost: totalMaterialCost, // Only use tracked items
                materials: addedMaterials,
                notes
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Session completed! Commission and Expenses recorded.");
            setSelectedSession(null);
            setAddedMaterials([]);
            setNotes('');
            fetchSessions();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to update session");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading sessions...</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <header>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span className="material-icons-round text-primary">fitness_center</span>
                    Training Sessions
                </h1>
                <p className="text-text-muted mt-1">Manage bookings, track completions, and payout commissions.</p>
            </header>

            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-text-muted text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="p-6">Date / Time</th>
                                <th className="p-6">Member</th>
                                <th className="p-6">Trainer</th>
                                <th className="p-6">Financials</th>
                                <th className="p-6">Status</th>
                                <th className="p-6 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sessions.length === 0 && (
                                <tr><td colSpan="6" className="p-12 text-center text-text-muted">No sessions found.</td></tr>
                            )}
                            {sessions.map(session => (
                                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-6">
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold">
                                                {(() => {
                                                    try {
                                                        const d = new Date(session.date);
                                                        return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString();
                                                    } catch (e) { return 'Date Error'; }
                                                })()}
                                            </span>
                                            <span className="text-text-muted text-xs">
                                                {(() => {
                                                    try {
                                                        const d = new Date(session.date);
                                                        return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    } catch (e) { return '--:--'; }
                                                })()}
                                                ({session.duration}m)
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center text-xs font-bold text-white uppercase border border-white/10">
                                                {session.member?.firstName?.[0] || '?'}
                                            </div>
                                            <span className="text-white font-medium">{session.member?.firstName || 'Unknown'} {session.member?.lastName || 'Member'}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            {session.trainer?.imageUrl ? (
                                                <img src={session.trainer.imageUrl} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase border border-primary/30">
                                                    {session.trainer?.name?.[0]}
                                                </div>
                                            )}
                                            <span className="text-white font-medium">{session.trainer?.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-text-muted">Price:</span>
                                                <span className="text-emerald-400 font-bold">{formatPrice ? formatPrice(session.price) : session.price}</span>
                                            </div>
                                            {session.status === 'COMPLETED' ? (
                                                <>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-text-muted">Comm:</span>
                                                        <span className="text-red-400 font-bold">-{formatPrice(session.price * (session.trainer?.commissionRate || 0))}</span>
                                                    </div>
                                                    {session.materialsCost > 0 && (
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="text-text-muted">Mat:</span>
                                                            <span className="text-red-400 font-bold">-{formatPrice(session.materialsCost)}</span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-[10px] text-text-muted italic">Est. Comm: {formatPrice(session.price * (session.trainer?.commissionRate || 0))}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${session.status === 'COMPLETED'
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                            : session.status === 'CANCELLED'
                                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                            }`}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right">
                                        {session.status === 'SCHEDULED' && (
                                            <button
                                                onClick={() => setSelectedSession(session)}
                                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                            >
                                                Complete
                                            </button>
                                        )}
                                        {session.status === 'COMPLETED' && (
                                            <button
                                                onClick={async () => {
                                                    const token = localStorage.getItem('token');
                                                    try {
                                                        const res = await axios.get(`http://localhost:5000/api/training-sessions/${session.id}?t=${new Date().getTime()}`, {
                                                            headers: { Authorization: `Bearer ${token}` }
                                                        });
                                                        setViewSession(res.data);
                                                    } catch (e) {
                                                        alert("Failed to load details");
                                                    }
                                                }}
                                                className="ml-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-xl transition-all"
                                                title="View Details"
                                            >
                                                <span className="material-icons-round text-sm">visibility</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Completion Modal */}
            {
                selectedSession && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedSession(null)}>
                        <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-md p-6 space-y-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div>
                                <h2 className="text-xl font-bold text-white">Complete Session</h2>
                                <p className="text-text-muted text-sm mt-1">
                                    Confirming this will payout commission to <span className="text-primary font-bold">{selectedSession.trainer?.name}</span>.
                                </p>
                            </div>

                            <form onSubmit={handleComplete} className="space-y-4">
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-text-muted">Session Price</span>
                                        <span className="text-white font-bold">{formatPrice(selectedSession.price)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-text-muted">Commission Rate</span>
                                        <span className="text-white font-bold">{(selectedSession.trainer?.commissionRate * 100 || 0).toFixed(0)}%</span>
                                    </div>
                                    <div className="border-t border-white/10 my-2"></div>
                                    <div className="flex justify-between text-base">
                                        <span className="text-white">Payout Amount</span>
                                        <span className="text-primary font-bold">{formatPrice(selectedSession.price * (selectedSession.trainer?.commissionRate || 0))}</span>
                                    </div>
                                </div>

                                {/* Materials Section */}
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Materials Used</label>

                                    {/* Add Material */}
                                    <div className="flex flex-col gap-2 mb-3">
                                        <div className="flex gap-2">
                                            {isCustomItem ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={customName}
                                                        onChange={e => setCustomName(e.target.value)}
                                                        placeholder="Item Name"
                                                        className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                                                    />
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={customCost}
                                                        onChange={e => setCustomCost(e.target.value)}
                                                        placeholder="Cost"
                                                        className="w-24 bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                                                    />
                                                </>
                                            ) : (
                                                <select
                                                    value={selectedProduct}
                                                    onChange={e => setSelectedProduct(e.target.value)}
                                                    className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                                                >
                                                    <option value="">Select Product...</option>
                                                    {Array.isArray(products) && products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                                                    ))}
                                                </select>
                                            )}
                                            <input
                                                type="number"
                                                min="1"
                                                value={quantity}
                                                onChange={e => setQuantity(e.target.value)}
                                                className="w-16 bg-background border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:border-primary outline-none text-center"
                                            />
                                            <button
                                                type="button"
                                                onClick={addMaterial}
                                                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
                                            >
                                                <span className="material-icons-round text-sm">add</span>
                                            </button>
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setIsCustomItem(!isCustomItem)}
                                                className="text-xs text-primary hover:underline"
                                            >
                                                {isCustomItem ? "Select existing product" : "Enter custom item manually"}
                                            </button>
                                        </div>
                                    </div>

                                    {addedMaterials.length > 0 && (
                                        <div className="bg-background rounded-xl p-3 space-y-2 mb-3 max-h-32 overflow-y-auto custom-scrollbar">
                                            {addedMaterials.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-sm group">
                                                    <div className="text-white">
                                                        <span className="text-primary font-bold mr-2">{item.quantity}x</span>
                                                        {item.name}
                                                    </div>
                                                    <button type="button" onClick={() => removeMaterial(idx)} className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                                        <span className="material-icons-round text-sm">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="border-t border-white/10 pt-2 mt-2 flex justify-between text-xs font-bold">
                                                <span className="text-text-muted">Total Material Cost</span>
                                                <span className="text-red-400">{formatPrice(totalMaterialCost)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Any session notes..."
                                        rows="2"
                                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all resize-none text-sm"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <span className="material-icons-round animate-spin">sync</span> : <span className="material-icons-round">check_circle</span>}
                                    {submitting ? 'Processing...' : 'Confirm Completion'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* View Details Modal */}
            {
                viewSession && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewSession(null)}>
                        <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-2xl p-6 space-y-6 animate-slide-up max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Session Details</h2>
                                    <p className="text-text-muted text-sm mt-1">ID: #{viewSession.id} • {new Date(viewSession.date).toLocaleDateString()}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${viewSession.status === 'COMPLETED'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : viewSession.status === 'CANCELLED'
                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                        : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    }`}>
                                    {viewSession.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <span className="text-xs text-text-muted uppercase font-bold">Trainer</span>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                            {viewSession.trainer?.name?.[0]}
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">{viewSession.trainer?.name}</div>
                                            <div className="text-xs text-text-muted">Comm Rate: {(viewSession.trainer?.commissionRate * 100).toFixed(0)}%</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <span className="text-xs text-text-muted uppercase font-bold">Member</span>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="w-10 h-10 rounded-full bg-surfaceHighlight flex items-center justify-center text-white font-bold">
                                            {viewSession.member?.firstName?.[0]}
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">{viewSession.member?.firstName} {viewSession.member?.lastName}</div>
                                            <div className="text-xs text-text-muted">{viewSession.member?.email}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Financial Breakdown</h3>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="p-3 bg-background rounded-xl">
                                        <div className="text-xs text-text-muted mb-1">Session Price</div>
                                        <div className="text-emerald-400 font-bold text-lg">{formatPrice(viewSession.price)}</div>
                                    </div>
                                    <div className="p-3 bg-background rounded-xl">
                                        <div className="text-xs text-text-muted mb-1">Commission</div>
                                        <div className="text-red-400 font-bold text-lg">
                                            {viewSession.status === 'COMPLETED' ? `-${formatPrice(viewSession.price * (viewSession.trainer?.commissionRate || 0))}` : 'Pending'}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-background rounded-xl">
                                        <div className="text-xs text-text-muted mb-1">Materials</div>
                                        <div className="text-red-400 font-bold text-lg">
                                            {viewSession.materialsCost > 0 ? `-${formatPrice(viewSession.materialsCost)}` : 'None'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {viewSession.materials && viewSession.materials.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Materials Used</h3>
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-text-muted text-xs">
                                            <tr>
                                                <th className="pb-2">Item</th>
                                                <th className="pb-2 text-center">Qty</th>
                                                <th className="pb-2 text-right">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {viewSession.materials.map((m, i) => (
                                                <tr key={i}>
                                                    <td className="py-2 text-white">{m.name}</td>
                                                    <td className="py-2 text-center text-text-muted">x{m.quantity}</td>
                                                    <td className="py-2 text-right text-white">{formatPrice(m.totalCost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {viewSession.notes && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Notes</h3>
                                    <div className="p-4 bg-background rounded-xl text-text-muted text-sm italic">
                                        "{viewSession.notes}"
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={() => setViewSession(null)}
                                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
