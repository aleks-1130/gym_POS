import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MIN_PIN_LENGTH = 4;

export default function PosSettings() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ hasVoidPin: false, hasReturnPin: false });
    const [voidPin, setVoidPin] = useState('');
    const [returnPin, setReturnPin] = useState('');
    const [clearVoidPin, setClearVoidPin] = useState(false);
    const [clearReturnPin, setClearReturnPin] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/pos/settings', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatus(res.data);
        } catch (e) {
            console.error('Failed to load POS settings', e);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();

        const payload = {};
        if (clearVoidPin) {
            payload.voidPin = '';
        } else if (voidPin) {
            if (String(voidPin).length < MIN_PIN_LENGTH) {
                return alert(`Void PIN must be at least ${MIN_PIN_LENGTH} digits.`);
            }
            payload.voidPin = voidPin;
        }

        if (clearReturnPin) {
            payload.returnPin = '';
        } else if (returnPin) {
            if (String(returnPin).length < MIN_PIN_LENGTH) {
                return alert(`Return PIN must be at least ${MIN_PIN_LENGTH} digits.`);
            }
            payload.returnPin = returnPin;
        }

        if (!payload.voidPin && !payload.returnPin) {
            return alert('Nothing to update.');
        }

        setLoading(true);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/pos/settings', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setVoidPin('');
            setReturnPin('');
            setClearVoidPin(false);
            setClearReturnPin(false);
            await fetchSettings();
            alert('POS settings updated.');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update POS settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <header>
                <h1 className="text-3xl font-bold text-white">POS Settings</h1>
                <p className="text-text-muted mt-1">Configure void and return PINs for POS transactions.</p>
            </header>

            <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                <h3 className="text-xl font-bold text-white mb-4">Current Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatusCard label="Void PIN" enabled={status.hasVoidPin} />
                    <StatusCard label="Return PIN" enabled={status.hasReturnPin} />
                </div>
            </div>

            <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                <h3 className="text-xl font-bold text-white mb-4">Update PINs</h3>
                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label className="block text-xs text-text-secondary font-bold mb-2">Void PIN</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="password"
                                className="flex-1 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder={`Enter ${MIN_PIN_LENGTH}+ digit PIN`}
                                value={voidPin}
                                onChange={(e) => {
                                    setVoidPin(e.target.value);
                                    setClearVoidPin(false);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setVoidPin('');
                                    setClearVoidPin(true);
                                }}
                                className="px-4 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                            >
                                Clear Void PIN
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-text-secondary font-bold mb-2">Return PIN</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="password"
                                className="flex-1 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder={`Enter ${MIN_PIN_LENGTH}+ digit PIN`}
                                value={returnPin}
                                onChange={(e) => {
                                    setReturnPin(e.target.value);
                                    setClearReturnPin(false);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setReturnPin('');
                                    setClearReturnPin(true);
                                }}
                                className="px-4 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                            >
                                Clear Return PIN
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const StatusCard = ({ label, enabled }) => (
    <div className="bg-surfaceHighlight rounded-2xl border border-white/10 p-4 flex items-center justify-between">
        <div>
            <p className="text-xs uppercase tracking-widest text-text-muted font-bold">{label}</p>
            <p className="text-lg font-bold text-white mt-1">{enabled ? 'Configured' : 'Not Set'}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {enabled ? 'Active' : 'Inactive'}
        </span>
    </div>
);
