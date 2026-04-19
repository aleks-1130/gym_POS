import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { withApiBase } from '../../config/api';
import { useConfirm } from '../../context/ConfirmContext';
import { PRODUCT_CATEGORIES } from '../../constants/categories';

export default function Settings() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { settings, updateSettings } = useSettings();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const [activeTab, setActiveTab] = useState('plans');
    const isAdminOrOwner = ['OWNER', 'ADMIN'].includes(String(user?.role || '').toUpperCase());
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
    const [classSessionPackages, setClassSessionPackages] = useState([]);
    const [products, setProducts] = useState([]);
    const [packageFormData, setPackageFormData] = useState({
        name: '',
        price: '',
        isActive: true,
        isGlobal: false,
        buckets: [{ type: 'CLASS', quantity: 1, referencePrice: 0, productId: '' }]
    });

    const [classPkgFormData, setClassPkgFormData] = useState({
        name: '',
        sessions: '',
        price: '',
        isActive: true,
        isGlobal: false
    });

    const [loadingPlan, setLoadingPlan] = useState(false);
    const [loadingPackage, setLoadingPackage] = useState(false);
    const [loadingClassPkg, setLoadingClassPkg] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [savingPlanId, setSavingPlanId] = useState(null);
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [editingClassPkgId, setEditingClassPkgId] = useState(null);
    const [savingPackageId, setSavingPackageId] = useState(null);
    const [savingClassPkgId, setSavingClassPkgId] = useState(null);

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

    const [editPackageData, setEditPackageData] = useState({
        name: '',
        price: '',
        isActive: true,
        isGlobal: false,
        buckets: []
    });

    const [editClassPkgData, setEditClassPkgData] = useState({
        name: '',
        sessions: '',
        price: '',
        isActive: true,
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
        if (!isAdminOrOwner) return;
        const fetchFinancialInstitutions = async () => {
            try {
                const res = await axios.get('/api/settings/financial-institutions');
                setFinancialInstitutions(res.data);
            } catch (error) {
                console.error("Failed to fetch institutions", error);
            }
        };
        fetchFinancialInstitutions();
    }, [isAdminOrOwner]);

    useEffect(() => {
        fetchPlans();
        fetchSessionPackages();
        fetchClassSessionPackages();
        fetchProducts();
    }, []);

    useEffect(() => {
        if (!isOwner && (activeTab === 'branding' || activeTab === 'branch_settings')) {
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
            const gymId = user?.gymId;
            const url = withApiBase(`/api/admin/service-bundles?gymId=${gymId || ''}`);
            console.log('[Settings] Fetching from URL:', url);
            const res = await axios.get(url);
            console.log('[Settings] Fetched Bundles:', res.data);
            setSessionPackages(res.data || []);
        } catch (error) {
            console.error('Failed to fetch service bundles', error);
        }
    };

    const fetchClassSessionPackages = async () => {
        try {
            const gymId = user?.gymId;
            const url = withApiBase(`/api/admin/class-packages?gymId=${gymId || ''}`);
            console.log('[Settings] Fetching Class Packages from URL:', url);
            const res = await axios.get(url);
            setClassSessionPackages(res.data || []);
        } catch (error) {
            console.error('Failed to fetch class packages', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get(withApiBase('/api/products'));
            setProducts(res.data || []);
        } catch (error) {
            console.error('Failed to fetch products', error);
        }
    };

    const categories = [...new Set([
        ...Object.values(PRODUCT_CATEGORIES),
        ...products.map(p => p.category).filter(Boolean)
    ])];

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
                isGlobal: editPlanData.isGlobal,
                gymId: user?.gymId
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
                isGlobal: planFormData.isGlobal,
                gymId: user?.gymId
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
        if (packageFormData.buckets.length === 0) {
            return showAlert({ title: "Error", message: "Bundle must have at least one item", type: "warning" });
        }
        setLoadingPackage(true);
        try {
            await axios.post(withApiBase('/api/admin/service-bundles'), {
                name: packageFormData.name,
                price: Number(packageFormData.price),
                isActive: packageFormData.isActive,
                isGlobal: packageFormData.isGlobal,
                buckets: packageFormData.buckets.map(b => ({
                    ...b,
                    quantity: Number(b.quantity),
                    referencePrice: Number(b.referencePrice),
                    productId: b.productId ? Number(b.productId) : null
                })),
                gymId: user?.gymId
            });
            setPackageFormData({
                name: '',
                price: '',
                isActive: true,
                isGlobal: false,
                buckets: [{ type: 'CLASS', quantity: 1, referencePrice: 0, productId: '' }]
            });
            fetchSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Create Failed', message: e.response?.data?.error || 'Failed to create bundle', type: 'danger' });
        } finally {
            setLoadingPackage(false);
        }
    };

    const handleCreateClassPkg = async (e) => {
        e.preventDefault();
        setLoadingClassPkg(true);
        try {
            await axios.post(withApiBase('/api/admin/class-packages'), {
                name: classPkgFormData.name,
                sessions: Number(classPkgFormData.sessions),
                price: Number(classPkgFormData.price),
                isActive: classPkgFormData.isActive,
                isGlobal: classPkgFormData.isGlobal,
                gymId: user?.gymId
            });
            setClassPkgFormData({
                name: '',
                sessions: '',
                price: '',
                isActive: true,
                isGlobal: false
            });
            fetchClassSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Create Failed', message: e.response?.data?.error || 'Failed to create class package', type: 'danger' });
        } finally {
            setLoadingClassPkg(false);
        }
    };

    const handleDeleteClassPkg = async (id) => {
        const confirmed = await showConfirm({ title: 'Delete Package?', message: 'Delete this class session package?', confirmLabel: 'Delete', type: 'danger' });
        if (!confirmed) return;
        try {
            await axios.delete(withApiBase(`/api/admin/class-packages/${id}`));
            fetchClassSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Delete Failed', message: e.response?.data?.error || 'Failed to delete package', type: 'danger' });
        }
    };

    const handleDeletePackage = async (id) => {
        const confirmed2 = await showConfirm({ title: 'Delete Bundle?', message: 'Delete this service bundle?', confirmLabel: 'Delete', type: 'danger' });
        if (!confirmed2) return;
        try {
            await axios.delete(withApiBase(`/api/admin/service-bundles/${id}`));
            fetchSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Delete Failed', message: e.response?.data?.error || 'Failed to delete bundle', type: 'danger' });
        }
    };

    // --- Edit Handlers for Service Bundles ---
    const handleStartEditPackage = (pkg) => {
        setEditingPackageId(pkg.id);
        setEditPackageData({
            name: pkg.name || '',
            price: pkg.price ?? '',
            isActive: pkg.isActive ?? true,
            isGlobal: !!pkg.isGlobal,
            buckets: (pkg.buckets || []).map(b => ({
                id: b.id,
                type: b.type,
                quantity: b.quantity,
                referencePrice: b.referencePrice,
                productId: b.productId || '',
                productCategory: b.productCategory || ''
            }))
        });
    };

    const handleCancelEditPackage = () => {
        setEditingPackageId(null);
        setSavingPackageId(null);
        setEditPackageData({ name: '', price: '', isActive: true, isGlobal: false, buckets: [] });
    };

    const handleUpdatePackage = async (id) => {
        if (editPackageData.buckets.length === 0) {
            return showAlert({ title: "Error", message: "Bundle must have at least one item", type: "warning" });
        }
        setSavingPackageId(id);
        try {
            await axios.put(withApiBase(`/api/admin/service-bundles/${id}`), {
                name: editPackageData.name,
                price: Number(editPackageData.price),
                isActive: editPackageData.isActive,
                isGlobal: editPackageData.isGlobal,
                buckets: editPackageData.buckets.map(b => ({
                    type: b.type,
                    quantity: Number(b.quantity),
                    referencePrice: Number(b.referencePrice),
                    productId: b.productId ? Number(b.productId) : null,
                    productCategory: b.productCategory || null
                })),
                gymId: user?.gymId
            });
            handleCancelEditPackage();
            fetchSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update bundle', type: 'danger' });
        } finally {
            setSavingPackageId(null);
        }
    };

    const updateEditBucketRow = (index, field, value) => {
        const newBuckets = [...editPackageData.buckets];
        newBuckets[index][field] = value;
        if (field === 'productId' && value) {
            const prod = products.find(p => p.id === Number(value));
            if (prod) {
                newBuckets[index].referencePrice = prod.price;
                newBuckets[index].productCategory = ''; // Clear category if specific product is picked
            }
        }
        if (field === 'productCategory' && value) {
            newBuckets[index].productId = ''; // Clear product if category is picked
        }
        setEditPackageData({ ...editPackageData, buckets: newBuckets });
    };

    const addEditBucketRow = () => {
        setEditPackageData({
            ...editPackageData,
            buckets: [...editPackageData.buckets, { type: 'CLASS', quantity: 1, referencePrice: 0, productId: '', productCategory: '' }]
        });
    };

    const removeEditBucketRow = (index) => {
        setEditPackageData({
            ...editPackageData,
            buckets: editPackageData.buckets.filter((_, i) => i !== index)
        });
    };

    // --- Edit Handlers for Class Packages ---
    const handleStartEditClassPkg = (pkg) => {
        setEditingClassPkgId(pkg.id);
        setEditClassPkgData({
            name: pkg.name || '',
            sessions: pkg.sessions ?? '',
            price: pkg.price ?? '',
            isActive: pkg.isActive ?? true,
            isGlobal: !!pkg.isGlobal
        });
    };

    const handleCancelEditClassPkg = () => {
        setEditingClassPkgId(null);
        setSavingClassPkgId(null);
        setEditClassPkgData({ name: '', sessions: '', price: '', isActive: true, isGlobal: false });
    };

    const handleUpdateClassPkg = async (id) => {
        setSavingClassPkgId(id);
        try {
            await axios.put(withApiBase(`/api/admin/class-packages/${id}`), {
                name: editClassPkgData.name,
                sessions: Number(editClassPkgData.sessions),
                price: Number(editClassPkgData.price),
                isActive: editClassPkgData.isActive,
                isGlobal: editClassPkgData.isGlobal,
                gymId: user?.gymId
            });
            handleCancelEditClassPkg();
            fetchClassSessionPackages();
        } catch (e) {
            await showAlert({ title: 'Update Failed', message: e.response?.data?.error || 'Failed to update package', type: 'danger' });
        } finally {
            setSavingClassPkgId(null);
        }
    };

    const addBucketRow = () => {
        setPackageFormData({
            ...packageFormData,
            buckets: [...packageFormData.buckets, { type: 'CLASS', quantity: 1, referencePrice: 0, productId: '', productCategory: '' }]
        });
    };

    const removeBucketRow = (index) => {
        setPackageFormData({
            ...packageFormData,
            buckets: packageFormData.buckets.filter((_, i) => i !== index)
        });
    };

    const updateBucketRow = (index, field, value) => {
        const newBuckets = [...packageFormData.buckets];
        newBuckets[index][field] = value;

        // Auto-fill reference price if product selected
        if (field === 'productId' && value) {
            const prod = products.find(p => p.id === Number(value));
            if (prod) {
                newBuckets[index].referencePrice = prod.price;
                // If product is selected, clear category as product takes precedence
                newBuckets[index].productCategory = '';
            }
        }
        
        if (field === 'productCategory' && value) {
            // If category is selected, clear specific product
            newBuckets[index].productId = '';
        }

        setPackageFormData({ ...packageFormData, buckets: newBuckets });
    };

    const totalRefPrice = packageFormData.buckets.reduce((sum, b) => sum + (Number(b.referencePrice) * Number(b.quantity)), 0);
    const savings = totalRefPrice - Number(packageFormData.price || 0);

    return (
        <div className="space-y-8 max-w-[110rem] mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-white">System Settings</h1>
                <p className="text-text-muted mt-1">
                    {isAdminOrOwner
                        ? 'Manage membership plans, service bundles, and branding'
                        : 'Manage membership plans and service bundles'}
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
                    Service Bundles
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
                                            {isAdminOrOwner && (
                                                <div className="flex items-center gap-3 bg-background/40 border border-white/10 rounded-xl px-3 py-2">
                                                    <label className="relative flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editPlanData.isGlobal}
                                                            onChange={(e) => setEditPlanData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="relative w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
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

                            {isAdminOrOwner && (
                                <div className="flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3">
                                    <label className="relative flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={planFormData.isGlobal}
                                            onChange={(e) => setPlanFormData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="relative w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
                <div className="space-y-12">
                    {/* SECTION 1: Class Session Packages (Pure Replenishment) */}
                    <section className="space-y-6">
                        <header className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                <span className="material-icons-round">confirmation_number</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">Class Session Packages</h2>
                                <p className="text-xs text-text-muted">Simple standalone replenishment packs (e.g., Hello Pack)</p>
                            </div>
                        </header>

                        <div className="grid lg:grid-cols-2 gap-8">
                            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm p-6">
                                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-text-muted">Active Packages</h3>
                                <div className="space-y-3">
                                    {classSessionPackages.map(pkg => (
                                        <div key={pkg.id} className="p-4 bg-surfaceHighlight rounded-2xl border border-white/5">
                                            {editingClassPkgId === pkg.id ? (
                                                <div className="space-y-3">
                                                    <input
                                                        className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                        value={editClassPkgData.name}
                                                        onChange={e => setEditClassPkgData({ ...editClassPkgData, name: e.target.value })}
                                                        placeholder="Package Name"
                                                    />
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <input
                                                            type="number"
                                                            className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                            value={editClassPkgData.sessions}
                                                            onChange={e => setEditClassPkgData({ ...editClassPkgData, sessions: e.target.value })}
                                                            placeholder="Sessions"
                                                        />
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                            value={editClassPkgData.price}
                                                            onChange={e => setEditClassPkgData({ ...editClassPkgData, price: e.target.value })}
                                                            placeholder="Price"
                                                        />
                                                    </div>                                                     {isAdminOrOwner && (
                                                         <label className="relative flex items-center cursor-pointer bg-background/40 border border-white/10 rounded-xl px-3 py-2">
                                                             <input
                                                                 type="checkbox"
                                                                 checked={editClassPkgData.isGlobal}
                                                                 onChange={(e) => setEditClassPkgData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                                                 className="sr-only peer"
                                                             />
                                                             <div className="relative w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                                             <span className="ms-3 text-xs font-medium text-white">Global Package</span>
                                                         </label>
                                                     )}
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={handleCancelEditClassPkg} className="px-3 py-2 text-xs rounded-lg bg-white/10 text-white hover:bg-white/20">Cancel</button>
                                                        <button onClick={() => handleUpdateClassPkg(pkg.id)} disabled={savingClassPkgId === pkg.id} className="px-3 py-2 text-xs rounded-lg bg-primary text-white hover:bg-orange-600 disabled:opacity-50">
                                                            {savingClassPkgId === pkg.id ? 'Saving...' : 'Save'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-white font-bold">{pkg.name}</h4>
                                                        <p className="text-sm text-blue-400 font-bold">{pkg.sessions} Sessions • {formatPrice(pkg.price)}</p>
                                                        {pkg.isGlobal && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold uppercase tracking-wider mt-1 inline-block">Global</span>}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleStartEditClassPkg(pkg)} className="p-2 text-text-muted hover:text-white transition-colors" title="Edit pack"><span className="material-icons-round text-sm">edit</span></button>
                                                        <button onClick={() => handleDeleteClassPkg(pkg.id)} className="p-2 text-text-muted hover:text-red-400 transition-colors" title="Delete pack"><span className="material-icons-round text-sm">delete</span></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {classSessionPackages.length === 0 && <p className="text-text-muted text-sm">No class packages found.</p>}
                                </div>
                            </div>

                            <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-text-muted">Create Class Package</h3>
                                <form onSubmit={handleCreateClassPkg} className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] text-text-muted font-bold mb-1 uppercase tracking-widest">Package Name</label>
                                        <input
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-400 outline-none"
                                            placeholder="e.g. Hello Pack (5 Sessions)"
                                            value={classPkgFormData.name}
                                            onChange={e => setClassPkgFormData({ ...classPkgFormData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-text-muted font-bold mb-1 uppercase tracking-widest">Sessions</label>
                                        <input
                                            required
                                            type="number"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-400 outline-none"
                                            value={classPkgFormData.sessions}
                                            onChange={e => setClassPkgFormData({ ...classPkgFormData, sessions: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-text-muted font-bold mb-1 uppercase tracking-widest">Price</label>
                                        <input
                                            required
                                            type="number"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-400 outline-none"
                                            value={classPkgFormData.price}
                                            onChange={e => setClassPkgFormData({ ...classPkgFormData, price: e.target.value })}
                                        />
                                    </div>
                                    {isAdminOrOwner && (
                                        <div className="col-span-2 flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3">
                                            <label className="relative flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={classPkgFormData.isGlobal}
                                                    onChange={(e) => setClassPkgFormData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="relative w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                <span className="ms-3 text-sm font-medium text-white">Global Package</span>
                                            </label>
                                            <span className="material-icons-round text-text-muted text-sm" title="Global packages are shared across all branches.">help_outline</span>
                                        </div>
                                    )}
                                    <button
                                        disabled={loadingClassPkg}
                                        type="submit"
                                        className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl transition-all shadow-lg text-sm"
                                    >
                                        {loadingClassPkg ? 'CREATING...' : 'CREATE CLASS PACKAGE'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2: Service Bundles (Multi-Service) */}
                    <section className="space-y-6">
                        <header className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-icons-round">inventory_2</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">Service Bundles</h2>
                                <p className="text-xs text-text-muted">Complex mixed-service offerings with bucket tracking</p>
                            </div>
                        </header>

                        <div className="grid lg:grid-cols-2 gap-8">
                            <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-sm p-6">
                                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-text-muted">Active Service Bundles</h3>
                                <div className="space-y-3">
                                    {sessionPackages.map(item => (
                                        <div key={item.id} className="p-4 bg-surfaceHighlight rounded-2xl border border-white/5">
                                            {editingPackageId === item.id ? (
                                                <div className="space-y-4">
                                                    <input
                                                        className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                        value={editPackageData.name}
                                                        onChange={e => setEditPackageData({ ...editPackageData, name: e.target.value })}
                                                        placeholder="Bundle Name"
                                                    />
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full bg-background/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                                        value={editPackageData.price}
                                                        onChange={e => setEditPackageData({ ...editPackageData, price: e.target.value })}
                                                        placeholder="Bundle Price"
                                                    />

                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Bundle Items</span>
                                                            <button onClick={addEditBucketRow} className="text-xs text-primary hover:underline font-bold">+ Add Item</button>
                                                        </div>
                                                        {editPackageData.buckets.map((bucket, idx) => (
                                                            <div key={idx} className="flex gap-2 items-start p-3 bg-background/40 rounded-xl border border-white/5">
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <select
                                                                            value={bucket.type}
                                                                            onChange={e => updateEditBucketRow(idx, 'type', e.target.value)}
                                                                            className="w-full bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                                                                        >
                                                                            <option value="CLASS">Group Class</option>
                                                                            <option value="TRAINING_SESSION">Training Session</option>
                                                                            <option value="PRODUCT">Product</option>
                                                                        </select>
                                                                        <input
                                                                            type="number"
                                                                            value={bucket.quantity}
                                                                            onChange={e => updateEditBucketRow(idx, 'quantity', e.target.value)}
                                                                            className="w-full bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                                                                            placeholder="Qty"
                                                                        />
                                                                    </div>
                                                                    {bucket.type === 'PRODUCT' && (
                                                                        <div className="space-y-3">
                                                                            <div>
                                                                                <label className="block text-[8px] text-text-muted uppercase mb-1">Specific Product</label>
                                                                                <select
                                                                                    className="w-full bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                                                                                    value={bucket.productId || ""}
                                                                                    onChange={e => updateEditBucketRow(idx, 'productId', e.target.value)}
                                                                                >
                                                                                    <option value="">Any / Use Category Instead</option>
                                                                                    {products.map(p => (
                                                                                        <option key={p.id} value={p.id}>
                                                                                            {p.name} ({formatPrice(p.price)})
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            {bucket.type === 'PRODUCT' && (
                                                                                <div>
                                                                                    <label className="block text-[8px] text-text-muted uppercase mb-1">OR Product Category (Dynamic per Gym)</label>
                                                                                    <select
                                                                                        className="w-full bg-background border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white"
                                                                                        value={bucket.productCategory || ''}
                                                                                        onChange={e => updateEditBucketRow(idx, 'productCategory', e.target.value)}
                                                                                    >
                                                                                        <option value="">-- Select Category --</option>
                                                                                        {categories.map(cat => (
                                                                                            <option key={cat} value={cat}>{cat}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] text-text-muted">Ref Price:</span>
                                                                        <input
                                                                            type="number"
                                                                            value={bucket.referencePrice}
                                                                            onChange={e => updateEditBucketRow(idx, 'referencePrice', e.target.value)}
                                                                            className="bg-transparent border-b border-white/10 text-xs text-white w-20 px-1"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => removeEditBucketRow(idx)} className="p-1 text-text-muted hover:text-red-400">
                                                                    <span className="material-icons-round text-sm">remove_circle_outline</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {isAdminOrOwner && (
                                                        <label className="relative flex items-center cursor-pointer bg-background/40 border border-white/10 rounded-xl px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={editPackageData.isGlobal}
                                                                onChange={(e) => setEditPackageData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="relative w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                                            <span className="ms-3 text-xs font-medium text-white">Global Bundle</span>
                                                        </label>
                                                    )}

                                                    <div className="flex justify-end gap-2 pt-2">
                                                        <button onClick={handleCancelEditPackage} className="px-3 py-2 text-xs rounded-lg bg-white/10 text-white hover:bg-white/20">Cancel</button>
                                                        <button onClick={() => handleUpdatePackage(item.id)} disabled={savingPackageId === item.id} className="px-3 py-2 text-xs rounded-lg bg-primary text-white hover:bg-orange-600 disabled:opacity-50">
                                                            {savingPackageId === item.id ? 'Saving...' : 'Save'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1">
                                                        <h4 className="text-white font-bold">{item.name}</h4>
                                                        <p className="text-sm text-primary font-bold">{formatPrice(item.price)}</p>
                                                        <div className="mt-2 space-y-1">
                                                            {item.buckets?.map((b, idx) => (
                                                                <div key={idx} className="flex items-center gap-2 text-xs text-text-muted">
                                                                    <span className="material-icons-round text-xs">
                                                                        {b.type === 'CLASS' ? 'groups' : b.type === 'TRAINING_SESSION' ? 'person' : 'shopping_bag'}
                                                                    </span>
                                                                    {b.quantity} {b.type.replace('_', ' ')}
                                                                    {b.product && <span className="text-blue-300">({b.product.name})</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {item.isGlobal && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold uppercase tracking-wider mt-2 inline-block">Global</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => handleStartEditPackage(item)} className="p-2 text-text-muted hover:text-white transition-colors" title="Edit bundle"><span className="material-icons-round text-sm">edit</span></button>
                                                        <button onClick={() => handleDeletePackage(item.id)} className="text-text-muted hover:text-red-400 p-2 transition-colors" title="Delete bundle"><span className="material-icons-round text-sm">delete</span></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {sessionPackages.length === 0 && <p className="text-text-muted text-sm">No service bundles found.</p>}
                                </div>
                            </div>

                            <div className="bg-surface rounded-3xl border border-white/5 p-6 shadow-sm h-fit">
                                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-text-muted">Create Service Bundle</h3>
                                <form onSubmit={handleCreatePackage} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] text-text-muted font-bold mb-1 uppercase tracking-widest">Bundle Name</label>
                                        <input
                                            required
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                            placeholder="e.g. Starter Pack Plus"
                                            value={packageFormData.name}
                                            onChange={e => setPackageFormData({ ...packageFormData, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Bundle Contents (Buckets)</label>
                                            <button
                                                type="button"
                                                onClick={addBucketRow}
                                                className="text-xs font-bold text-primary hover:text-orange-400 flex items-center gap-1"
                                            >
                                                <span className="material-icons-round text-sm">add</span>
                                                Add Item
                                            </button>
                                        </div>
                                        {packageFormData.buckets.map((bucket, index) => (
                                            <div key={index} className="p-4 bg-surfaceHighlight border border-white/5 rounded-2xl relative">
                                                <button
                                                    type="button"
                                                    onClick={() => removeBucketRow(index)}
                                                    className="absolute top-2 right-2 text-text-muted hover:text-red-400"
                                                >
                                                    <span className="material-icons-round text-sm">close</span>
                                                </button>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[10px] text-text-muted uppercase mb-1">Type</label>
                                                        <select
                                                            className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                                            value={bucket.type}
                                                            onChange={e => updateBucketRow(index, 'type', e.target.value)}
                                                        >
                                                            <option value="CLASS">Group Class</option>
                                                            <option value="TRAINING_SESSION">Training Session</option>
                                                            <option value="PRODUCT">Product</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-text-muted uppercase mb-1">Quantity</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                                            value={bucket.quantity}
                                                            onChange={e => updateBucketRow(index, 'quantity', e.target.value)}
                                                        />
                                                    </div>
                                                    {bucket.type === 'PRODUCT' && (
                                                        <div className="col-span-2 space-y-3">
                                                            <div>
                                                                <label className="block text-[10px] text-text-muted uppercase mb-1">Specific Product</label>
                                                                <select
                                                                    className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                                                    value={bucket.productId}
                                                                    onChange={e => updateBucketRow(index, 'productId', e.target.value)}
                                                                >
                                                                    <option value="">Any / Use Category Instead</option>
                                                                    {products.filter(p => !packageFormData.isGlobal || p.isGlobal).map(p => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.name} ({formatPrice(p.price)})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            {bucket.type === 'PRODUCT' && (
                                                                <div>
                                                                    <label className="block text-[10px] text-text-muted uppercase mb-1">OR Product Category (Dynamic per Gym)</label>
                                                                    <select
                                                                        className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                                                        value={bucket.productCategory || ''}
                                                                        onChange={e => updateBucketRow(index, 'productCategory', e.target.value)}
                                                                    >
                                                                        <option value="">-- Select Category --</option>
                                                                        {categories.map(cat => (
                                                                            <option key={cat} value={cat}>{cat}</option>
                                                                        ))}
                                                                    </select>
                                                                    <p className="text-[10px] text-primary mt-1 italic">
                                                                        Choosing a category allows this bundle to work in all branches by matching their locally available products in this category.
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] text-text-muted uppercase mb-1">Reference Price (Standard Price for Tracking)</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-background/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                                            placeholder="Standard price of this item"
                                                            value={bucket.referencePrice}
                                                            onChange={e => updateBucketRow(index, 'referencePrice', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-white font-bold">Financial Breakdown</h4>
                                            <div className="text-right">
                                                <p className="text-[10px] text-text-muted uppercase">Total Reference Value</p>
                                                <p className="text-sm text-white font-bold">{formatPrice(totalRefPrice)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] text-text-muted font-bold mb-1 uppercase tracking-widest">Bundle Sale Price</label>
                                                <input
                                                    required
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                                                    placeholder="5000"
                                                    value={packageFormData.price}
                                                    onChange={e => setPackageFormData({ ...packageFormData, price: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex flex-col justify-center px-4 bg-primary/10 border border-primary/20 rounded-xl">
                                                <p className="text-[10px] text-primary uppercase font-black">Customer Savings</p>
                                                <p className="text-lg text-primary font-black">{formatPrice(savings > 0 ? savings : 0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    {isAdminOrOwner && (
                                        <div className="flex items-center gap-3 bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 mt-4">
                                            <label className="relative flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={packageFormData.isGlobal}
                                                    onChange={(e) => setPackageFormData(prev => ({ ...prev, isGlobal: e.target.checked }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="relative w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                <span className="ms-3 text-sm font-medium text-white">Global Bundle</span>
                                            </label>
                                            <span className="material-icons-round text-text-muted text-sm" title="Global bundles are shared across all branches.">help_outline</span>
                                        </div>
                                    )}
                                    <button
                                        disabled={loadingPackage}
                                        type="submit"
                                        className="w-full bg-primary hover:bg-orange-600 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 text-sm"
                                    >
                                        {loadingPackage ? 'CREATING BUNDLE...' : 'CREATE SERVICE BUNDLE'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {isOwner && activeTab === 'branding' && (
                <div className="bg-surface rounded-3xl border border-white/5 p-8 shadow-sm max-w-5xl">
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
                <div className="bg-surface rounded-3xl border border-white/5 p-8 shadow-sm max-w-5xl">
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



