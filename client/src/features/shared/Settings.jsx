import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useSettings } from '../../context/SettingsContext';
import { withApiBase } from '../../config/api';

export default function Settings() {
    const { formatPrice } = useCurrency();
    const { settings, updateSettings } = useSettings();
    const [activeTab, setActiveTab] = useState('plans');

    const [gymProfile, setGymProfile] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        website: ''
    });

    const [plans, setPlans] = useState([]);
    const [planFormData, setPlanFormData] = useState({
        name: '',
        price: '',
        duration: '',
        includesClasses: false,
        includedClassSessions: ''
    });

    const [sessionPackages, setSessionPackages] = useState([]);
    const [packageFormData, setPackageFormData] = useState({
        name: '',
        sessions: '',
        price: '',
        isActive: true
    });

    const [loadingPlan, setLoadingPlan] = useState(false);
    const [loadingPackage, setLoadingPackage] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [savingPlanId, setSavingPlanId] = useState(null);
    const [editPlanData, setEditPlanData] = useState({
        name: '',
        price: '',
        duration: '',
        includesClasses: false,
        includedClassSessions: ''
    });

    useEffect(() => {
        if (settings) {
            setGymProfile({
                name: settings.name || '',
                address: settings.address || '',
                phone: settings.phone || '',
                email: settings.email || '',
                website: settings.website || ''
            });
        }
    }, [settings]);

    useEffect(() => {
        fetchPlans();
        fetchSessionPackages();
    }, []);

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
        if (!window.confirm('Are you sure you want to delete this plan?')) return;
        try {
            await axios.delete(withApiBase(`/api/plans/${id}`));
            fetchPlans();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to delete plan');
        }
    };

    const handleStartEditPlan = (plan) => {
        setEditingPlanId(plan.id);
        setEditPlanData({
            name: plan.name || '',
            price: plan.price ?? '',
            duration: plan.duration ?? '',
            includesClasses: Boolean(plan.includesClasses),
            includedClassSessions: plan.includedClassSessions ?? ''
        });
    };

    const handleCancelEditPlan = () => {
        setEditingPlanId(null);
        setSavingPlanId(null);
        setEditPlanData({
            name: '',
            price: '',
            duration: '',
            includesClasses: false,
            includedClassSessions: ''
        });
    };

    const handleUpdatePlan = async (planId) => {
        setSavingPlanId(planId);
        try {
            await axios.put(withApiBase(`/api/plans/${planId}`), {
                name: editPlanData.name,
                price: Number(editPlanData.price),
                duration: Number(editPlanData.duration),
                includesClasses: editPlanData.includesClasses,
                includedClassSessions: editPlanData.includesClasses ? Number(editPlanData.includedClassSessions || 0) : 0
            });
            handleCancelEditPlan();
            fetchPlans();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to update plan');
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
                includesClasses: planFormData.includesClasses,
                includedClassSessions: planFormData.includesClasses ? Number(planFormData.includedClassSessions || 0) : 0
            });
            setPlanFormData({
                name: '',
                price: '',
                duration: '',
                includesClasses: false,
                includedClassSessions: ''
            });
            fetchPlans();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to create plan');
        } finally {
            setLoadingPlan(false);
        }
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        const success = await updateSettings(gymProfile);
        if (success) {
            alert('Gym Branding Updated Successfully!');
        } else {
            alert('Failed to update branding.');
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
                isActive: packageFormData.isActive
            });
            setPackageFormData({ name: '', sessions: '', price: '', isActive: true });
            fetchSessionPackages();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to create package');
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
            alert(e.response?.data?.error || 'Failed to update package');
        }
    };

    const handleDeletePackage = async (id) => {
        if (!window.confirm('Delete this class session package?')) return;
        try {
            await axios.delete(withApiBase(`/api/plans/class-session-packages/${id}`));
            fetchSessionPackages();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to delete package');
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-white">System Settings</h1>
                <p className="text-text-muted mt-1">Manage membership plans, class session packages, and branding</p>
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
                <button
                    onClick={() => setActiveTab('branding')}
                    className={`pb-4 px-2 font-bold text-sm transition-colors relative ${activeTab === 'branding' ? 'text-primary' : 'text-text-muted hover:text-white'}`}
                >
                    Gym Branding
                    {activeTab === 'branding' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
                </button>
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
                                            <div className="grid grid-cols-2 gap-3">
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

                            <div className="grid grid-cols-2 gap-4">
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
                            <button disabled={loadingPackage} type="submit" className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                                {loadingPackage ? 'Creating...' : 'Create Package'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'branding' && (
                <div className="bg-surface rounded-3xl border border-white/5 p-8 shadow-sm max-w-2xl">
                    <h3 className="text-xl font-bold text-white mb-6">Business Profile</h3>
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
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

