import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Receipt from '../../components/Receipt';
import { withApiBase } from '../../config/api';

const MIN_PIN_LENGTH = 4;

const TABS = {
    SECURITY: 'SECURITY',
    RECEIPT: 'RECEIPT',
    PAYROLL: 'PAYROLL'
};

const DEFAULT_RECEIPT_SETTINGS = {
    invoiceTitle: 'SALES INVOICE',
    businessName: 'FitOS Gym',
    branchAddress: '123 Fitness Blvd, Gym City',
    tin: '',
    vatType: 'VAT',
    vatRate: '12',
    permitToUseNo: '',
    birAccreditationNo: '',
    minNo: '',
    serialNo: '',
    vatRegTin: '',
    systemDetails: '',
    mandatoryDisclaimer: 'THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX',
    printerName: '',
    printerTin: '',
    issuedDateLabel: 'Date & Time Issued',
    thankYouMessage: 'Thank you for training with us!'
};

export default function PosSettings() {
    const [activeTab, setActiveTab] = useState(TABS.SECURITY);

    const [loading, setLoading] = useState(false);
    const [receiptSaving, setReceiptSaving] = useState(false);
    const [status, setStatus] = useState({ hasVoidPin: false, hasReturnPin: false });
    const [voidPin, setVoidPin] = useState('');
    const [returnPin, setReturnPin] = useState('');
    const [clearVoidPin, setClearVoidPin] = useState(false);
    const [clearReturnPin, setClearReturnPin] = useState(false);
    const [receiptSettings, setReceiptSettings] = useState(DEFAULT_RECEIPT_SETTINGS);

    const [payrollConfig, setPayrollConfig] = useState({
        classBasePay: 350,
        classBonusPerStudent: 30,
        classBonusThreshold: 5
    });
    const [payrollLoading, setPayrollLoading] = useState(false);

    const authHeaders = () => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : undefined;
    };

    useEffect(() => {
        fetchPosSettings();
        fetchPayrollConfig();
    }, []);

    const fetchPosSettings = async () => {
        try {
            const res = await axios.get(withApiBase('/api/pos/settings'), {
                headers: authHeaders()
            });
            setStatus({
                hasVoidPin: Boolean(res.data?.hasVoidPin),
                hasReturnPin: Boolean(res.data?.hasReturnPin)
            });
            setReceiptSettings((prev) => ({
                ...prev,
                ...(res.data?.receiptSettings || {})
            }));
        } catch (e) {
            console.error('Failed to load POS settings', e);
        }
    };

    const fetchPayrollConfig = async () => {
        try {
            const res = await axios.get(withApiBase('/api/admin/payroll/config'), {
                headers: authHeaders()
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

    const handleSavePins = async (e) => {
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

        if (payload.voidPin === undefined && payload.returnPin === undefined) {
            return alert('Nothing to update.');
        }

        setLoading(true);
        try {
            await axios.post(withApiBase('/api/pos/settings'), payload, {
                headers: authHeaders()
            });

            setVoidPin('');
            setReturnPin('');
            setClearVoidPin(false);
            setClearReturnPin(false);
            await fetchPosSettings();
            alert('POS PIN settings updated.');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update POS settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReceipt = async (e) => {
        e.preventDefault();

        if (!String(receiptSettings.invoiceTitle || '').trim()) {
            return alert('Receipt title is required.');
        }
        if (!String(receiptSettings.businessName || '').trim()) {
            return alert('Business name is required for the receipt.');
        }
        if (!String(receiptSettings.branchAddress || '').trim()) {
            return alert('Branch address is required for the receipt.');
        }

        setReceiptSaving(true);
        try {
            await axios.post(withApiBase('/api/pos/settings'), {
                receiptSettings
            }, {
                headers: authHeaders()
            });
            await fetchPosSettings();
            alert('Receipt settings updated.');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update receipt settings');
        } finally {
            setReceiptSaving(false);
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
            await axios.post(withApiBase('/api/admin/payroll/config'), {
                classBasePay: parseFloat(classBasePay),
                classBonusPerStudent: parseFloat(classBonusPerStudent),
                classBonusThreshold: parseInt(classBonusThreshold)
            }, {
                headers: authHeaders()
            });
            await fetchPayrollConfig();
            alert('Payroll config updated.');
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update payroll config');
        } finally {
            setPayrollLoading(false);
        }
    };

    const updateReceiptField = (key, value) => {
        setReceiptSettings((prev) => ({ ...prev, [key]: value }));
    };

    const previewStudents = [3, 5, 8, 10, 15];
    const calcPay = (students) => {
        const base = parseFloat(payrollConfig.classBasePay) || 0;
        const bonus = parseFloat(payrollConfig.classBonusPerStudent) || 0;
        const threshold = parseInt(payrollConfig.classBonusThreshold) || 0;
        const extra = Math.max(0, students - threshold) * bonus;
        return base + extra;
    };

    const receiptPreviewData = useMemo(() => ({
        transaction: {
            id: 'PREVIEW',
            amount: 499,
            type: 'POS_PREVIEW',
            method: 'CASH',
            date: new Date().toISOString()
        },
        items: [
            { name: 'Sample Item', quantity: 1, price: 349 },
            { name: 'Protein Shake', quantity: 1, price: 150 }
        ],
        member: {
            firstName: 'Juan',
            lastName: 'Dela Cruz',
            tin: '123-456-789-000'
        }
    }), []);

    return (
        <div className="space-y-6 w-full">
            <header>
                <h1 className="text-3xl font-bold text-white">POS Settings</h1>
                <p className="text-text-muted mt-1">Configure POS security, BIR receipt details, and payroll settings.</p>
            </header>

            <div className="bg-surface rounded-3xl border border-white/5 p-2 shadow-sm flex flex-wrap gap-2">
                <TabButton
                    active={activeTab === TABS.SECURITY}
                    onClick={() => setActiveTab(TABS.SECURITY)}
                    label="Security"
                />
                <TabButton
                    active={activeTab === TABS.RECEIPT}
                    onClick={() => setActiveTab(TABS.RECEIPT)}
                    label="Receipt"
                />
                <TabButton
                    active={activeTab === TABS.PAYROLL}
                    onClick={() => setActiveTab(TABS.PAYROLL)}
                    label="Payroll"
                />
            </div>

            {activeTab === TABS.SECURITY && (
                <div className="space-y-6">
                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-white mb-4">Current PIN Status</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <StatusCard label="Void PIN" enabled={status.hasVoidPin} />
                            <StatusCard label="Return PIN" enabled={status.hasReturnPin} />
                        </div>
                    </div>

                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-white mb-4">Update PINs</h3>
                        <form onSubmit={handleSavePins} className="space-y-6">
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
                                    {loading ? 'Saving...' : 'Save PIN Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === TABS.RECEIPT && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-6 items-start">
                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-white mb-1">Receipt (BIR Text)</h3>
                        <p className="text-text-muted text-sm mb-6">Update receipt details and compliance text used by POS preview/print.</p>

                        <form onSubmit={handleSaveReceipt} className="space-y-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Header</p>
                            <Field label="Receipt Title" value={receiptSettings.invoiceTitle} onChange={(v) => updateReceiptField('invoiceTitle', v)} required />
                            <Field label="Business Name" value={receiptSettings.businessName} onChange={(v) => updateReceiptField('businessName', v)} required />
                            <Field label="Branch Address" value={receiptSettings.branchAddress} onChange={(v) => updateReceiptField('branchAddress', v)} required />
                            <Field label="TIN (with branch code)" value={receiptSettings.tin} onChange={(v) => updateReceiptField('tin', v)} />

                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2">VAT / Non-VAT Label</label>
                                <select
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={receiptSettings.vatType || 'VAT'}
                                    onChange={(e) => updateReceiptField('vatType', e.target.value)}
                                >
                                    <option value="VAT">VAT</option>
                                    <option value="NON-VAT">NON-VAT</option>
                                </select>
                            </div>

                            <Field
                                label="VAT Rate (%)"
                                value={receiptSettings.vatRate}
                                onChange={(v) => updateReceiptField('vatRate', v)}
                                placeholder="12"
                            />

                            <p className="text-xs font-bold uppercase tracking-widest text-text-muted pt-2">Body</p>
                            <Field label="Date/Time Label" value={receiptSettings.issuedDateLabel} onChange={(v) => updateReceiptField('issuedDateLabel', v)} placeholder="Date & Time Issued" />
                            <Field label="Invoice / Serial Prefix (optional)" value={receiptSettings.serialNo} onChange={(v) => updateReceiptField('serialNo', v)} placeholder="SI-" />
                            <Field label="VAT Reg TIN Line" value={receiptSettings.vatRegTin} onChange={(v) => updateReceiptField('vatRegTin', v)} placeholder="VAT REG TIN: 123-456-789-000" />

                            <p className="text-xs font-bold uppercase tracking-widest text-text-muted pt-2">Footer</p>
                            <Field label="Permit To Use No." value={receiptSettings.permitToUseNo} onChange={(v) => updateReceiptField('permitToUseNo', v)} />
                            <Field label="BIR Accreditation No." value={receiptSettings.birAccreditationNo} onChange={(v) => updateReceiptField('birAccreditationNo', v)} />
                            <Field label="MIN No." value={receiptSettings.minNo} onChange={(v) => updateReceiptField('minNo', v)} />
                            <Field label="System Details" value={receiptSettings.systemDetails} onChange={(v) => updateReceiptField('systemDetails', v)} placeholder="POS Provider / Version / Terminal ID" />
                            <Field label="Accredited Printer" value={receiptSettings.printerName} onChange={(v) => updateReceiptField('printerName', v)} />
                            <Field label="Printer TIN" value={receiptSettings.printerTin} onChange={(v) => updateReceiptField('printerTin', v)} />

                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2">Mandatory Disclaimer</label>
                                <textarea
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    rows={2}
                                    value={receiptSettings.mandatoryDisclaimer}
                                    onChange={(e) => updateReceiptField('mandatoryDisclaimer', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2">Thank You Message</label>
                                <textarea
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    rows={2}
                                    value={receiptSettings.thankYouMessage}
                                    onChange={(e) => updateReceiptField('thankYouMessage', e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={receiptSaving}
                                    className="px-6 py-3 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                                >
                                    {receiptSaving ? 'Saving...' : 'Save Receipt Settings'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-white mb-4">Live Receipt Preview</h3>
                        <div className="bg-surfaceHighlight rounded-2xl border border-white/10 p-3 overflow-auto">
                            <Receipt
                                transaction={receiptPreviewData.transaction}
                                items={receiptPreviewData.items}
                                member={receiptPreviewData.member}
                                discount={0}
                                cashierName="Preview Cashier"
                                paymentDetails={{ method: 'CASH', tendered: 500, change: 1 }}
                                receiptSettings={receiptSettings}
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === TABS.PAYROLL && (
                <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                    <h3 className="text-xl font-bold text-white mb-1">Class Compensation</h3>
                    <p className="text-text-muted text-sm mb-6">Configure how trainers are paid for group classes.</p>

                    <form onSubmit={handlePayrollSave} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2">Base Pay per Class</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={payrollConfig.classBasePay}
                                    onChange={(e) => setPayrollConfig((p) => ({ ...p, classBasePay: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2">Bonus per Student</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={payrollConfig.classBonusPerStudent}
                                    onChange={(e) => setPayrollConfig((p) => ({ ...p, classBonusPerStudent: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2">Threshold (bonus starts after)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={payrollConfig.classBonusThreshold}
                                    onChange={(e) => setPayrollConfig((p) => ({ ...p, classBonusThreshold: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="bg-surfaceHighlight rounded-2xl border border-white/10 p-4">
                            <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-3">Live Preview</p>
                            <div className="space-y-2">
                                {previewStudents.map((n) => {
                                    const pay = calcPay(n);
                                    const threshold = parseInt(payrollConfig.classBonusThreshold) || 0;
                                    const bonusStudents = Math.max(0, n - threshold);
                                    const basePay = parseFloat(payrollConfig.classBasePay) || 0;
                                    const bonusRate = parseFloat(payrollConfig.classBonusPerStudent) || 0;
                                    return (
                                        <div key={n} className="flex items-center justify-between text-sm">
                                            <span className="text-text-muted">
                                                {n} students -&gt;
                                                <span className="text-gray-400 ml-1">
                                                    PHP {basePay.toFixed(0)}
                                                    {bonusStudents > 0 && ` + (${bonusStudents} x PHP ${bonusRate.toFixed(0)})`}
                                                </span>
                                            </span>
                                            <span className={`font-bold ${bonusStudents > 0 ? 'text-emerald-400' : 'text-white'}`}>
                                                PHP {pay.toFixed(2)}
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
            )}
        </div>
    );
}

const TabButton = ({ active, label, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-4 py-2 rounded-2xl text-sm font-bold transition-colors ${
            active
                ? 'bg-primary text-white'
                : 'bg-surfaceHighlight text-text-muted hover:text-white hover:bg-white/10'
        }`}
    >
        {label}
    </button>
);

const Field = ({ label, value, onChange, placeholder, required = false }) => (
    <div>
        <label className="block text-xs text-text-secondary font-bold mb-2">{label}</label>
        <input
            type="text"
            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={value || ''}
            placeholder={placeholder}
            required={required}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

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
