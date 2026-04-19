import { useConfirm } from '../../context/ConfirmContext';
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Receipt from '../../components/Receipt';
import { withApiBase } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const MIN_PIN_LENGTH = 4;

const TABS = {
    SECURITY: 'SECURITY',
    RECEIPT: 'RECEIPT',
    DISCOUNTS: 'DISCOUNTS'
};

const DEFAULT_RECEIPT_SETTINGS = {
    invoiceTitle: 'SALES INVOICE',
    businessName: 'FitOS Gym',
    branchAddress: '123 Fitness Blvd, Gym City',
    tin: '',
    vatType: 'VAT',
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
    thankYouMessage: 'Thank you for training with us!',
    companyId: 'FITOS_GYM_001',
    currency: 'PHP',
    currencyLocale: 'en-PH',
    roundingRule: 'NEAREST_0_05',
    financialMappings: {
        GCASH: 'GCash / Alipay',
        PAYMAYA: 'Maya / PLDT',
        BANK_TRANSFER: 'Local Bank Transfer',
        CARD: 'Terminal Card'
    }
};

const DISCOUNT_ICON_OPTIONS = [
    'local_offer',
    'percent',
    'sell',
    'workspace_premium',
    'card_giftcard',
    'celebration',
    'school',
    'military_tech',
    'elderly',
    'badge'
];

const normalizeDiscountPresetsForUi = (presets = []) => {
    if (!Array.isArray(presets)) return [];
    return presets.map((preset, index) => ({
        id: String(preset?.id || `preset_${index + 1}`),
        name: String(preset?.name || '').trim(),
        rate: Number(preset?.rate || 0),
        icon: String(preset?.icon || 'local_offer').trim() || 'local_offer'
    })).filter((preset) => preset.name);
};

export default function PosSettings() {
    const { alert: showAlert } = useConfirm();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(TABS.SECURITY);

    const [status, setStatus] = useState({ hasVoidPin: false, hasReturnPin: false });
    const [voidPin, setVoidPin] = useState('');
    const [returnPin, setReturnPin] = useState('');
    const [clearVoidPin, setClearVoidPin] = useState(false);
    const [clearReturnPin, setClearReturnPin] = useState(false);
    const [receiptSettings, setReceiptSettings] = useState(DEFAULT_RECEIPT_SETTINGS);
    const [discountPresets, setDiscountPresets] = useState([]);
    const [discountDraft, setDiscountDraft] = useState({ name: '', rate: '', icon: 'local_offer' });
    const [loyaltyPointsRate, setLoyaltyPointsRate] = useState(0.1);
    
    const [promoDraft, setPromoDraft] = useState({
        code: '',
        type: 'PERCENTAGE',
        value: '',
        description: '',
        maxUses: '',
        expiryDate: '',
        scope: 'ORDER',
        productIds: '',
        categories: '',
        bogoBuyQty: 1,
        bogoGetQty: 1,
        bogoGetProductId: '',
        isGlobal: false
    });

    const authHeaders = () => undefined;

    const { data: posSettingsData, isLoading: loadingInfo } = useQuery({
        queryKey: ['adminPosSettings'],
        queryFn: async () => {
            const res = await axios.get(withApiBase('/api/pos/settings'), { headers: authHeaders() });
            return res.data;
        }
    });

    useEffect(() => {
        if (posSettingsData) {
            setStatus({
                hasVoidPin: Boolean(posSettingsData.hasVoidPin),
                hasReturnPin: Boolean(posSettingsData.hasReturnPin)
            });
            setReceiptSettings(prev => ({ ...prev, ...(posSettingsData.receiptSettings || {}) }));
            setDiscountPresets(normalizeDiscountPresetsForUi(posSettingsData.discountPresets));
            if (Number.isFinite(posSettingsData.loyaltyPointsRate)) {
                setLoyaltyPointsRate(posSettingsData.loyaltyPointsRate);
            }
        }
    }, [posSettingsData]);

    const { data: promoCodes = [], isLoading: promoLoading } = useQuery({
        queryKey: ['adminPromoCodes'],
        queryFn: async () => {
            const res = await axios.get(withApiBase('/api/pos/promo-codes'), { headers: authHeaders() });
            return res.data;
        }
    });


    const saveSettingsMutation = useMutation({
        mutationFn: async (payload) => {
            return axios.post(withApiBase('/api/pos/settings'), payload, { headers: authHeaders() });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminPosSettings'] });
        }
    });

    const handleSavePins = async (e) => {
        e.preventDefault();

        const payload = {};
        if (clearVoidPin) {
            payload.voidPin = '';
        } else if (voidPin) {
            if (String(voidPin).length < MIN_PIN_LENGTH) {
                await showAlert({ title: "Validation", message: `Void PIN must be at least ${MIN_PIN_LENGTH} digits.`, type: "warning" }); return;
            }
            payload.voidPin = voidPin;
        }

        if (clearReturnPin) {
            payload.returnPin = '';
        } else if (returnPin) {
            if (String(returnPin).length < MIN_PIN_LENGTH) {
                await showAlert({ title: "Validation", message: `Return PIN must be at least ${MIN_PIN_LENGTH} digits.`, type: "warning" }); return;
            }
            payload.returnPin = returnPin;
        }

        if (payload.voidPin === undefined && payload.returnPin === undefined) {
            await showAlert({ title: 'No Changes', message: 'Nothing to update.', type: 'info' }); return;
        }

        saveSettingsMutation.mutate(payload, {
            onSuccess: () => {
                setVoidPin('');
                setReturnPin('');
                setClearVoidPin(false);
                setClearReturnPin(false);
                showAlert({ title: 'Settings Saved', message: 'POS PIN settings updated.', type: 'success' });
            },
            onError: (e) => {
                showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update POS settings', type: 'danger' });
            }
        });
    };

    const handleSaveReceipt = async (e) => {
        e.preventDefault();

        if (!String(receiptSettings.invoiceTitle || '').trim()) {
            await showAlert({ title: 'Required', message: 'Receipt title is required.', type: 'warning' }); return;
        }
        if (!String(receiptSettings.businessName || '').trim()) {
            await showAlert({ title: 'Required', message: 'Business name is required for the receipt.', type: 'warning' }); return;
        }
        if (!String(receiptSettings.branchAddress || '').trim()) {
            await showAlert({ title: 'Required', message: 'Branch address is required for the receipt.', type: 'warning' }); return;
        }

        saveSettingsMutation.mutate({ receiptSettings }, {
            onSuccess: () => {
                showAlert({ title: 'Settings Saved', message: 'Receipt settings updated.', type: 'success' });
            },
            onError: (e) => {
                showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update receipt settings', type: 'danger' });
            }
        });
    };

    const updateReceiptField = (key, value) => {
        setReceiptSettings((prev) => ({ ...prev, [key]: value }));
    };

    const updateFinancialMapping = (method, label) => {
        setReceiptSettings((prev) => ({
            ...prev,
            financialMappings: {
                ...(prev.financialMappings || {}),
                [method]: label
            }
        }));
    };

    const handleAddDiscountPreset = async () => {
        const name = String(discountDraft.name || '').trim();
        const rate = Number(discountDraft.rate);
        const iconInput = String(discountDraft.icon || 'local_offer').trim();
        const icon = /^[a-z0-9_]+$/i.test(iconInput) ? iconInput : 'local_offer';

        if (!name) {
            await showAlert({ title: 'Required', message: 'Discount name is required.', type: 'warning' });
            return;
        }
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
            await showAlert({ title: 'Invalid Rate', message: 'Discount rate must be between 0 and 100.', type: 'warning' });
            return;
        }
        if (discountPresets.some((preset) => preset.name.toLowerCase() === name.toLowerCase())) {
            await showAlert({ title: 'Duplicate Name', message: 'A discount with this name already exists.', type: 'warning' });
            return;
        }

        setDiscountPresets((prev) => ([
            ...prev,
            {
                id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name,
                rate: Number(rate.toFixed(2)),
                icon
            }
        ]));
        setDiscountDraft({ name: '', rate: '', icon: 'local_offer' });
    };

    const updateDiscountPreset = (id, field, value) => {
        setDiscountPresets((prev) => prev.map((preset) => {
            if (preset.id !== id) return preset;
            if (field === 'rate') {
                const parsed = Number(value);
                return { ...preset, rate: Number.isFinite(parsed) ? parsed : 0 };
            }
            return { ...preset, [field]: value };
        }));
    };

    const removeDiscountPreset = (id) => {
        setDiscountPresets((prev) => prev.filter((preset) => preset.id !== id));
    };

    const handleSaveDiscountPresets = async () => {
        const normalizedPresets = discountPresets.map((preset) => ({
            id: String(preset.id || '').trim(),
            name: String(preset.name || '').trim(),
            rate: Number(preset.rate),
            icon: String(preset.icon || 'local_offer').trim() || 'local_offer'
        }));

        const hasInvalid = normalizedPresets.some((preset) =>
            !preset.name || !Number.isFinite(preset.rate) || preset.rate < 0 || preset.rate > 100
        );
        if (hasInvalid) {
            await showAlert({ title: 'Invalid Presets', message: 'Each discount must have a name and a rate between 0 and 100.', type: 'warning' });
            return;
        }

        const uniqueNames = new Set(normalizedPresets.map((preset) => preset.name.toLowerCase()));
        if (uniqueNames.size !== normalizedPresets.length) {
            await showAlert({ title: 'Duplicate Names', message: 'Discount names must be unique.', type: 'warning' });
            return;
        }

        saveSettingsMutation.mutate({
            discountPresets: normalizedPresets.map((preset) => ({
                ...preset,
                rate: Number(preset.rate.toFixed(2))
            }))
        }, {
            onSuccess: () => {
                showAlert({ title: 'Settings Saved', message: 'POS discount presets updated.', type: 'success' });
            },
            onError: (e) => {
                showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update discount presets', type: 'danger' });
            }
        });
    };

    const handleSaveLoyaltyRate = async () => {
        const rate = Number(loyaltyPointsRate);
        if (isNaN(rate) || rate < 0) {
            await showAlert({ title: 'Invalid Rate', message: 'Loyalty points rate must be a non-negative number.', type: 'warning' });
            return;
        }

        saveSettingsMutation.mutate({ loyaltyPointsRate: rate }, {
            onSuccess: () => {
                showAlert({ title: 'Settings Saved', message: 'Loyalty points rate updated.', type: 'success' });
            },
            onError: (e) => {
                showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update loyalty rate', type: 'danger' });
            }
        });
    };

    const promoMutation = useMutation({
        mutationFn: async ({ id, payload, action }) => {
            if (action === 'CREATE') {
                return axios.post(withApiBase('/api/pos/promo-codes'), payload, { headers: authHeaders() });
            } else if (action === 'TOGGLE') {
                return axios.put(withApiBase(`/api/pos/promo-codes/${id}`), payload, { headers: authHeaders() });
            } else if (action === 'DELETE') {
                return axios.delete(withApiBase(`/api/pos/promo-codes/${id}`), { headers: authHeaders() });
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminPromoCodes'] })
    });

    const handleCreatePromoCode = async (e) => {
        e.preventDefault();
        if (!promoDraft.code || !promoDraft.value) {
            await showAlert({ title: 'Validation', message: 'Code and Value are required.', type: 'warning' });
            return;
        }

        const payload = {
            ...promoDraft,
            productIds: promoDraft.scope === 'PRODUCT' ? promoDraft.productIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n)) : [],
            categories: promoDraft.scope === 'CATEGORY' ? promoDraft.categories.split(',').map(s => s.trim()).filter(Boolean) : [],
            bogoConfig: promoDraft.type === 'BOGO' ? {
                buyQty: parseInt(promoDraft.bogoBuyQty) || 1,
                getQty: parseInt(promoDraft.bogoGetQty) || 1,
                getProductId: promoDraft.bogoGetProductId ? Number(promoDraft.bogoGetProductId) : null
            } : null,
            gymId: promoDraft.isGlobal ? null : user?.gymId,
            tenantId: user?.tenantId
        };

        promoMutation.mutate({ payload, action: 'CREATE' }, {
            onSuccess: () => {
                setPromoDraft({ code: '', type: 'PERCENTAGE', value: '', description: '', maxUses: '', expiryDate: '', scope: 'ORDER', productIds: '', categories: '', bogoBuyQty: 1, bogoGetQty: 1, bogoGetProductId: '', isGlobal: false });
                showAlert({ title: 'Success', message: 'Promo code created successfully.', type: 'success' });
            },
            onError: (e) => {
                showAlert({ title: 'Error', message: e.response?.data?.error || 'Failed to create promo code', type: 'danger' });
            }
        });
    };

    const togglePromoStatus = async (promo) => {
        promoMutation.mutate({ id: promo.id, payload: { isActive: !promo.isActive }, action: 'TOGGLE' }, {
            onError: () => showAlert({ title: 'Error', message: 'Failed to update promo status', type: 'danger' })
        });
    };

    const deletePromoCode = async (id) => {
        const confirmed = await showAlert({
            title: 'Confirm Deletion',
            message: 'Are you sure you want to deactivate this promo code?',
            type: 'warning',
            confirmText: 'Yes, Deactivate'
        });
        if (!confirmed) return;

        promoMutation.mutate({ id, action: 'DELETE' }, {
            onError: () => showAlert({ title: 'Error', message: 'Failed to delete promo code', type: 'danger' })
        });
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
    const activePromoCount = useMemo(() => promoCodes.filter((promo) => promo.isActive).length, [promoCodes]);

    return (
        <div className="space-y-6 w-full">
            <header>
                <h1 className="text-3xl font-bold text-white">POS Settings</h1>
                <p className="text-text-muted mt-1">Configure POS security, receipt details, and discount presets.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-surface rounded-2xl border border-white/5 p-3 text-xs text-white">
                    Void PIN: <span className={status.hasVoidPin ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{status.hasVoidPin ? 'Configured' : 'Missing'}</span>
                </div>
                <div className="bg-surface rounded-2xl border border-white/5 p-3 text-xs text-white">
                    Return PIN: <span className={status.hasReturnPin ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{status.hasReturnPin ? 'Configured' : 'Missing'}</span>
                </div>
                <div className="bg-surface rounded-2xl border border-white/5 p-3 text-xs text-white">
                    Promo Codes: <span className="font-bold text-primary">{promoCodes.length}</span> ({activePromoCount} active)
                </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-surface p-2 shadow-sm">
                <div className="flex flex-wrap gap-2">
                    <TabButton
                        active={activeTab === TABS.SECURITY}
                        onClick={() => setActiveTab(TABS.SECURITY)}
                        label="Security"
                        icon="shield"
                    />
                    <TabButton
                        active={activeTab === TABS.RECEIPT}
                        onClick={() => setActiveTab(TABS.RECEIPT)}
                        label="Receipt"
                        icon="receipt_long"
                    />
                    <TabButton
                        active={activeTab === TABS.DISCOUNTS}
                        onClick={() => setActiveTab(TABS.DISCOUNTS)}
                        label="Discounts & Promos"
                        icon="local_offer"
                    />
                </div>
            </div>

            {activeTab === TABS.SECURITY && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <div className="space-y-4">
                        <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-sm">
                            <h3 className="text-base font-black uppercase tracking-wider text-white">Current PIN Status</h3>
                            <div className="mt-4 space-y-3">
                                <StatusCard label="Void PIN" enabled={status.hasVoidPin} />
                                <StatusCard label="Return PIN" enabled={status.hasReturnPin} />
                            </div>
                        </div>
                        <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-sm">
                            <h3 className="text-base font-black uppercase tracking-wider text-white">Guidelines</h3>
                            <div className="mt-3 space-y-2 text-sm text-text-muted">
                                <p>Use different PINs for void and return actions.</p>
                                <p>Set at least {MIN_PIN_LENGTH} digits to reduce unauthorized overrides.</p>
                                <p>Use the clear action only when rotating to a new PIN policy.</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-sm">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-xl font-black text-white">Update PINs</h3>
                                <p className="text-sm text-text-muted">Changes apply immediately for staff checkout actions.</p>
                            </div>
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                                Minimum {MIN_PIN_LENGTH} digits
                            </span>
                        </div>

                        <form onSubmit={handleSavePins} className="space-y-5">
                            <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/70 p-4">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">Void PIN</label>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        type="password"
                                        className="flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-white outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15"
                                    >
                                        Clear Void PIN
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/70 p-4">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">Return PIN</label>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        type="password"
                                        className="flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-white outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15"
                                    >
                                        Clear Return PIN
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end border-t border-white/10 pt-4">
                                <button
                                    type="submit"
                                    disabled={saveSettingsMutation.isPending}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-orange-600 disabled:opacity-50"
                                >
                                    <span className="material-icons-round text-base">{saveSettingsMutation.isPending ? 'sync' : 'save'}</span>
                                    {saveSettingsMutation.isPending ? 'Saving...' : 'Save PIN Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === TABS.RECEIPT && (
                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
                    <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-sm">
                        <h3 className="text-xl font-black text-white mb-1">Receipt Template</h3>
                        <p className="text-sm text-text-muted mb-6">Edit compliance text and display formatting used by printed and previewed receipts.</p>

                        <form onSubmit={handleSaveReceipt} className="space-y-5">
                            <p className="text-xs font-black uppercase tracking-widest text-text-muted">Gym Details</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Company ID" value={receiptSettings.companyId} onChange={(v) => updateReceiptField('companyId', v)} required />
                                <Field label="Business Name" value={receiptSettings.businessName} onChange={(v) => updateReceiptField('businessName', v)} required />
                            </div>
                            <Field label="Branch Address" value={receiptSettings.branchAddress} onChange={(v) => updateReceiptField('branchAddress', v)} required />
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <SelectField 
                                    label="Currency" 
                                    value={receiptSettings.currency} 
                                    onChange={(v) => updateReceiptField('currency', v)}
                                    options={[
                                        { value: 'PHP', label: 'PHP (₱)' },
                                        { value: 'SGD', label: 'SGD ($)' },
                                        { value: 'USD', label: 'USD ($)' }
                                    ]}
                                />
                                <SelectField 
                                    label="Locale" 
                                    value={receiptSettings.currencyLocale} 
                                    onChange={(v) => updateReceiptField('currencyLocale', v)}
                                    options={[
                                        { value: 'en-PH', label: 'English (PH)' },
                                        { value: 'en-SG', label: 'English (SG)' },
                                        { value: 'en-US', label: 'English (US)' }
                                    ]}
                                />
                                <SelectField 
                                    label="Rounding Rule" 
                                    value={receiptSettings.roundingRule} 
                                    onChange={(v) => updateReceiptField('roundingRule', v)}
                                    options={[
                                        { value: 'NONE', label: 'None' },
                                        { value: 'NEAREST_0_05', label: 'Nearest 0.05' },
                                        { value: 'NEAREST_0_10', label: 'Nearest 0.10' },
                                        { value: 'UP_TO_1_00', label: 'Always Round Up to 1.00' }
                                    ]}
                                />
                            </div>

                            <p className="text-xs font-black uppercase tracking-widest text-text-muted pt-2">Compliance (BIR)</p>
                            <Field label="Receipt Title" value={receiptSettings.invoiceTitle} onChange={(v) => updateReceiptField('invoiceTitle', v)} required />
                            <Field label="TIN (with branch code)" value={receiptSettings.tin} onChange={(v) => updateReceiptField('tin', v)} />

                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2 uppercase tracking-wider">VAT / Non-VAT Label</label>
                                <select
                                    className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={receiptSettings.vatType || 'VAT'}
                                    onChange={(e) => updateReceiptField('vatType', e.target.value)}
                                >
                                    <option value="VAT">VAT</option>
                                    <option value="NON-VAT">NON-VAT</option>
                                </select>
                            </div>

                            <p className="text-xs font-black uppercase tracking-widest text-text-muted pt-2">Body</p>
                            <Field label="Date/Time Label" value={receiptSettings.issuedDateLabel} onChange={(v) => updateReceiptField('issuedDateLabel', v)} placeholder="Date & Time Issued" />
                            <Field label="Invoice / Serial Prefix (optional)" value={receiptSettings.serialNo} onChange={(v) => updateReceiptField('serialNo', v)} placeholder="SI-" />
                            <Field label="VAT Reg TIN Line" value={receiptSettings.vatRegTin} onChange={(v) => updateReceiptField('vatRegTin', v)} placeholder="VAT REG TIN: 123-456-789-000" />

                            <p className="text-xs font-black uppercase tracking-widest text-text-muted pt-2">Footer</p>
                            <Field label="Permit To Use No." value={receiptSettings.permitToUseNo} onChange={(v) => updateReceiptField('permitToUseNo', v)} />
                            <Field label="BIR Accreditation No." value={receiptSettings.birAccreditationNo} onChange={(v) => updateReceiptField('birAccreditationNo', v)} />
                            <Field label="MIN No." value={receiptSettings.minNo} onChange={(v) => updateReceiptField('minNo', v)} />
                            <Field label="System Details" value={receiptSettings.systemDetails} onChange={(v) => updateReceiptField('systemDetails', v)} placeholder="POS Provider / Version / Terminal ID" />
                            <Field label="Accredited Printer" value={receiptSettings.printerName} onChange={(v) => updateReceiptField('printerName', v)} />
                            <Field label="Printer TIN" value={receiptSettings.printerTin} onChange={(v) => updateReceiptField('printerTin', v)} />

                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2 uppercase tracking-wider">Mandatory Disclaimer</label>
                                <textarea
                                    className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    rows={2}
                                    value={receiptSettings.mandatoryDisclaimer}
                                    onChange={(e) => updateReceiptField('mandatoryDisclaimer', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-2 uppercase tracking-wider">Thank You Message</label>
                                <textarea
                                    className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    rows={2}
                                    value={receiptSettings.thankYouMessage}
                                    onChange={(e) => updateReceiptField('thankYouMessage', e.target.value)}
                                />
                            </div>

                            <p className="text-xs font-black uppercase tracking-widest text-text-muted pt-2">Financial Institution Mappings</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-surfaceHighlight/60 p-4 rounded-2xl border border-white/10">
                                {Object.keys(DEFAULT_RECEIPT_SETTINGS.financialMappings).map((method) => (
                                    <div key={method}>
                                        <label className="block text-[10px] text-text-muted font-bold uppercase tracking-wide mb-1">{method.replaceAll('_', ' ')} Label</label>
                                        <input
                                            type="text"
                                            className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-primary outline-none"
                                            value={receiptSettings.financialMappings?.[method] || ''}
                                            onChange={(e) => updateFinancialMapping(method, e.target.value)}
                                            placeholder={`e.g., ${DEFAULT_RECEIPT_SETTINGS.financialMappings[method]}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end border-t border-white/10 pt-4">
                                <button
                                    type="submit"
                                    disabled={saveSettingsMutation.isPending}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                                >
                                    <span className="material-icons-round text-base">{saveSettingsMutation.isPending ? 'sync' : 'save'}</span>
                                    {saveSettingsMutation.isPending ? 'Saving...' : 'Save Receipt Settings'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-surface rounded-3xl border border-white/10 p-5 shadow-sm xl:sticky xl:top-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white">Live Receipt Preview</h3>
                            <span className="rounded-full border border-white/10 bg-surfaceHighlight px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                                Sample Transaction
                            </span>
                        </div>
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

            {activeTab === TABS.DISCOUNTS && (
                <div className="space-y-6">
                    <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-sm">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                            <span className="material-icons-round text-primary">local_offer</span>
                            Discount Presets
                            </h3>
                            <span className="rounded-full border border-white/10 bg-surfaceHighlight px-3 py-1 text-xs font-bold uppercase tracking-wider text-text-muted">
                                {discountPresets.length} preset(s)
                            </span>
                        </div>
                        <p className="text-text-muted text-sm mb-6">Create reusable discounts available during POS checkout.</p>

                        <div className="grid grid-cols-1 md:grid-cols-[160px,1fr,140px,auto] gap-3">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">{discountDraft.icon || 'local_offer'}</span>
                                <select
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={discountDraft.icon}
                                    onChange={(e) => setDiscountDraft((prev) => ({ ...prev, icon: e.target.value }))}
                                >
                                    {DISCOUNT_ICON_OPTIONS.map((icon) => (
                                        <option key={icon} value={icon}>{icon}</option>
                                    ))}
                                </select>
                            </div>
                            <input
                                type="text"
                                className="bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="Discount name (e.g., Senior Citizen)"
                                value={discountDraft.name}
                                onChange={(e) => setDiscountDraft((prev) => ({ ...prev, name: e.target.value }))}
                            />
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 pr-8 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="0.00"
                                    value={discountDraft.rate}
                                    onChange={(e) => setDiscountDraft((prev) => ({ ...prev, rate: e.target.value }))}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddDiscountPreset}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-white transition-colors hover:bg-white/15"
                            >
                                <span className="material-icons-round text-base">add_circle</span>
                                Add Preset
                            </button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-surface p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <h3 className="text-lg font-black text-white">Saved Presets</h3>
                            <span className="text-xs text-text-muted uppercase tracking-widest">Edit and save to apply</span>
                        </div>

                        {discountPresets.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/15 bg-surfaceHighlight/40 px-4 py-8 text-center text-sm text-text-muted">
                                No discount presets configured yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {discountPresets.map((preset) => (
                                    <div key={preset.id} className="grid grid-cols-1 md:grid-cols-[160px,1fr,140px,auto] gap-3 bg-surfaceHighlight/60 rounded-2xl border border-white/10 p-3">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">{preset.icon || 'local_offer'}</span>
                                            <select
                                                className="w-full bg-surface border border-white/10 rounded-xl pl-10 pr-3 py-2 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                value={preset.icon || 'local_offer'}
                                                onChange={(e) => updateDiscountPreset(preset.id, 'icon', e.target.value)}
                                            >
                                                {DISCOUNT_ICON_OPTIONS.map((icon) => (
                                                    <option key={icon} value={icon}>{icon}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <input
                                            type="text"
                                            className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            value={preset.name}
                                            onChange={(e) => updateDiscountPreset(preset.id, 'name', e.target.value)}
                                        />
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 pr-8 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                value={preset.rate}
                                                onChange={(e) => updateDiscountPreset(preset.id, 'rate', e.target.value)}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeDiscountPreset(preset.id)}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 font-bold hover:bg-red-500/20 transition-colors"
                                        >
                                            <span className="material-icons-round text-base">delete</span>
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end border-t border-white/10 pt-5">
                            <button
                                type="button"
                                onClick={handleSaveDiscountPresets}
                                disabled={saveSettingsMutation.isPending}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-orange-600 disabled:opacity-50"
                            >
                                <span className="material-icons-round text-base">{saveSettingsMutation.isPending ? 'sync' : 'save'}</span>
                                {saveSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-sm mt-6">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                                <span className="material-icons-round text-primary">stars</span>
                                Loyalty Configuration
                            </h3>
                        </div>
                        <p className="text-text-muted text-sm mb-6">Configure how many loyalty points members earn per currency unit spend.</p>
                        
                        <div className="max-w-md space-y-4">
                            <div className="rounded-2xl border border-white/10 bg-surfaceHighlight/70 p-4">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">Points per Currency Unit</label>
                                <div className="flex gap-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-white outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        placeholder="e.g., 0.1 for 1 point per 10 currency"
                                        value={loyaltyPointsRate}
                                        onChange={(e) => setLoyaltyPointsRate(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSaveLoyaltyRate}
                                        disabled={saveSettingsMutation.isPending}
                                        className="rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-orange-600 disabled:opacity-50"
                                    >
                                        Save
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-text-muted italic">
                                    Example: 0.1 means a member earns 10 points for a 100 PHP/SGD transaction.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-sm mt-6">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-xl font-black text-white flex items-center gap-2">
                                    <span className="material-icons-round text-primary">campaign</span>
                                    Global Promo Codes
                                </h3>
                                <p className="text-text-muted text-sm mt-1">Create reusable promo codes that can be applied across transactions.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">{activePromoCount} Active</span>
                                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-300">{Math.max(promoCodes.length - activePromoCount, 0)} Inactive</span>
                            </div>
                        </div>

                        <form onSubmit={handleCreatePromoCode} className="mb-8 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 rounded-2xl border border-white/10 bg-surfaceHighlight/70 p-4 shadow-inner">
                            <div className="md:col-span-1">
                                <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Code</label>
                                <input
                                    type="text"
                                    className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none uppercase"
                                    placeholder="SUMMER20"
                                    value={promoDraft.code}
                                    onChange={e => setPromoDraft(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Type</label>
                                <select
                                    className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                    value={promoDraft.type}
                                    onChange={e => setPromoDraft(p => ({ ...p, type: e.target.value }))}
                                >
                                    <option value="PERCENTAGE">% Percent</option>
                                    <option value="FLAT">Flat (PHP)</option>
                                    <option value="BOGO">Buy 1 Get 1</option>
                                </select>
                            </div>

                            {promoDraft.type !== 'BOGO' ? (
                                <div>
                                    <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Value</label>
                                    <input
                                        type="number"
                                        className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                        placeholder={promoDraft.type === 'FLAT' ? '100' : '20'}
                                        value={promoDraft.value}
                                        onChange={e => setPromoDraft(p => ({ ...p, value: e.target.value }))}
                                    />
                                </div>
                            ) : (
                                <div className="col-span-1 grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Buy Qty</label>
                                        <input
                                            type="number"
                                            className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                            placeholder="1"
                                            value={promoDraft.bogoBuyQty}
                                            onChange={e => setPromoDraft(p => ({ ...p, bogoBuyQty: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Get Qty</label>
                                        <input
                                            type="number"
                                            className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                            placeholder="1"
                                            value={promoDraft.bogoGetQty}
                                            onChange={e => setPromoDraft(p => ({ ...p, bogoGetQty: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Scope</label>
                                <select
                                    className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                    value={promoDraft.scope}
                                    onChange={e => setPromoDraft(p => ({ ...p, scope: e.target.value }))}
                                >
                                    <option value="ORDER">Entire Order</option>
                                    <option value="PRODUCT">Specific Products</option>
                                    <option value="CATEGORY">Specific Categories</option>
                                </select>
                            </div>

                            {promoDraft.scope === 'PRODUCT' && (
                                <div>
                                    <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Product IDs (comma separated)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                        placeholder="1, 2, 3"
                                        value={promoDraft.productIds}
                                        onChange={e => setPromoDraft(p => ({ ...p, productIds: e.target.value }))}
                                    />
                                </div>
                            )}

                            {promoDraft.scope === 'CATEGORY' && (
                                <div>
                                    <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Categories (comma separated)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                        placeholder="Merchandise, Supplements"
                                        value={promoDraft.categories}
                                        onChange={e => setPromoDraft(p => ({ ...p, categories: e.target.value }))}
                                    />
                                </div>
                            )}

                            <div className={promoDraft.scope === 'ORDER' ? 'xl:col-span-2 grid grid-cols-2 gap-3' : 'xl:col-span-6 grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 mt-3 border-t border-white/5'}>
                                <div>
                                    <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Max Uses</label>
                                    <input
                                        type="number"
                                        className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none"
                                        placeholder="Unlimited"
                                        value={promoDraft.maxUses}
                                        onChange={e => setPromoDraft(p => ({ ...p, maxUses: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Expiry Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:border-primary outline-none [color-scheme:dark]"
                                        value={promoDraft.expiryDate}
                                        onChange={e => setPromoDraft(p => ({ ...p, expiryDate: e.target.value }))}
                                    />
                                </div>
                                <div className="flex items-center gap-2 h-full pt-4">
                                    <label className="flex items-center cursor-pointer gap-2 group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={promoDraft.isGlobal}
                                                onChange={e => setPromoDraft(p => ({ ...p, isGlobal: e.target.checked }))}
                                            />
                                            <div className={`w-10 h-5 rounded-full transition-colors ${promoDraft.isGlobal ? 'bg-primary' : 'bg-white/10'}`}></div>
                                            <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${promoDraft.isGlobal ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                        <span className="text-[10px] text-text-muted font-bold uppercase group-hover:text-primary transition-colors">All Branches</span>
                                    </label>
                                </div>
                                <div className={`flex items-end ${promoDraft.scope !== 'ORDER' ? 'lg:col-start-4' : ''}`}>
                                    <button
                                        type="submit"
                                        disabled={promoMutation.isPending}
                                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
                                    >
                                        {promoMutation.isPending ? 'Saving...' : 'Create Promo Code'}
                                    </button>
                                </div>
                            </div>
                        </form>

                        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surfaceHighlight/40">
                            <table className="w-full text-left">
                                <thead className="border-b border-white/10 bg-surfaceHighlight/80 text-[10px] text-text-muted uppercase font-bold tracking-wide">
                                    <tr>
                                        <th className="px-3 py-3">Code</th>
                                        <th className="py-3">Value</th>
                                        <th className="py-3">Uses</th>
                                        <th className="py-3">Expiry</th>
                                        <th className="py-3">Status</th>
                                        <th className="py-3 pr-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {promoLoading ? (
                                        <tr>
                                            <td colSpan="6" className="px-3 py-8 text-center text-text-muted">Loading promo codes...</td>
                                        </tr>
                                    ) : promoCodes.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-3 py-8 text-center text-text-muted">No global promo codes found.</td>
                                        </tr>
                                    ) : (
                                        promoCodes.map(promo => (
                                            <tr key={promo.id} className="border-b border-white/5 group hover:bg-white/5 transition-colors">
                                                <td className="px-3 py-4">
                                                    <span className="font-mono font-bold text-primary">{promo.code}</span>
                                                    {promo.gymId === null && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary uppercase">
                                                            Global
                                                        </span>
                                                    )}
                                                    {promo.scope !== 'ORDER' && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white">
                                                            Scope: {promo.scope}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 font-bold text-white">
                                                    {promo.type === 'FLAT' ? `PHP ${promo.value}` : promo.type === 'PERCENTAGE' ? `${promo.value}%` : `Buy ${promo.bogoConfig?.buyQty || 1} Get ${promo.bogoConfig?.getQty || 1}`}
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white">{promo.usedCount}</span>
                                                        <span className="text-text-muted">/</span>
                                                        <span className="text-text-muted">{promo.maxUses || 'Unlimited'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-text-muted">
                                                    {promo.expiryDate ? new Date(promo.expiryDate).toLocaleDateString() : 'Never'}
                                                </td>
                                                <td className="py-4">
                                                    <button 
                                                        onClick={() => togglePromoStatus(promo)}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${promo.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
                                                    >
                                                        {promo.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                    </button>
                                                </td>
                                                <td className="py-4 pr-3 text-right">
                                                    <button 
                                                        onClick={() => deletePromoCode(promo.id)}
                                                        className="rounded p-2 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                                                    >
                                                        <span className="material-icons-round text-lg">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

const TabButton = ({ active, label, onClick, icon }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-4 py-2 rounded-2xl text-sm font-bold transition-colors inline-flex items-center gap-2 ${active
            ? 'bg-primary text-white'
            : 'bg-surfaceHighlight text-text-muted hover:text-white hover:bg-white/10'
            }`}
    >
        {icon && <span className="material-icons-round text-base">{icon}</span>}
        {label}
    </button>
);

const Field = ({ label, value, onChange, placeholder, required = false }) => (
    <div>
        <label className="block text-xs text-text-secondary font-bold uppercase tracking-wider mb-2">{label}</label>
        <input
            type="text"
            className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={value || ''}
            placeholder={placeholder}
            required={required}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

const SelectField = ({ label, value, onChange, options }) => (
    <div>
        <label className="block text-xs text-text-secondary font-bold uppercase tracking-wider mb-2">{label}</label>
        <select
            className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
); 

const StatusCard = ({ label, enabled }) => (
    <div className="bg-surfaceHighlight/70 rounded-2xl border border-white/10 p-4 flex items-center justify-between">
        <div>
            <p className="text-xs uppercase tracking-widest text-text-muted font-bold">{label}</p>
            <p className="text-lg font-bold text-white mt-1">{enabled ? 'Configured' : 'Not Set'}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {enabled ? 'Active' : 'Inactive'}
        </span>
    </div>
);



