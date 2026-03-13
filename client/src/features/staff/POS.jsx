import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
    getBuyerLabel, getMethodLabel, renderStatusBadge
} from './pos/POSUtils';

export default function POS() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();

    // Zustand Store Selectors (Prevents Lag)
    const {
        cart, selectedMemberId, discount,
        modals, paymentDetails, lastTransaction, collectData,
        openModal, closeModal, setCollectField, clearCart
    } = usePOSStore();

    const { discountAmount, couponDiscount, total: cartTotal } = usePOSStore(useShallow(state => state.getTotals()));
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
    const [collectSearch, setCollectSearch] = useState('');
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
                date: new Date().toISOString()
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
    const filteredHistory = history.filter((payment) => {
        if (!historyQuery) return true;

        const buyer = getBuyerLabel(payment);
        const cashier = payment?.cashier?.name || '';
        const method = getMethodLabel(payment?.method);
        const type = payment?.type || '';
        const status = payment?.status || '';
        const amount = payment?.amount ?? '';

        return [buyer, cashier, method, type, status, amount]
            .some((field) => String(field || '').toLowerCase().includes(historyQuery));
    }).filter((payment) => {
        const normalizedStatus = String(payment?.status || 'COMPLETED').toUpperCase();
        const normalizedMethod = String(payment?.method || '').toUpperCase();
        const statusMatches = historyStatusFilter === 'ALL' || normalizedStatus === historyStatusFilter;
        const methodMatches = historyMethodFilter === 'ALL' || normalizedMethod === historyMethodFilter;
        return statusMatches && methodMatches;
    });

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


    const openHistoryView = () => {
        fetchHistory();
        setViewMode('HISTORY');
    };

    const openCollectCashView = () => {
        setViewMode('TRAINING_BOOKINGS');
    };

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
                    <div className="grid gap-3 lg:grid-cols-[1fr,220px,220px]">
                        <label className="relative block">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">search</span>
                            <input
                                type="text"
                                value={historySearch}
                                onChange={(event) => setHistorySearch(event.target.value)}
                                placeholder="Search receipt, buyer, cashier, method, or amount"
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
                    </div>
                </div>

                <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Method</th>
                                <th className="px-6 py-4">Member</th>
                                <th className="px-6 py-4">Cashier</th>
                                <th className="px-6 py-4">Change</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredHistory.length === 0 && (
                                <tr><td colSpan="9" className="p-6 text-center text-text-muted">No transactions found.</td></tr>
                            )}
                            {filteredHistory.map((pay) => (
                                <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-white font-medium">{new Date(pay.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(pay.date).toLocaleTimeString()}</span></td>
                                    <td className="px-6 py-4"><span className="bg-white/10 text-text-secondary px-2 py-1 rounded text-xs font-bold">{pay.type}</span></td>
                                    <td className="px-6 py-4 text-white font-bold">{formatPrice(pay.amount)}</td>
                                    <td className="px-6 py-4 text-text-secondary">{getMethodLabel(pay.method)}</td>
                                    <td className="px-6 py-4 text-white">{getBuyerLabel(pay)}</td>
                                    <td className="px-6 py-4 text-white">{pay.cashier?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 text-white">
                                        {pay.method === 'CASH' ? formatPrice(pay.changeDue || 0) : '-'}
                                    </td>
                                    <td className="px-6 py-4">{renderStatusBadge(pay.status)}</td>
                                    <td className="px-6 py-4">
                                        <a
                                            href={`/pos/transactions/${pay.id}`}
                                            className="text-primary hover:text-orange-400 font-medium text-xs flex items-center gap-1 transition-colors"
                                        >
                                            <span className="material-icons-round text-sm">receipt</span>
                                            View
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
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
                        <table className="w-full table-fixed text-left text-xs text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="px-3 py-2.5">Date</th>
                                    <th className="px-3 py-2.5">Member</th>
                                    <th className="px-3 py-2.5">Amount</th>
                                    <th className="px-3 py-2.5">Status</th>
                                    <th className="w-[132px] px-3 py-2.5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredPendingPurchases.length === 0 && (
                                    <tr><td colSpan="5" className="p-4 text-center text-text-muted">No pending in-app cash purchases found.</td></tr>
                                )}
                                {filteredPendingPurchases.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-3 py-2.5 text-white font-medium align-top">
                                            {new Date(payment.date).toLocaleDateString()} <span className="block text-text-muted font-normal text-[10px]">{new Date(payment.date).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-white truncate align-top">{getBuyerLabel(payment)}</td>
                                        <td className="px-3 py-2.5 text-white font-bold align-top">{formatPrice(payment.amount)}</td>
                                        <td className="px-3 py-2.5 align-top">{renderStatusBadge(payment.status)}</td>
                                        <td className="px-3 py-2.5 align-top">
                                            <div className="flex items-center gap-1 whitespace-nowrap">
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

                    <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
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
                        <table className="w-full table-fixed text-left text-xs text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="px-3 py-2.5">Date</th>
                                    <th className="px-3 py-2.5">Buyer</th>
                                    <th className="px-3 py-2.5">Trainer</th>
                                    <th className="px-3 py-2.5">Duration</th>
                                    <th className="px-3 py-2.5">Amount</th>
                                    <th className="px-3 py-2.5">Status</th>
                                    <th className="w-[132px] px-3 py-2.5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredBookingGroups.length === 0 && (
                                    <tr><td colSpan="7" className="p-4 text-center text-text-muted">No unpaid bookings found.</td></tr>
                                )}
                                {filteredBookingGroups.map((bookingGroup) => (
                                    <tr key={bookingGroup.key} className="hover:bg-white/5 transition-colors">
                                        <td className="px-3 py-2.5 text-white font-medium align-top">
                                            {bookingGroup.firstDate.toLocaleDateString()} <span className="block text-text-muted font-normal text-[10px]">{bookingGroup.firstDate.toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-white truncate align-top">
                                            {bookingGroup.member ? `${bookingGroup.member.firstName} ${bookingGroup.member.lastName}` : 'N/A'}
                                        </td>
                                        <td className="px-3 py-2.5 text-white truncate align-top">{bookingGroup.trainer?.name || 'N/A'}</td>
                                        <td className="px-3 py-2.5 text-white align-top">{bookingGroup.count} session(s) - {bookingGroup.totalDuration} min</td>
                                        <td className="px-3 py-2.5 text-white font-bold align-top">{formatPrice(bookingGroup.totalAmount)}</td>
                                        <td className="px-3 py-2.5 align-top">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">UNPAID</span>
                                        </td>
                                        <td className="px-3 py-2.5 align-top">
                                            <div className="flex items-center gap-1 whitespace-nowrap">
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
                                                                    axios.post(withApiBase(`/api/training-sessions/${sessionId}/decline`), {}, { headers: authHeaders() })
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


