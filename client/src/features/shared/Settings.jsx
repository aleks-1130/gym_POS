import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { withApiBase } from '../../config/api';
import { useConfirm } from '../../context/ConfirmContext';

export default function Settings() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { settings, updateSettings } = useSettings();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const [activeTab, setActiveTab] = useState('plans');
    const isOwner = String(user?.role || '').toUpperCase() === 'OWNER';

    const [gymProfile, setGymProfile] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        // Operational settings
        currency: 'PHP',
        taxRate: 12.0,
        roundingRule: 'NONE',
        referencePrefix: '',
        companyId: ''
    });

    const [financialInstitutions, setFinancialInstitutions] = useState([]);
    const [instDraft, setInstDraft] = useState({ method: 'CASH', financialInstitutionId: '', label: '', isActive: true });

    const [plans, setPlans] = useState([]);
    const [planFormData, setPlanFormData] = useState({
        name: '',
        price: '',
        duration: '',
        freezeLimitCount: '',
        guestPassEnabled: false,
        guestPassLimitCount: '',
        includesClasses: false,
        includedClassSessions: '',
        isGlobal: false
    });

    const [sessionPackages, setSessionPackages] = useState([]);
    const [packageFormData, setPackageFormData] = useState({
        name: '',
        sessions: '',
        price: '',
        isActive: true,
        isGlobal: false
    });

    const [loadingPlan, setLoadingPlan] = useState(false);
    const [loadingPackage, setLoadingPackage] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [savingPlanId, setSavingPlanId] = useState(null);
    const [editPlanData, setEditPlanData] = useState({
        name: '',
        price: '',
        duration: '',
        freezeLimitCount: '',
        guestPassEnabled: false,
        guestPassLimitCount: '',
        includesClasses: false,
        includedClassSessions: '',
        isGlobal: false
    });

    useEffect(() => {
        if (settings) {
            setGymProfile({
                name: settings.name || '',
                address: settings.address || '',
                phone: settings.phone || '',
                email: settings.email || '',
                website: settings.website || '',
                currency: settings.currency || 'PHP',
                taxRate: settings.taxRate || 12.0,
                roundingRule: settings.roundingRule || 'NONE',
                referencePrefix: settings.referencePrefix || '',
                companyId: settings.companyId || ''
            });
        }
    }, [settings]);

    useEffect(() => {
        const fetchFinancialInstitutions = async () => {
            try {
                const res = await axios.get('/api/settings/financial-institutions');
                setFinancialInstitutions(res.data);
            } catch (error) {
                console.error("Failed to fetch institutions", error);
            }
        };
        fetchFinancialInstitutions();
    }, []);

    useEffect(() => {
        fetchPlans();
        fetchSessionPackages();
    }, []);

    useEffect(() => {
        if (!isOwner && activeTab === 'branding') {
            setActiveTab('plans');
        }
    }, [activeTab, isOwner]);

    const fetchPlans = async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans'));
            setPlans(res.data || []);
        } catch (error) {
            console.error('Failed to fetch plans', error);
        }
    };

    const fetchSessionPackages = async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans/class-session-packages'));
            setSessionPackages(res.data || []);
        } catch (error) {
            console.error('Failed to fetch class session packages', error);
        }
    };

    const handleDeletePlan = async (id) => {
        const confirmed = await showConfirm({ title: 'Delete Plan?', message: 'Are you sure you want to delete this plan?', confirmLabel: 'Delete', type: 'danger' });
        if (!confirmed) return;
        try {
            await axios.delete(withApiBase(`/api/plans/${id}`));
            fetchPlans();
        } catch (e) {
            await showAlert({ title: 'Delete Failed', message: e.response?.data?.error || 'Failed to delete plan', type: 'danger' });
        }
    };

    const handleStartEditPlan = (plan) => {
        setEditingPlanId(plan.id);
        setEditPlanData({
            name: plan.name || '',
            price: plan.price ?? '',
            duration: plan.duration ?? '',
            freezeLimitCount: plan.freezeLimitCount ?? 0,
            guestPassEnabled: Boolean(plan.guestPassEnabled) || Number(plan.guestPassLimitCount || 0) > 0,
            guestPassLimitCount: plan.guestPassLimitCount ?? 0,
            includesClasses: Boolean(plan.includesClasses),
            includedClassSessions: plan.includedClassSessions ?? '',
            isGlobal: plan.gymId === null
        });
    };

    const handleCancelEditPlan = () => {
        setEditingPlanId(null);
        setSavingPlanId(null);
        setEditPlanData({
            name: '',
            price: '',
            duration: '',
            freezeLimitCount: '',
            guestPassEnabled: false,
            guestPassLimitCount: '',
            includesClasses: false,
            includedClassSessions: '',
            isGlobal: false
        });
    };

    const handleUpdatePlan = async (planId) => {
        setSavingPlanId(planId);
        try {
            await axios.put(withApiBase(`/api/plans/${planId}`), {
                name: editPlanData.name,
                price: Number(editPlanData.price),
                duration: Number(editPlanData.duration),
                freezeLimitCount: Number(editPlanData.freezeLimitCount || 0),
                includesClasses: editPlanData.includesClasses,
                includedClassSessions: editPlanData.includesClasses ? Number(editPlanData.includedClassSessions || 0) : 0,
                guestPassEnabled: editPlanData.guestPassEnabled,
                guestPassLimitCount: editPlanData.guestPassEnabled ? Number(editPlanData.guestPassLimitCount || 0) : 0,
                isGlobal: editPlanData.isGlobal
            });
            handleCancelEditPlan();
            fetchPlans();
        } catch (e) {
            await showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update plan', type: 'danger' });
        } finally {
            setSavingPlanId(null);
        }
    };


    const handleCreatePlan = async (e) => {
        e.preventDefault();
        setLoadingPlan(true);
        try {
            await axios.post(withApiBase('/api/plans'), {
                name: planFormData.name,
                price: Number(planFormData.price),
                duration: Number(planFormData.duration),
                freezeLimitCount: Number(planFormData.freezeLimitCount || 0),
                includesClasses: planFormData.includesClasses,
                includedClassSessions: planFormData.includesClasses ? Number(planFormData.includedClassSessions || 0) : 0,
                guestPassEnabled: planFormData.guestPassEnabled,
                guestPassLimitCount: planFormData.guestPassEnabled ? Number(planFormData.guestPassLimitCount || 0) : 0,
                isGlobal: planFormData.isGlobal
            });
            setPlanFormData({
                name: '',
                price: '',
                duration: '',
                freezeLimitCount: '',
                guestPassEnabled: false,
                guestPassLimitCount: '',
                includesClasses: false,
                includedClassSessions: '',
                isGlobal: false
            });
            fetchPlans();
        } catch (e) {
            await showAlert({ title: 'Create Failed', message: e.response?.data?.error || 'Failed to create plan', type: 'danger' });
        } finally {
            setLoadingPlan(false);
        }
    };

    const handleAddInstitution = () => {
        if (!instDraft.financialInstitutionId || !instDraft.label) return;
        setFinancialInstitutions([...financialInstitutions, { ...instDraft, id: `temp-${Date.now()}` }]);
        setInstDraft({ method: 'CASH', financialInstitutionId: '', label: '', isActive: true });
    };

    const handleRemoveInstitution = (id) => {
        setFinancialInstitutions(financialInstitutions.filter(i => i.id !== id));
    };

    const handleSaveInstitutions = async () => {
        try {
            const res = await axios.post('/api/settings/financial-institutions', { institutions: financialInstitutions });
            setFinancialInstitutions(res.data);
            await showAlert({ title: "Success", message: "Mappings updated", type: "success" });
        } catch (error) {
            console.error("Failed to save institutions", error);
            await showAlert({ title: 'Update Failed', message: error.response?.data?.error || 'Failed to update branding.', type: 'danger' });
        }
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        const success = await updateSettings(gymProfile);
        if (success) {
            await showAlert({ title: 'Branding Updated', message: 'Gym Branding Updated Successfully!', type: 'success' });
        } else {
            await showAlert({ title: 'Update Failed', message: 'Failed to update branding.', type: 'danger' });
        }
    };

    const handleCreatePackage = async (e) => {
        e.preventDefault();
        setLoadingPackage(true);
        try {
            await axios.post(withApiBase('/api/plans/class-session-packages'), {
                name: packageFormData.name,
                sessions: Number(packageFormData.sessions),
                price: Number(packageFormData.price),
                isActive: packageFormData.isActive,
                isGlobal: packageFormData.isGlobal
            });
            setPackageFormData({ name: '', sessions: '', price: '', isActive: true, isGlobal: false });
            fetchSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Create Failed', message: e.response?.data?.error || 'Failed to create package', type: 'danger' });
        } finally {
            setLoadingPackage(false);
        }
    };

    const handleTogglePackage = async (item) => {
        try {
            await axios.put(withApiBase(`/api/plans/class-session-packages/${item.id}`), {
                name: item.name,
                sessions: item.sessions,
                price: item.price,
                isActive: !item.isActive
            });
            fetchSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update package', type: 'danger' });
        }
    };

    const handleDeletePackage = async (id) => {
        const confirmed2 = await showConfirm({ title: 'Delete Package?', message: 'Delete this class session package?', confirmLabel: 'Delete', type: 'danger' });
        if (!confirmed2) return;
        try {
            await axios.delete(withApiBase(`/api/plans/class-session-packages/${id}`));
            fetchSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Delete Failed', message: e.response?.data?.error || 'Failed to delete package', type: 'danger' });
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-white">System Settings</h1>
                <p className="text-text-muted mt-1">
                    {isOwner
                        ? 'Manage membership plans, class session packages, and branding'
                        : 'Manage membership plans and class session packages'}
                </p>
            </header>

            <div className="flex gap-4 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('plans')}
                    className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'plans' ? 'text-primary' : 'text-text-muted hover:text-white'}`}
                >
                    Membership & Class Inclusion
                    {activeTab === 'plans' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('packages')}
                    className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'packages' ? 'text-primary' : 'text-text-muted hover:text-white'}`}
                >
                    Class Session Packages
                    {activeTab === 'packages' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
                </button>
                {isOwner && (
                    <>
                        <button
                            onClick={() => setActiveTab('branding')}
                            className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'branding' ? 'text-primary' : 'text-text-muted hover:text-white'}`}
                        >
                            Branch Profile
                            {activeTab === 'branding' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTab('branch_settings')}
                            className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'branch_settings' ? 'text-primary' : 'text-text-muted hover:text-white'}`}
                        >
                            Branch Settings
                            {activeTab === 'branch_settings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
                        </button>
                    </>
                )}
            </div>

            {activeTab === 'plans' && (
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Active Plans</h3>
                        <div className="space-y-3">
                            {plans.map(plan => (
                                <div key={plan.id} className="p-4 bg-surfaceHighlight rounded-2xl border border-white/5">
                                    {editingPlanId === plan.id ? (
                                        <div className="space-y-3">
                                            <input
                                                className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                value={editPlanData.name}
                                                onChange={e => setEditPlanData({ ...editPlanData, name: e.target.value })}
                                                placeholder="Plan name"
                                            />
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                    value={editPlanData.price}
                                                    onChange={e => setEditPlanData({ ...editPlanData, price: e.target.value })}
                                                    placeholder="Price"
                                                />
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                    value={editPlanData.duration}
                                                    onChange={e => setEditPlanData({ ...editPlanData, duration: e.target.value })}
                                                    placeholder="Duration"
                                                />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                    value={editPlanData.freezeLimitCount}
                                                    onChange={e => setEditPlanData({ ...editPlanData, freezeLimitCount: e.target.value })}
                                                    placeholder="Freeze Count"
                                                />
                                            </div>
                                            <label className="flex items-center gap-2 text-xs text-white">
                                                <input
                                                    type="checkbox"
                                                    checked={editPlanData.includesClasses}
                                                    onChange={e => setEditPlanData({
                                                        ...editPlanData,
                                                        includesClasses: e.target.checked,
                                                        includedClassSessions: e.target.checked ? editPlanData.includedClassSessions : ''
                                                    })}
                                                    className="accent-primary"
                                                />
                                                Include class sessions
                                            </label>
                                            {editPlanData.includesClasses && (
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                    value={editPlanData.includedClassSessions}
                                                    onChange={e => setEditPlanData({ ...editPlanData, includedClassSessions: e.target.value })}
                                                    placeholder="Included class sessions"
                                                />
                                            )}
                                            <label className="flex items-center gap-2 text-xs text-white">
                                                <input
                                                    type="checkbox"
                                                    checked={editPlanData.guestPassEnabled}
                                                    onChange={e => setEditPlanData({
                                                        ...editPlanData,
                                                        guestPassEnabled: e.target.checked,
                                                        guestPassLimitCount: e.target.checked ? editPlanData.guestPassLimitCount : ''
                                                    })}
                                                    className="accent-primary"
                                                />
                                                Enable guest pass allowance
                                            </label>
                                            {editPlanData.guestPassEnabled && (
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                    value={editPlanData.guestPassLimitCount}
                                                    onChange={e => setEditPlanData({ ...editPlanData, guestPassLimitCount: e.target.value })}
                                                    placeholder="Guest pass count"
                                                />
                                            )}
                                            {isOwner && (
                                                <div className="flex items-center gap-3 bg-background/40 border border-white/10 rounded-xl px-3 py-2">
                                                    <label className="relative flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editPlanData.isGlobal}
                                                            onChange={(e) => setEditPlanData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                                        <span className="ms-3 text-xs font-medium text-white">Global Plan</span>
                                                    </label>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={handleCancelEditPlan}
                                                    className="px-3 py-2 text-xs rounded-lg bg-white/10 text-white hover:bg-white/20"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleUpdatePlan(plan.id)}
                                                    disabled={savingPlanId === plan.id}
                                                    className="px-3 py-2 text-xs rounded-lg bg-primary text-white hover:bg-orange-600 disabled:opacity-50"
                                                >
                                                    {savingPlanId === plan.id ? 'Saving...' : 'Save'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h4 className="text-white font-bold">{plan.name}</h4>
                                                <p className="text-sm text-text-muted font-medium">
                                                    {plan.duration} days • <span className="text-primary font-bold">{formatPrice(plan.price)}</span>
                                                </p>
                                                <p className="text-xs mt-1 text-text-muted">
                                                    {plan.includesClasses
                                                        ? `Includes ${plan.includedClassSessions} class sessions`
                                                        : 'No class sessions included'}
                                                </p>
                                                <p className="text-xs mt-1 text-blue-300/90">
                                                    {Number(plan.freezeLimitCount || 0) > 0
                                                        ? `Freeze allowed: ${plan.freezeLimitCount} time${Number(plan.freezeLimitCount) > 1 ? 's' : ''}`
                                                        : 'Freeze not included'}
                                                </p>
                                                <p className="text-xs mt-1 text-emerald-300/90">
                                                    {(Boolean(plan.guestPassEnabled) || Number(plan.guestPassLimitCount || 0) > 0)
                                                        ? `Guest pass allowed: ${Number(plan.guestPassLimitCount || 0)} time${Number(plan.guestPassLimitCount || 0) > 1 ? 's' : ''}`
                                                        : 'Guest pass not included'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleStartEditPlan(plan)} className="text-text-muted hover:text-white p-2 transition-colors" title="Edit plan">
                                                    <span className="material-icons-round">edit</span>
                                                </button>
                                                <button onClick={() => handleDeletePlan(plan.id)} className="text-text-muted hover:text-red-400 p-2 transition-colors" title="Delete plan">
                                                    <span className="material-icons-round">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {plans.length === 0 && <p className="text-text-muted text-sm">No plans found.</p>}
                        </div>
                    </div>

                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm h-fit">
                        <h3 className="text-xl font-bold text-white mb-4">Create New Plan</h3>
                        <form onSubmit={handleCreatePlan} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Plan Name</label>
                                <input
                                    required
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                    placeholder="e.g. Platinum Yearly"
                                    value={planFormData.name}
                                    onChange={e => setPlanFormData({ ...planFormData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Price</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                        placeholder="99.99"
                                        value={planFormData.price}
                                        onChange={e => setPlanFormData({ ...planFormData, price: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Duration (Days)</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                        placeholder="30"
                                        value={planFormData.duration}
                                        onChange={e => setPlanFormData({ ...planFormData, duration: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Freeze Count</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                        placeholder="0"
                                        value={planFormData.freezeLimitCount}
                                        onChange={e => setPlanFormData({ ...planFormData, freezeLimitCount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={planFormData.includesClasses}
                                    onChange={e => setPlanFormData({ ...planFormData, includesClasses: e.target.checked, includedClassSessions: e.target.checked ? planFormData.includedClassSessions : '' })}
                                    className="accent-primary"
                                />
                                <span className="text-sm text-white font-medium">Include group class sessions in this plan</span>
                            </label>

                            {planFormData.includesClasses && (
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Included Class Sessions</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                        placeholder="8"
                                        value={planFormData.includedClassSessions}
                                        onChange={e => setPlanFormData({ ...planFormData, includedClassSessions: e.target.value })}
                                    />
                                </div>
                            )}

                            <label className="flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={planFormData.guestPassEnabled}
                                    onChange={e => setPlanFormData({
                                        ...planFormData,
                                        guestPassEnabled: e.target.checked,
                                        guestPassLimitCount: e.target.checked ? planFormData.guestPassLimitCount : ''
                                    })}
                                    className="accent-primary"
                                />
                                <span className="text-sm text-white font-medium">Enable guest pass for this plan</span>
                            </label>

                            {planFormData.guestPassEnabled && (
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Guest Pass Count</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                        placeholder="2"
                                        value={planFormData.guestPassLimitCount}
                                        onChange={e => setPlanFormData({ ...planFormData, guestPassLimitCount: e.target.value })}
                                    />
                                </div>
                            )}

                            {isOwner && (
                                <div className="flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3">
                                    <label className="relative flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={planFormData.isGlobal}
                                            onChange={(e) => setPlanFormData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        <span className="ms-3 text-sm font-medium text-white">Global Plan</span>
                                    </label>
                                    <span className="material-icons-round text-text-muted text-sm" title="Global plans are shared across all branches.">help_outline</span>
                                </div>
                            )}

                            <button disabled={loadingPlan} type="submit" className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                                {loadingPlan ? 'Creating...' : 'Create Plan'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'packages' && (
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Class Session Packages</h3>
                        <div className="space-y-3">
                            {sessionPackages.map(item => (
                                <div key={item.id} className="p-4 bg-surfaceHighlight rounded-2xl border border-white/5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-white font-bold">{item.name}</h4>
                                            <p className="text-sm text-text-muted">{item.sessions} sessions • <span className="text-primary font-bold">{formatPrice(item.price)}</span></p>
                                            <p className={`text-xs mt-1 ${item.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {item.isActive ? 'Active' : 'Inactive'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleTogglePackage(item)} className="text-xs px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
                                                {item.isActive ? 'Disable' : 'Enable'}
                                            </button>
                                            <button onClick={() => handleDeletePackage(item.id)} className="text-text-muted hover:text-red-400 p-2 transition-colors">
                                                <span className="material-icons-round">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {sessionPackages.length === 0 && <p className="text-text-muted text-sm">No class session packages found.</p>}
                        </div>
                    </div>

                    <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm h-fit">
                        <h3 className="text-xl font-bold text-white mb-4">Create Class Session Package</h3>
                        <form onSubmit={handleCreatePackage} className="space-y-4">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Package Name</label>
                                <input
                                    required
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                    placeholder="e.g. 10 Session Class Pack"
                                    value={packageFormData.name}
                                    onChange={e => setPackageFormData({ ...packageFormData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Sessions</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                        placeholder="10"
                                        value={packageFormData.sessions}
                                        onChange={e => setPackageFormData({ ...packageFormData, sessions: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-text-secondary font-bold mb-1">Price</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                        placeholder="500"
                                        value={packageFormData.price}
                                        onChange={e => setPackageFormData({ ...packageFormData, price: e.target.value })}
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={packageFormData.isActive}
                                    onChange={e => setPackageFormData({ ...packageFormData, isActive: e.target.checked })}
                                    className="accent-primary"
                                />
                                <span className="text-sm text-white font-medium">Available for sale</span>
                            </label>
                            
                            <div className="flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3">
                                <label className="relative flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={packageFormData.isGlobal}
                                        onChange={(e) => setPackageFormData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    <span className="ms-3 text-sm font-medium text-white">Global Package</span>
                                </label>
                                <span className="material-icons-round text-text-muted text-sm" title="Global packages are shared across all branches.">help_outline</span>
                            </div>

                            <button disabled={loadingPackage} type="submit" className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                                {loadingPackage ? 'Creating...' : 'Create Package'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isOwner && activeTab === 'branding' && (
                <div className="bg-surface rounded-3xl border border-white/5 p-8 shadow-sm max-w-2xl">
                    <h3 className="text-xl font-bold text-white mb-6">Branch Profile</h3>
                    <form onSubmit={handleProfileSave} className="space-y-6">
                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-1">Gym Name</label>
                            <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white" value={gymProfile.name} onChange={e => setGymProfile({ ...gymProfile, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-1">Address</label>
                            <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white" value={gymProfile.address} onChange={e => setGymProfile({ ...gymProfile, address: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Phone</label>
                                <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white" value={gymProfile.phone} onChange={e => setGymProfile({ ...gymProfile, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Website</label>
                                <input className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white" value={gymProfile.website} onChange={e => setGymProfile({ ...gymProfile, website: e.target.value })} />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button type="submit" className="bg-white text-black font-bold px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors shadow-lg">
                                Save Profile
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isOwner && activeTab === 'branch_settings' && (
                <div className="bg-surface rounded-3xl border border-white/5 p-8 shadow-sm max-w-2xl">
                    <h3 className="text-xl font-bold text-white mb-6">Branch Operations</h3>
                    <form onSubmit={handleProfileSave} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Currency</label>
                                <select 
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                    value={gymProfile.currency}
                                    onChange={e => setGymProfile({ ...gymProfile, currency: e.target.value })}
                                >
                                    <option value="PHP">Philippine Peso (PHP)</option>
                                    <option value="SGD">Singapore Dollar (SGD)</option>
                                    <option value="USD">US Dollar (USD)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Tax Rate (%)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white" 
                                    value={gymProfile.taxRate} 
                                    onChange={e => setGymProfile({ ...gymProfile, taxRate: e.target.value })} 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Rounding Rule</label>
                                <select 
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white"
                                    value={gymProfile.roundingRule}
                                    onChange={e => setGymProfile({ ...gymProfile, roundingRule: e.target.value })}
                                >
                                    <option value="NONE">None</option>
                                    <option value="NEAREST_005">Nearest 0.05</option>
                                    <option value="NEAREST_01">Nearest 0.10</option>
                                    <option value="NEAREST_1">Nearest 1.00</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-text-secondary font-bold mb-1">Reference Prefix</label>
                                <input 
                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white" 
                                    value={gymProfile.referencePrefix} 
                                    onChange={e => setGymProfile({ ...gymProfile, referencePrefix: e.target.value })} 
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-text-secondary font-bold mb-1">Company ID (Receipts)</label>
                            <input 
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white" 
                                value={gymProfile.companyId} 
                                onChange={e => setGymProfile({ ...gymProfile, companyId: e.target.value })} 
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button type="submit" className="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-600 transition-colors shadow-lg">
                                Save Settings
                            </button>
                        </div>
                    </form>

                    <div className="mt-12 pt-8 border-t border-white/5">
                        <h3 className="text-xl font-bold text-white mb-6">Internal Payment Mappings</h3>
                        <p className="text-sm text-text-muted mb-6">Map payment methods to internal institution identifiers for financial reports.</p>
                        
                        <div className="space-y-4">
                            {financialInstitutions.map((inst) => (
                                <div key={inst.id} className="flex items-center gap-4 bg-surfaceHighlight border border-white/10 p-4 rounded-xl">
                                    <div className="flex-1">
                                        <p className="text-xs text-text-muted font-bold uppercase">{inst.method}</p>
                                        <p className="text-white font-bold">{inst.label} <span className="text-text-muted font-normal">({inst.financialInstitutionId})</span></p>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveInstitution(inst.id)}
                                        className="text-red-400 hover:text-red-300 p-2"
                                    >
                                        <span className="material-icons-round">delete</span>
                                    </button>
                                </div>
                            ))}

                            <div className="grid grid-cols-3 gap-4 bg-white/5 p-4 rounded-xl">
                                <select 
                                    className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                    value={instDraft.method}
                                    onChange={e => setInstDraft({ ...instDraft, method: e.target.value })}
                                >
                                    <option value="CASH">CASH</option>
                                    <option value="CARD">CARD</option>
                                    <option value="GCASH">GCASH</option>
                                    <option value="MAYA">MAYA</option>
                                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                                </select>
                                <input 
                                    placeholder="Bank ID (e.g. 1023)"
                                    className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                    value={instDraft.financialInstitutionId}
                                    onChange={e => setInstDraft({ ...instDraft, financialInstitutionId: e.target.value })}
                                />
                                <input 
                                    placeholder="Label (e.g. BDO Savings)"
                                    className="bg-surfaceHighlight border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                    value={instDraft.label}
                                    onChange={e => setInstDraft({ ...instDraft, label: e.target.value })}
                                />
                                <div className="col-span-3 flex justify-end">
                                    <button 
                                        onClick={handleAddInstitution}
                                        className="text-white bg-white/10 hover:bg-white/20 font-bold px-4 py-2 rounded-lg text-sm"
                                    >
                                        Add Mapping
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button 
                                    onClick={handleSaveInstitutions}
                                    className="bg-white text-black font-bold px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors shadow-lg"
                                >
                                    Update Mappings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
        </div>
    );
}



