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

    // Payroll config state
    const [payrollConfig, setPayrollConfig] = useState({
        classBasePay: 350,
        classBonusPerStudent: 30,
        classBonusThreshold: 5
    });
    const [payrollLoading, setPayrollLoading] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchPayrollConfig();
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

    const fetchPayrollConfig = async () => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/admin/payroll/config', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPayrollConfig({
                classBasePay: res.data.classBasePay,
                classBonusPerStudent: res.data.classBonusPerStudent,
                classBonusThreshold: res.data.classBonusThreshold
            });
        } catch (e) {
            console.error('Failed to load payroll config', e);
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

    const handlePayrollSave = async (e) => {
        e.preventDefault();
        const { classBasePay, classBonusPerStudent, classBonusThreshold } = payrollConfig;

        if (classBasePay < 0 || classBonusPerStudent < 0 || classBonusThreshold < 0) {
            return alert('Values must be positive.');
        }
        if (classBonusThreshold > 50) {
            return alert('Threshold seems too high (max 50). Are you sure?');
        }

        setPayrollLoading(true);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/admin/payroll/config', {
                classBasePay: parseFloat(classBasePay),
                classBonusPerStudent: parseFloat(classBonusPerStudent),
                classBonusThreshold: parseInt(classBonusThreshold)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchPayrollConfig();
            alert('Payroll config updated.');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update payroll config');
        } finally {
            setPayrollLoading(false);
        }
    };

    // Live preview calculation
    const previewStudents = [3, 5, 8, 10, 15];
    const calcPay = (students) => {
        const base = parseFloat(payrollConfig.classBasePay) || 0;
        const bonus = parseFloat(payrollConfig.classBonusPerStudent) || 0;
        const threshold = parseInt(payrollConfig.classBonusThreshold) || 0;
        const extra = Math.max(0, students - threshold) * bonus;
        return base + extra;
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <header>
                <h1 className="text-3xl font-bold text-white">POS Settings</h1>
                <p className="text-text-muted mt-1">Configure POS and payroll settings.</p>
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

            {/* Payroll / Class Compensation Settings */}
            <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                <h3 className="text-xl font-bold text-white mb-1">Class Compensation</h3>
                <p className="text-text-muted text-sm mb-6">Configure how trainers are paid for group classes.</p>

                <form onSubmit={handlePayrollSave} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-2">Base Pay per Class</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">₱</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={payrollConfig.classBasePay}
                                    onChange={e => setPayrollConfig(p => ({ ...p, classBasePay: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-2">Bonus per Student</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">₱</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={payrollConfig.classBonusPerStudent}
                                    onChange={e => setPayrollConfig(p => ({ ...p, classBonusPerStudent: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-2">Threshold (bonus starts after)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={payrollConfig.classBonusThreshold}
                                    onChange={e => setPayrollConfig(p => ({ ...p, classBonusThreshold: e.target.value }))}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-xs">students</span>
                            </div>
                        </div>
                    </div>

                    {/* Live Preview */}
                    <div className="bg-surfaceHighlight rounded-2xl border border-white/10 p-4">
                        <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-3">Live Preview</p>
                        <div className="space-y-2">
                            {previewStudents.map(n => {
                                const pay = calcPay(n);
                                const threshold = parseInt(payrollConfig.classBonusThreshold) || 0;
                                const bonusStudents = Math.max(0, n - threshold);
                                const basePay = parseFloat(payrollConfig.classBasePay) || 0;
                                const bonusRate = parseFloat(payrollConfig.classBonusPerStudent) || 0;
                                return (
                                    <div key={n} className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">
                                            {n} students →
                                            <span className="text-gray-400 ml-1">
                                                ₱{basePay.toFixed(0)}
                                                {bonusStudents > 0 && ` + (${bonusStudents} × ₱${bonusRate.toFixed(0)})`}
                                            </span>
                                        </span>
                                        <span className={`font-bold ${bonusStudents > 0 ? 'text-emerald-400' : 'text-white'}`}>
                                            ₱{pay.toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={payrollLoading}
                            className="px-6 py-3 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {payrollLoading ? 'Saving...' : 'Save Payroll Settings'}
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
