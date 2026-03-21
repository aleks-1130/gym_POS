import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLocation } from 'react-router-dom';
import { POS_VIEWS } from '../../constants/categories'; // Added import
import axios from 'axios';
import { useCurrency } from '../../context/CurrencyContext';
import { useReactToPrint } from 'react-to-print';
import Receipt from '../../components/Receipt';
import { withApiBase } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { PAYMENT_METHODS } from '../../config/businessConfig';

import { usePOSStore } from '../../stores/usePOSStore';
import { useConfirm } from '../../context/ConfirmContext';

// New Modular Components
import POSGrid from './pos/POSGrid';
import POSCart from './pos/POSCart';
import POSPaymentModal from './pos/POSPaymentModal';

// Utilities
import {
    authHeaders, normalizeList, extractBookingBatchId,
    getAvailableTimeSlotsForTrainer,
    getBuyerLabel, getMethodLabel, getTransactionTypeLabel,
    renderStatusBadge, renderTransactionTypeBadge
} from './pos/POSUtils';

export default function POS() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();

    // Zustand Store Selectors (Prevents Lag)
    const {
        cart, selectedMemberId, discount,
        modals, paymentDetails, lastTransaction, collectData,
        openModal, closeModal, setCollectField, clearCart,
        setSelectedMemberId, setCategory
    } = usePOSStore();
    const location = useLocation();

    const { discountAmount, total: cartTotal } = usePOSStore(useShallow(state => state.getTotals()));
    const appliedCoupon = usePOSStore(state => state.appliedCoupon);
    // effectiveCartTotal is now identical to cartTotal from getTotals()
    const effectiveCartTotal = cartTotal;


    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [classPackages, setClassPackages] = useState([]);
    const [members, setMembers] = useState([]);
    const [discountOptions, setDiscountOptions] = useState([]);
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
    const [historyMethodFilter, setHistoryMethodFilter] = useState('ALL');
    const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');
    const [historyPage, setHistoryPage] = useState(1);
    const [collectSearch, setCollectSearch] = useState('');
    const [collectViewMode, setCollectViewMode] = useState('LIST');
    const [history, setHistory] = useState([]);
    const [trainingBookings, setTrainingBookings] = useState([]);
    const [pendingInAppPurchases, setPendingInAppPurchases] = useState([]);

    const [viewMode, setViewMode] = useState('POS');
    const [loading, setLoading] = useState(false);

    const hasClassPackages = cart.some(item => item.type === 'CLASS_PACKAGE');

    // Receipt Printing
    const [receiptSettings, setReceiptSettings] = useState(null);
    const receiptRef = useRef();



    const groupedTrainingBookings = useMemo(() => {
        const groups = new Map();

        for (const session of trainingBookings) {
            const batchId = extractBookingBatchId(session?.notes);
            const createdDate = session?.createdAt ? new Date(session.createdAt) : null;
            const legacyCreatedBucket = createdDate && !Number.isNaN(createdDate.getTime())
                ? createdDate.toISOString().slice(0, 16)
                : null;
            const legacyKey = legacyCreatedBucket
                ? `legacy:${session.memberId || 0}:${session.trainerId || 0}:${legacyCreatedBucket}`
                : `single:${session.id}`;
            const key = batchId ? `batch:${batchId}` : legacyKey;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    batchId,
                    sessionIds: [],
                    member: session.member || null,
                    trainer: session.trainer || null,
                    firstDate: new Date(session.date),
                    totalDuration: 0,
                    totalAmount: 0,
                    count: 0
                });
            }

            const group = groups.get(key);
            group.sessionIds.push(session.id);
            group.count += 1;
            group.totalDuration += Number(session.duration || 0);
            group.totalAmount += Number(session.price || 0);
            const currentDate = new Date(session.date);
            if (currentDate < group.firstDate) group.firstDate = currentDate;

            const currentTrainerId = Number(group.trainer?.id || 0);
            const sessionTrainerId = Number(session.trainer?.id || 0);
            if (currentTrainerId && sessionTrainerId && currentTrainerId !== sessionTrainerId) {
                group.trainer = { ...group.trainer, name: 'Multiple Trainers' };
            }
        }

        return Array.from(groups.values()).sort((a, b) => a.firstDate - b.firstDate);
    }, [trainingBookings]);

    const handlePrint = useReactToPrint({
        content: () => receiptRef.current });

    useEffect(() => {
        fetchProducts();
        fetchPlans();
        fetchTrainers();
        fetchClassPackages();
        fetchMembers();
        fetchReceiptSettings();
        fetchPosDiscountOptions();
    }, []);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search || '');
        const stateMemberId = location.state?.memberId;
        const queryMemberId = searchParams.get('memberId');
        const resolvedMemberId = Number(stateMemberId ?? queryMemberId);
        if (Number.isInteger(resolvedMemberId) && resolvedMemberId > 0) {
            setSelectedMemberId(String(resolvedMemberId));
        }

        const stateCategory = location.state?.category;
        const queryCategory = searchParams.get('category');
        const normalizedCategory = String(stateCategory ?? queryCategory ?? '').trim().toUpperCase();
        const allowedCategories = [POS_VIEWS.MEMBERSHIP, POS_VIEWS.PACKAGES];
        if (allowedCategories.includes(normalizedCategory)) {
            setCategory(normalizedCategory);
        }
    }, [location.search, location.state, setSelectedMemberId, setCategory]);

    useEffect(() => {
        const fetchCollectCashData = async () => {
            await Promise.all([
                fetchTrainingBookings(),
                fetchPendingInAppPurchases()
            ]);
        };

        fetchCollectCashData();
        const intervalMs = viewMode === 'TRAINING_BOOKINGS' ? 10000 : 30000;
        const intervalId = setInterval(fetchCollectCashData, intervalMs);
        return () => clearInterval(intervalId);
    }, [viewMode]);

    useEffect(() => {
        if (!modals.receiptPreview) return;
        fetchReceiptSettings();
    }, [modals.receiptPreview]);


    const fetchProducts = async () => {
        try {
            const res = await axios.get(withApiBase('/api/products'));
            setProducts(normalizeList(res.data));
        } catch {
            console.error("Failed to fetch products");
            setProducts([]);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans'));
            setPlans(normalizeList(res.data));
        } catch {
            console.error("Failed to fetch plans");
            setPlans([]);
        }
    };

    const fetchTrainers = async () => {
        try {
            const res = await axios.get(withApiBase('/api/trainers'));
            setTrainers(normalizeList(res.data));
        } catch {
            console.error("Failed to fetch trainers");
            setTrainers([]);
        }
    };

    const fetchClassPackages = async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans/class-session-packages'), {
                headers: authHeaders()
            });
            const packages = normalizeList(res.data);
            setClassPackages(packages.filter((pkg) => pkg?.isActive));
        } catch {
            console.error("Failed to fetch class session packages");
            setClassPackages([]);
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await axios.get(withApiBase('/api/members'));
            setMembers(normalizeList(res.data));
        } catch {
            console.error("Failed to fetch members");
            setMembers([]);
        }
    }

    const fetchPosDiscountOptions = async () => {
        try {
            const res = await axios.get(withApiBase('/api/payments/discount-options'), {
                headers: authHeaders()
            });
            const presets = normalizeList(res.data)
                .map((preset, index) => ({
                    id: String(preset?.id || `preset_${index + 1}`),
                    name: String(preset?.name || '').trim(),
                    rate: Number(preset?.rate || 0),
                    icon: String(preset?.icon || 'local_offer').trim() || 'local_offer'
                }))
                .filter((preset) => preset.name && Number.isFinite(preset.rate) && preset.rate >= 0 && preset.rate <= 100);
            setDiscountOptions(presets);
        } catch {
            console.error("Failed to fetch POS discount presets");
            setDiscountOptions([]);
        }
    };

    const fetchReceiptSettings = async () => {
        try {
            const res = await axios.get(withApiBase('/api/payments/receipt-settings'), {
                headers: authHeaders()
            });
            setReceiptSettings(res.data || null);
        } catch {
            console.error("Failed to fetch receipt settings");
            setReceiptSettings(null);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get(withApiBase('/api/payments'), {
                headers: authHeaders()
            });
            setHistory(normalizeList(res.data));
        } catch {
            console.error("Failed to fetch history");
        }
    }

    const fetchTrainingBookings = async () => {
        try {
            const res = await axios.get(withApiBase('/api/staff/training-sessions'), {
                params: { status: 'UNPAID' },
                headers: authHeaders()
            });
            setTrainingBookings(res.data || []);
        } catch {
            console.error("Failed to fetch training bookings");
        }
    };

    const fetchPendingInAppPurchases = async () => {
        try {
            const res = await axios.get(withApiBase('/api/payments'), {
                headers: authHeaders()
            });
            const payments = normalizeList(res.data);
            const pendingCash = payments.filter((payment) =>
                String(payment?.status || '').toUpperCase() === 'PENDING' &&
                String(payment?.method || '').toUpperCase() === 'CASH' &&
                String(payment?.type || '').toUpperCase() !== 'TRAINING'
            );
            setPendingInAppPurchases(pendingCash);
        } catch {
            console.error("Failed to fetch pending in-app purchases");
            setPendingInAppPurchases([]);
        }
    };

    // Cart logic now handled by usePOSStore


    const initiateCheckout = async () => {
        try {
            console.log("initiateCheckout triggered. Cart:", cart);
            if (cart.length === 0) return;

            const hasTraining = cart.some(item => item.type === 'TRAINING');

            // Validation for Membership
            const hasPlan = cart.some(item => item.type === 'PLAN');
            if (hasPlan && !selectedMemberId) {
                await showAlert({ title: 'Member Required', message: 'A Member must be selected when purchasing a Membership Plan.', type: 'warning' });
                return;
            }
            if (hasTraining && !selectedMemberId) {
                await showAlert({ title: 'Member Required', message: 'Select a member for trainer booking.', type: 'warning' });
                return;
            }
            if (hasClassPackages && !selectedMemberId) {
                await showAlert({ title: 'Member Required', message: 'Select a member for class package purchase.', type: 'warning' });
                return;
            }
            if (hasClassPackages && selectedMemberId) {
                const selectedMember = members.find((m) => Number(m.id) === Number(selectedMemberId));
                const memberStatus = String(selectedMember?.status || '').toUpperCase();
                const expiryDate = selectedMember?.expiryDate ? new Date(selectedMember.expiryDate) : null;
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const expiredByDate = expiryDate && !Number.isNaN(expiryDate.getTime()) && expiryDate < todayStart;

                if (memberStatus === 'EXPIRED' || expiredByDate) {
                    await showAlert({
                        title: 'Membership Expired',
                        message: 'Cannot add class sessions for expired membership. Renew membership first.',
                        type: 'warning'
                    });
                    return;
                }
            }

            if (hasTraining) {
                console.log("Validating training sessions...");
                const invalid = cart.some(item => item.type === 'TRAINING' && (!item.date || !item.time || !item.duration));
                if (invalid) {
                    await showAlert({ title: 'Incomplete Details', message: 'Please complete date, time, and duration for all training sessions.', type: 'warning' });
                    return;
                }
                const hasPastDateTime = cart.some((item) => {
                    if (item.type !== 'TRAINING') return false;
                    const scheduled = new Date(`${item.date}T${item.time}`);
                    return Number.isNaN(scheduled.getTime()) || scheduled <= new Date();
                });
                if (hasPastDateTime) {
                    await showAlert({ title: 'Invalid Schedule', message: 'Past trainer booking schedule is not allowed.', type: 'warning' });
                    return;
                }
                const invalidSchedule = cart.some((item) => {
                    if (item.type !== 'TRAINING') return false;
                    const trainer = trainers.find((t) => Number(t.id) === Number(item.trainerId));
                    if (!trainer) {
                        console.error("Trainer not found for item:", item);
                        return true;
                    }
                    const slots = getAvailableTimeSlotsForTrainer(trainer, item.date, item.duration);
                    return !slots.includes(item.time);
                });
                if (invalidSchedule) {
                    await showAlert({ title: 'Unavailable Slot', message: 'One or more trainer bookings use unavailable time slots or trainer not found. Please reselect time.', type: 'warning' });
                    return;
                }
            }

            console.log("Validation passed. Opening payment modal...");
            openModal('payment');
        } catch (error) {
            console.error("Checkout Error:", error);
            await showAlert({ title: 'System Error', message: 'A system error occurred during checkout initialization: ' + error.message, type: 'danger' });
        }
    };


    const processPayment = async (method) => {
        setLoading(true);
        try {
            const { amountTendered, gcashReference, gcashDate, gcashTime } = paymentDetails;
            const parsedTendered = method === 'CASH' ? Number(amountTendered) : null;
            if (method === 'CASH' && (!Number.isFinite(parsedTendered) || parsedTendered < effectiveCartTotal)) {
                throw new Error("Cash tendered must be a valid amount and at least equal to the total.");
            }

            const tendered = method === 'CASH' ? parsedTendered : null;
            const change = method === 'CASH' ? Number((parsedTendered - effectiveCartTotal).toFixed(2)) : null;

            const trainingItems = cart.filter(i => i.type === 'TRAINING');
            const otherItems = cart.filter(i => i.type !== 'TRAINING');
            const memberId = selectedMemberId ? Number(selectedMemberId) : null;

            let mainTransaction = null;
            const externalDate = (gcashDate && gcashTime) ? `${gcashDate}T${gcashTime}` : null;

            // 1. Process Training Items (if any)
            if (trainingItems.length > 0) {
                if (!memberId) throw new Error("Member is required for training sessions");

                for (const item of trainingItems) {
                    await axios.post(withApiBase('/api/staff/book-training'), {
                        memberId,
                        trainerId: item.trainerId,
                        date: item.date,
                        time: item.time,
                        duration: item.duration,
                        notes: item.notes,
                        method,
                        externalRef: ['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method) ? gcashReference : null,
                        externalDate: ['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method) ? externalDate : null
                    }, { headers: authHeaders() });

                    if (!mainTransaction) {
                        mainTransaction = { id: 'TRAINING', amount: cartTotal, type: 'TRAINING', method };
                    }
                }
            }

            // 2. Process Non-Training Items (if any)
            if (otherItems.length > 0) {
                const hasPlan = otherItems.some(item => item.type === 'PLAN');
                const hasPackage = otherItems.some(item => item.type === 'CLASS_PACKAGE');
                const paymentType = hasPlan ? 'MEMBERSHIP' : hasPackage ? 'CLASS_PACKAGE' : 'POS_SALE';

                const res = await axios.post(withApiBase('/api/payments'), {
                    amount: effectiveCartTotal,
                    type: paymentType,
                    method: method,
                    items: otherItems,
                    discount: discount,
                    couponCode: appliedCoupon ? appliedCoupon.code : undefined,
                    promoCodeId: appliedCoupon ? (appliedCoupon.promoCodeId || appliedCoupon.id) : undefined,
                    memberId: memberId || null,
                    cashTendered: tendered,
                    changeDue: change,
                    sessionId: usePOSStore.getState().sessionId,
                    externalRef: ['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method) ? gcashReference : null,
                    externalDate: ['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method) ? externalDate : null
                }, { headers: authHeaders() });

                mainTransaction = res.data;
            }

            // Summary Reciept Data
            const memberData = members.find(m => m.id === memberId);
            openModal('receiptPreview', {
                transaction: mainTransaction || { id: 'MIXED', amount: cartTotal, type: 'MIXED', method },
                items: cart,
                member: memberData,
                discount: discountAmount,
                cashierName: user?.name,
                paymentDetails: { method, tendered, change }
            });

            closeModal('payment');
            clearCart();
            fetchProducts();
            fetchClassPackages();
            setLoading(false);

        } catch (e) {
            await showAlert({ title: 'Transaction Failed', message: e.response?.data?.error || e.message, type: 'danger' });
            setLoading(false);
        }
    };


    const openReceiptTemplatePreview = () => {
        const previewItems = cart.length > 0
            ? cart.map((item) => ({
                name: item.name,
                price: Number(item.price || 0),
                quantity: Number(item.quantity || 1),
                type: item.type
            }))
            : [{
                name: 'Sample Item',
                price: 350,
                quantity: 1,
                type: 'PRODUCT'
            }];

        const previewSubtotal = previewItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const previewDiscount = cart.length > 0 ? discountAmount : 0;

        openModal('receiptPreview', {
            transaction: {
                id: 'PREVIEW',
                amount: Math.max(0, previewSubtotal - previewDiscount),
                type: 'POS_PREVIEW',
                method: 'CASH',
                date: new Date().toISOString(),
                pointsAwarded: usePOSStore.getState().selectedMemberId ? Math.floor(Math.max(0, previewSubtotal - previewDiscount - usePOSStore.getState().getTotals().couponDiscount) * 0.1) : 0,
                couponCode: usePOSStore.getState().appliedCoupon ? (usePOSStore.getState().appliedCoupon.label || usePOSStore.getState().appliedCoupon.code) : null,
                couponDiscount: usePOSStore.getState().appliedCoupon ? usePOSStore.getState().getTotals().couponDiscount : 0
            },
            items: previewItems,
            member: selectedMemberId ? members.find((m) => m.id === Number(selectedMemberId)) : null,
            discount: previewDiscount,
            cashierName: user?.name,
            paymentDetails: {
                method: 'CASH',
                tendered: previewSubtotal,
                change: 0
            }
        });
    };




    const historyQuery = String(historySearch || '').trim().toLowerCase();
    const historyStatusOptions = ['ALL', ...Array.from(new Set(history.map((payment) => String(payment?.status || 'COMPLETED').toUpperCase())))];
    const historyMethodOptions = ['ALL', ...Array.from(new Set(history.map((payment) => String(payment?.method || '').toUpperCase()).filter(Boolean)))];
    const historyTypeOptions = ['ALL', ...Array.from(new Set(history.map((payment) => String(payment?.type || '').toUpperCase()).filter(Boolean)))];
    const historyPageSize = 15;
    const filteredHistory = history.filter((payment) => {
        if (!historyQuery) return true;

        const buyer = getBuyerLabel(payment);
        const cashier = payment?.cashier?.name || '';
        const method = getMethodLabel(payment?.method);
        const type = getTransactionTypeLabel(payment?.type);
        const status = payment?.status || '';
        const amount = payment?.amount ?? '';

        return [buyer, cashier, method, type, status, amount]
            .some((field) => String(field || '').toLowerCase().includes(historyQuery));
    }).filter((payment) => {
        const normalizedStatus = String(payment?.status || 'COMPLETED').toUpperCase();
        const normalizedMethod = String(payment?.method || '').toUpperCase();
        const normalizedType = String(payment?.type || '').toUpperCase();
        const statusMatches = historyStatusFilter === 'ALL' || normalizedStatus === historyStatusFilter;
        const methodMatches = historyMethodFilter === 'ALL' || normalizedMethod === historyMethodFilter;
        const typeMatches = historyTypeFilter === 'ALL' || normalizedType === historyTypeFilter;
        return statusMatches && methodMatches && typeMatches;
    });
    const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
    const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
    const paginatedHistory = filteredHistory.slice(
        (currentHistoryPage - 1) * historyPageSize,
        currentHistoryPage * historyPageSize
    );

    const collectQuery = String(collectSearch || '').trim().toLowerCase();
    const filteredBookingGroups = groupedTrainingBookings.filter((bookingGroup) => {
        if (!collectQuery) return true;
        const buyer = bookingGroup.member ? `${bookingGroup.member.firstName} ${bookingGroup.member.lastName}` : '';
        const trainer = bookingGroup.trainer?.name || '';
        return [buyer, trainer, bookingGroup.totalAmount, bookingGroup.totalDuration, bookingGroup.count]
            .some((field) => String(field || '').toLowerCase().includes(collectQuery));
    });
    const filteredPendingPurchases = pendingInAppPurchases.filter((payment) => {
        if (!collectQuery) return true;
        const buyer = getBuyerLabel(payment);
        return [buyer, payment?.type, payment?.status, payment?.amount, payment?.method]
            .some((field) => String(field || '').toLowerCase().includes(collectQuery));
    });

    const collectNotificationCount = groupedTrainingBookings.length + pendingInAppPurchases.length;
    const collectNotificationLabel = collectNotificationCount > 99 ? '99+' : String(collectNotificationCount);
    const commonInputClass = "w-full rounded-xl border border-white/10 bg-surface px-10 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary";
    const commonSelectClass = "w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary";
    const renderCollectEmptyState = (title, message) => (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/10 p-6 text-center">
            <svg
                viewBox="0 0 120 120"
                className="mb-4 h-20 w-20 text-text-muted/70"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                <rect x="18" y="24" width="84" height="62" rx="10" stroke="currentColor" strokeWidth="4" />
                <path d="M18 44H102" stroke="currentColor" strokeWidth="4" />
                <circle cx="42" cy="65" r="8" stroke="currentColor" strokeWidth="4" />
                <path d="M60 66H84" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <path d="M36 95H84" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs text-text-muted">{message}</p>
        </div>
    );


    const openHistoryView = () => {
        fetchHistory();
        setHistoryPage(1);
        setViewMode('HISTORY');
    };

    const openCollectCashView = () => {
        setViewMode('TRAINING_BOOKINGS');
    };

    useEffect(() => {
        setHistoryPage(1);
    }, [historySearch, historyStatusFilter, historyMethodFilter, historyTypeFilter]);

    useEffect(() => {
        if (historyPage > totalHistoryPages) {
            setHistoryPage(totalHistoryPages);
        }
    }, [historyPage, totalHistoryPages]);

    const renderModeTabs = () => (
        <div className="ml-auto inline-flex rounded-2xl border border-white/10 bg-surface p-1 shadow-sm">
            <button
                type="button"
                onClick={() => setViewMode('POS')}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${viewMode === 'POS' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
            >
                <span className="material-icons-round text-sm">point_of_sale</span>
                POS
            </button>
            <button
                type="button"
                onClick={openHistoryView}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${viewMode === 'HISTORY' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
            >
                <span className="material-icons-round text-sm">history</span>
                History
            </button>
            <button
                type="button"
                onClick={openCollectCashView}
                className={`relative inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${viewMode === 'TRAINING_BOOKINGS' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
            >
                <span className="material-icons-round text-sm">payments</span>
                Collect Cash
                {collectNotificationCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-lg">
                        {collectNotificationLabel}
                    </span>
                )}
            </button>
        </div>
    );

    if (viewMode === 'HISTORY') {
        return (
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Transaction History</h1>
                        <p className="text-sm text-text-muted">Track sales with unified filtering and quick lookup.</p>
                    </div>
                    {renderModeTabs()}
                </div>

                <div className="rounded-2xl border border-white/10 bg-surface p-4">
                    <div className="grid gap-3 xl:grid-cols-[1fr,220px,220px,220px]">
                        <label className="relative block">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">search</span>
                            <input
                                type="text"
                                value={historySearch}
                                onChange={(event) => setHistorySearch(event.target.value)}
                                placeholder="Search receipt, buyer, cashier, type, method, or amount"
                                className={commonInputClass}
                            />
                        </label>
                        <select
                            value={historyStatusFilter}
                            onChange={(event) => setHistoryStatusFilter(event.target.value)}
                            className={commonSelectClass}
                        >
                            {historyStatusOptions.map((status) => (
                                <option key={status} value={status}>{status === 'ALL' ? 'All Statuses' : status}</option>
                            ))}
                        </select>
                        <select
                            value={historyMethodFilter}
                            onChange={(event) => setHistoryMethodFilter(event.target.value)}
                            className={commonSelectClass}
                        >
                            {historyMethodOptions.map((method) => (
                                <option key={method} value={method}>{method === 'ALL' ? 'All Methods' : getMethodLabel(method)}</option>
                            ))}
                        </select>
                        <select
                            value={historyTypeFilter}
                            onChange={(event) => setHistoryTypeFilter(event.target.value)}
                            className={commonSelectClass}
                        >
                            {historyTypeOptions.map((type) => (
                                <option key={type} value={type}>{type === 'ALL' ? 'All Categories' : getTransactionTypeLabel(type)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm min-h-[560px] xl:min-h-[680px] flex flex-col">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full table-fixed text-left text-xs text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Amount</th>
                                    <th className="px-4 py-3">Method</th>
                                    <th className="px-4 py-3">Member</th>
                                    <th className="px-4 py-3">Cashier</th>
                                    <th className="px-4 py-3">Change</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredHistory.length === 0 && (
                                    <tr><td colSpan="9" className="p-6 text-center text-text-muted">No transactions found.</td></tr>
                                )}
                                {paginatedHistory.map((pay) => {
                                    const methodLabel = getMethodLabel(pay.method);
                                    return (
                                        <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                                                {new Date(pay.date).toLocaleDateString()} <span className="text-text-muted font-normal text-[10px]">{new Date(pay.date).toLocaleTimeString()}</span>
                                            </td>
                                            <td className="px-4 py-2.5">{renderTransactionTypeBadge(pay.type)}</td>
                                            <td className="px-4 py-2.5 text-white font-bold whitespace-nowrap">{formatPrice(pay.amount)}</td>
                                            <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                                                <span className="inline-block max-w-[108px] truncate align-middle" title={methodLabel}>{methodLabel}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-white whitespace-nowrap">
                                                <span className="inline-block max-w-[128px] truncate align-middle" title={getBuyerLabel(pay)}>{getBuyerLabel(pay)}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-white whitespace-nowrap">
                                                <span className="inline-block max-w-[108px] truncate align-middle" title={pay.cashier?.name || 'N/A'}>{pay.cashier?.name || 'N/A'}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-white whitespace-nowrap">
                                                {pay.method === 'CASH' ? formatPrice(pay.changeDue || 0) : '-'}
                                            </td>
                                            <td className="px-4 py-2.5">{renderStatusBadge(pay.status)}</td>
                                            <td className="px-4 py-2.5">
                                            <a
                                                href={`/pos/transactions/${pay.id}`}
                                                className="text-primary hover:text-orange-400 font-medium text-[11px] inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                                            >
                                                <span className="material-icons-round text-sm">receipt</span>
                                                View
                                            </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredHistory.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-6 py-3">
                            <p className="text-xs text-text-muted">
                                Showing {((currentHistoryPage - 1) * historyPageSize) + 1}-{Math.min(currentHistoryPage * historyPageSize, filteredHistory.length)} of {filteredHistory.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentHistoryPage <= 1}
                                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-semibold text-text-secondary">Page {currentHistoryPage} of {totalHistoryPages}</span>
                                <button
                                    type="button"
                                    onClick={() => setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))}
                                    disabled={currentHistoryPage >= totalHistoryPages}
                                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (viewMode === 'TRAINING_BOOKINGS') {
        return (
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Collect Cash</h1>
                        <p className="text-sm text-text-muted">Manage unpaid sessions and pending cash settlements.</p>
                    </div>
                    {renderModeTabs()}
                </div>

                <div className="rounded-2xl border border-white/10 bg-surface p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr,220px]">
                        <label className="relative block">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">search</span>
                            <input
                                type="text"
                                value={collectSearch}
                                onChange={(event) => setCollectSearch(event.target.value)}
                                placeholder="Search buyer, member, trainer, type, status, or amount"
                                className={commonInputClass}
                            />
                        </label>
                        <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
                            <button
                                type="button"
                                onClick={() => setCollectViewMode('LIST')}
                                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${collectViewMode === 'LIST' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                            >
                                List View
                            </button>
                            <button
                                type="button"
                                onClick={() => setCollectViewMode('GRID')}
                                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${collectViewMode === 'GRID' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                            >
                                Grid View
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid items-stretch gap-4 xl:grid-cols-2">
                    <section className="bg-surface rounded-3xl border border-white/10 shadow-sm flex min-h-[680px] xl:min-h-[830px] flex-col">
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 bg-white/5">
                            <div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wide">In-App Purchases</h2>
                                <p className="text-[11px] text-text-muted">Pending in-app cash settlements</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                PENDING
                                <span className="rounded-full bg-amber-500/20 px-1.5 py-[1px] text-[10px]">{filteredPendingPurchases.length}</span>
                            </span>
                        </div>
                        <div className="flex-1 p-4">
                            {filteredPendingPurchases.length === 0 ? (
                                renderCollectEmptyState('No Pending Purchases', 'Pending in-app cash purchases will appear here.')
                            ) : collectViewMode === 'GRID' ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {filteredPendingPurchases.map((payment) => (
                                        <article key={payment.id} className="h-full min-h-[300px] rounded-2xl border border-white/10 bg-black/15 p-4 flex flex-col">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-bold text-white leading-tight truncate">{getBuyerLabel(payment)}</p>
                                                {renderStatusBadge(payment.status)}
                                            </div>
                                            <div className="mt-2">{renderTransactionTypeBadge(payment.type)}</div>
                                            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                                                <div>
                                                    <p className="text-text-muted uppercase tracking-wider">Date</p>
                                                    <p className="mt-1 text-white">{new Date(payment.date).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-text-muted uppercase tracking-wider">Time</p>
                                                    <p className="mt-1 text-white">{new Date(payment.date).toLocaleTimeString()}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-text-muted uppercase tracking-wider">Amount Due</p>
                                                    <p className="mt-1 text-base font-bold text-white">{formatPrice(payment.amount)}</p>
                                                </div>
                                            </div>
                                            <div className="mt-auto pt-4 flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        openModal('collectPurchase', payment);
                                                    }}
                                                    className="flex-1 text-[11px] font-bold px-2.5 py-2 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const confirmed = await showConfirm({
                                                            title: 'Decline Purchase?',
                                                            message: 'Decline this pending cash purchase?',
                                                            confirmLabel: 'Decline',
                                                            type: 'danger'
                                                        });
                                                        if (!confirmed) return;
                                                        try {
                                                            await axios.post(withApiBase(`/api/payments/${payment.id}/decline-cash`), {}, { headers: authHeaders() });
                                                            await Promise.all([fetchPendingInAppPurchases(), fetchHistory()]);
                                                        } catch (e) {
                                                            await showAlert({ title: 'Decline Failed', message: e.response?.data?.error || 'Failed to decline payment', type: 'danger' });
                                                        }
                                                    }}
                                                    className="flex-1 text-[11px] font-bold px-2.5 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-2xl border border-white/10">
                                    <table className="w-full table-fixed text-left text-xs text-text-secondary">
                                        <thead className="bg-white/5 text-text-muted uppercase text-[10px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2.5">Date</th>
                                                <th className="px-3 py-2.5">Buyer</th>
                                                <th className="px-3 py-2.5">Type</th>
                                                <th className="px-3 py-2.5">Amount</th>
                                                <th className="px-3 py-2.5">Status</th>
                                                <th className="w-[140px] px-3 py-2.5">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredPendingPurchases.map((payment) => (
                                                <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">
                                                        {new Date(payment.date).toLocaleDateString()} <span className="text-text-muted font-normal text-[10px]">{new Date(payment.date).toLocaleTimeString()}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-white whitespace-nowrap">
                                                        <span className="inline-block max-w-[150px] truncate align-middle" title={getBuyerLabel(payment)}>{getBuyerLabel(payment)}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5">{renderTransactionTypeBadge(payment.type)}</td>
                                                    <td className="px-3 py-2.5 text-white font-bold whitespace-nowrap">{formatPrice(payment.amount)}</td>
                                                    <td className="px-3 py-2.5">{renderStatusBadge(payment.status)}</td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                            <button
                                                                onClick={() => {
                                                                    openModal('collectPurchase', payment);
                                                                }}
                                                                className="text-[10px] font-bold px-2 py-1 rounded-md border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                            >
                                                                Accept
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const confirmed = await showConfirm({
                                                                        title: 'Decline Purchase?',
                                                                        message: 'Decline this pending cash purchase?',
                                                                        confirmLabel: 'Decline',
                                                                        type: 'danger'
                                                                    });
                                                                    if (!confirmed) return;
                                                                    try {
                                                                        await axios.post(withApiBase(`/api/payments/${payment.id}/decline-cash`), {}, { headers: authHeaders() });
                                                                        await Promise.all([fetchPendingInAppPurchases(), fetchHistory()]);
                                                                    } catch (e) {
                                                                        await showAlert({ title: 'Decline Failed', message: e.response?.data?.error || 'Failed to decline payment', type: 'danger' });
                                                                    }
                                                                }}
                                                                className="text-[10px] font-bold px-2 py-1 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                                            >
                                                                Decline
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="bg-surface rounded-3xl border border-white/10 shadow-sm flex min-h-[680px] xl:min-h-[760px] flex-col">
                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 bg-white/5">
                            <div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wide">Trainer Bookings</h2>
                                <p className="text-[11px] text-text-muted">Unpaid trainer sessions ready for collection</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-200" />
                                UNPAID
                                <span className="rounded-full bg-blue-500/20 px-1.5 py-[1px] text-[10px]">{filteredBookingGroups.length}</span>
                            </span>
                        </div>
                        <div className="flex-1 p-4">
                            {filteredBookingGroups.length === 0 ? (
                                renderCollectEmptyState('No Unpaid Bookings', 'Unpaid trainer sessions will show here for cash collection.')
                            ) : collectViewMode === 'GRID' ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {filteredBookingGroups.map((bookingGroup) => (
                                        <article key={bookingGroup.key} className="h-full min-h-[300px] rounded-2xl border border-white/10 bg-black/15 p-4 flex flex-col">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-bold text-white leading-tight truncate">
                                                    {bookingGroup.member ? `${bookingGroup.member.firstName} ${bookingGroup.member.lastName}` : 'N/A'}
                                                </p>
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">UNPAID</span>
                                            </div>
                                            <p className="mt-1 text-xs text-text-muted truncate">{bookingGroup.trainer?.name || 'N/A'}</p>
                                            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                                                <div>
                                                    <p className="text-text-muted uppercase tracking-wider">Date</p>
                                                    <p className="mt-1 text-white">{bookingGroup.firstDate.toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-text-muted uppercase tracking-wider">Time</p>
                                                    <p className="mt-1 text-white">{bookingGroup.firstDate.toLocaleTimeString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-text-muted uppercase tracking-wider">Sessions</p>
                                                    <p className="mt-1 text-white">{bookingGroup.count} session(s)</p>
                                                </div>
                                                <div>
                                                    <p className="text-text-muted uppercase tracking-wider">Duration</p>
                                                    <p className="mt-1 text-white">{bookingGroup.totalDuration} min</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-text-muted uppercase tracking-wider">Amount Due</p>
                                                    <p className="mt-1 text-base font-bold text-white">{formatPrice(bookingGroup.totalAmount)}</p>
                                                </div>
                                            </div>
                                            <div className="mt-auto pt-4 flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        openModal('collectCash', bookingGroup);
                                                    }}
                                                    className="flex-1 text-[11px] font-bold px-2.5 py-2 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const confirmed = await showConfirm({
                                                            title: 'Decline Booking?',
                                                            message: `Decline ${bookingGroup.count} booking(s)?`,
                                                            confirmLabel: 'Decline',
                                                            type: 'danger'
                                                        });
                                                        if (!confirmed) return;
                                                        try {
                                                                    await Promise.all(
                                                                        bookingGroup.sessionIds.map((sessionId) =>
                                                                            axios.post(withApiBase(`/api/staff/training-sessions/${sessionId}/decline`), {}, { headers: authHeaders() })
                                                                        )
                                                                    );
                                                            await fetchTrainingBookings();
                                                        } catch (e) {
                                                            const message = e.response?.data?.error || "Failed to decline booking";
                                                            const detail = e.response?.data?.detail;
                                                            await showAlert({ title: 'Decline Failed', message: detail ? `${message}\n\nDetails: ${detail}` : message, type: 'danger' });
                                                        }
                                                    }}
                                                    className="flex-1 text-[11px] font-bold px-2.5 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-2xl border border-white/10">
                                    <table className="w-full table-fixed text-left text-xs text-text-secondary">
                                        <thead className="bg-white/5 text-text-muted uppercase text-[10px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2.5">Date</th>
                                                <th className="px-3 py-2.5">Buyer</th>
                                                <th className="px-3 py-2.5">Trainer</th>
                                                <th className="px-3 py-2.5">Sessions</th>
                                                <th className="px-3 py-2.5">Amount</th>
                                                <th className="px-3 py-2.5">Status</th>
                                                <th className="w-[140px] px-3 py-2.5">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredBookingGroups.map((bookingGroup) => (
                                                <tr key={bookingGroup.key} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">
                                                        {bookingGroup.firstDate.toLocaleDateString()} <span className="text-text-muted font-normal text-[10px]">{bookingGroup.firstDate.toLocaleTimeString()}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-white whitespace-nowrap">
                                                        <span className="inline-block max-w-[140px] truncate align-middle" title={bookingGroup.member ? `${bookingGroup.member.firstName} ${bookingGroup.member.lastName}` : 'N/A'}>
                                                            {bookingGroup.member ? `${bookingGroup.member.firstName} ${bookingGroup.member.lastName}` : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-white whitespace-nowrap">
                                                        <span className="inline-block max-w-[120px] truncate align-middle" title={bookingGroup.trainer?.name || 'N/A'}>
                                                            {bookingGroup.trainer?.name || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-white whitespace-nowrap">{bookingGroup.count} / {bookingGroup.totalDuration}m</td>
                                                    <td className="px-3 py-2.5 text-white font-bold whitespace-nowrap">{formatPrice(bookingGroup.totalAmount)}</td>
                                                    <td className="px-3 py-2.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">UNPAID</span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                            <button
                                                                onClick={() => {
                                                                    openModal('collectCash', bookingGroup);
                                                                }}
                                                                className="text-[10px] font-bold px-2 py-1 rounded-md border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                            >
                                                                Accept
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const confirmed = await showConfirm({
                                                                        title: 'Decline Booking?',
                                                                        message: `Decline ${bookingGroup.count} booking(s)?`,
                                                                        confirmLabel: 'Decline',
                                                                        type: 'danger'
                                                                    });
                                                                    if (!confirmed) return;
                                                                    try {
                                                                        await Promise.all(
                                                                            bookingGroup.sessionIds.map((sessionId) =>
                                                                                axios.post(withApiBase(`/api/staff/training-sessions/${sessionId}/decline`), {}, { headers: authHeaders() })
                                                                            )
                                                                        );
                                                                        await fetchTrainingBookings();
                                                                    } catch (e) {
                                                                        const message = e.response?.data?.error || "Failed to decline booking";
                                                                        const detail = e.response?.data?.detail;
                                                                        await showAlert({ title: 'Decline Failed', message: detail ? `${message}\n\nDetails: ${detail}` : message, type: 'danger' });
                                                                    }
                                                                }}
                                                                className="text-[10px] font-bold px-2 py-1 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                                            >
                                                                Decline
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {
                    modals.collectCash && collectData.session && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6">
                                <div className="mb-4">
                                    <h2 className="text-xl font-bold text-white">Collect Cash</h2>
                                    <p className="text-text-muted text-sm">
                                        {collectData.session.member?.firstName} {collectData.session.member?.lastName} • {collectData.session.trainer?.name}
                                        {collectData.session.count > 1 ? ` (${collectData.session.count} sessions)` : ''}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-muted">Amount Due</span>
                                        <span className="text-white font-bold text-lg">{formatPrice(collectData.session.totalAmount || collectData.session.price || 0)}</span>
                                    </div>
                                    <div>
                                        <label className="block text-text-muted text-sm font-medium mb-2">Cash Tendered</label>
                                        <input
                                            type="number"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white text-base focus:border-primary outline-none"
                                            placeholder="0.00"
                                            value={collectData.tendered}
                                            onChange={(e) => setCollectField('tendered', e.target.value)}
                                        />
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                        <span className="text-text-secondary">Change Due:</span>
                                        {formatPrice(Math.max(0, (parseFloat(collectData.tendered) || 0) - (collectData.session.totalAmount || collectData.session.price || 0)))}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => closeModal('collectCash')}
                                            className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const amountDue = collectData.session.totalAmount || collectData.session.price || 0;
                                                if ((parseFloat(collectData.tendered) || 0) < amountDue) return;
                                                setLoading(true);
                                                try {
                                                    await axios.post(withApiBase('/api/staff/training-sessions/collect-batch'), {
                                                        sessionIds: collectData.session.sessionIds || [collectData.session.id],
                                                        method: 'CASH',
                                                        cashTendered: parseFloat(collectData.tendered)
                                                    }, { headers: authHeaders() });
                                                    await fetchTrainingBookings();
                                                    await fetchHistory();
                                                    closeModal('collectCash');
                                                } catch {
                                                    await showAlert({ title: 'Collection Failed', message: 'Failed to collect payment', type: 'danger' });
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                            disabled={loading || (parseFloat(collectData.tendered) || 0) < (collectData.session.totalAmount || collectData.session.price || 0)}
                                            className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                                        >
                                            {loading ? 'Collecting...' : 'Collect'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }


                {
                    modals.collectPurchase && collectData.purchase && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6">
                                <div className="mb-4">
                                    <h2 className="text-xl font-bold text-white">Collect Cash</h2>
                                    <p className="text-text-muted text-sm">
                                        {collectData.purchase.member?.firstName} {collectData.purchase.member?.lastName} • {collectData.purchase.type}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-text-muted">Amount Due</span>
                                        <span className="text-white font-bold text-lg">{formatPrice(collectData.purchase.amount)}</span>
                                    </div>
                                    <div>
                                        <label className="block text-text-muted text-sm font-medium mb-2">Cash Tendered</label>
                                        <input
                                            type="number"
                                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white text-base focus:border-primary outline-none"
                                            placeholder="0.00"
                                            value={collectData.tendered}
                                            onChange={(e) => setCollectField('tendered', e.target.value)}
                                        />
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                        <span className="text-text-secondary">Change Due:</span>
                                        {formatPrice(Math.max(0, (parseFloat(collectData.tendered) || 0) - collectData.purchase.amount))}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => closeModal('collectPurchase')}
                                            className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if ((parseFloat(collectData.tendered) || 0) < collectData.purchase.amount) return;
                                                setLoading(true);
                                                try {
                                                    await axios.post(withApiBase(`/api/payments/${collectData.purchase.id}/collect-cash`), {
                                                        cashTendered: parseFloat(collectData.tendered)
                                                    }, { headers: authHeaders() });
                                                    await Promise.all([fetchPendingInAppPurchases(), fetchHistory()]);
                                                    closeModal('collectPurchase');
                                                } catch (e) {
                                                    await showAlert({ title: 'Collection Failed', message: e.response?.data?.error || 'Failed to collect payment', type: 'danger' });
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                            disabled={loading || (parseFloat(collectData.tendered) || 0) < collectData.purchase.amount}
                                            className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                                        >
                                            {loading ? 'Collecting...' : 'Collect'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

            </div >
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-hidden relative">

            {/* Receipt Preview Modal */}
            {modals.receiptPreview && lastTransaction && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white text-black rounded-lg shadow-2xl w-auto max-w-[95vw] flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-100 rounded-t-lg">
                            <h3 className="font-bold text-lg">Receipt Preview</h3>
                            <button onClick={() => closeModal('receiptPreview')} className="text-gray-500 hover:text-gray-700">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 flex-1 bg-gray-500/10">
                            <Receipt
                                ref={receiptRef}
                                transaction={lastTransaction.transaction}
                                items={lastTransaction.items}
                                member={lastTransaction.member}
                                discount={lastTransaction.discount}
                                cashierName={lastTransaction.cashierName}
                                paymentDetails={lastTransaction.paymentDetails}
                                receiptSettings={receiptSettings}
                            />
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex gap-4">
                            <button
                                onClick={() => closeModal('receiptPreview')}
                                className="flex-1 py-3 rounded-lg font-bold border border-gray-300 hover:bg-gray-100 transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <span className="material-icons-round">print</span> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Payment Method Selection Modal */}
            {modals.payment && (
                <POSPaymentModal
                    processPayment={processPayment}
                    loading={loading}
                    totalDue={cartTotal}
                />
            )}



            <header className="flex-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Point of Sale</h1>
                        <p className="text-sm text-text-muted">Fast checkout with barcode and SKU search.</p>
                    </div>
                    {renderModeTabs()}
                </div>
            </header>

            <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
                <POSGrid
                    products={products}
                    plans={plans}
                    trainers={trainers}
                    classPackages={classPackages}
                />
                <POSCart
                    members={members}
                    trainers={trainers}
                    discountOptions={discountOptions}
                    initiateCheckout={initiateCheckout}
                    openReceiptTemplatePreview={openReceiptTemplatePreview}
                />
            </div>
        </div>
    );
}


