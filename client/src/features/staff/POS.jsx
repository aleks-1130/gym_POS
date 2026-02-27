import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { POS_VIEWS } from '../../constants/categories'; // Added import
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useReactToPrint } from 'react-to-print';
import { useUIStore } from '../../stores/useUIStore';
import Receipt from '../../components/Receipt';
import { withApiBase } from '../../config/api';
import { PAYMENT_METHODS } from '../../config/businessConfig';

import { usePOSStore } from '../../stores/usePOSStore';

export default function POS() {
    const { user } = useAuth();
    const { isSidebarCollapsed } = useUIStore();
    const { formatPrice } = useCurrency();

    // Zustand Store Selectors (Prevents Lag)
    const {
        cart, selectedCategory, selectedMemberId, discount,
        modals, paymentDetails, lastTransaction, collectData, trainerChangeData,
        addToCart, removeFromCart, updateQuantity, setCategory, setSelectedMemberId, setDiscount,
        openModal, closeModal, setPaymentField, setCollectField, setTrainerChangeField, clearCart, updateTrainingDetails
    } = usePOSStore();

    const { subtotal, discountAmount, total: cartTotal } = usePOSStore(useShallow(state => state.getTotals()));


    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [classPackages, setClassPackages] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('POS');

    const [collectCashTab, setCollectCashTab] = useState('BOOKINGS');
    const [history, setHistory] = useState([]);
    const [trainingBookings, setTrainingBookings] = useState([]);
    const [pendingInAppPurchases, setPendingInAppPurchases] = useState([]);

    const [collectLoading, setCollectLoading] = useState(false);
    const [openCalendarLineId, setOpenCalendarLineId] = useState(null);
    const [calendarMonthByLine, setCalendarMonthByLine] = useState({});

    const hasTraining = cart.some(item => item.type === 'TRAINING');
    const hasClassPackages = cart.some(item => item.type === 'CLASS_PACKAGE');

    // Receipt Printing
    const [receiptSettings, setReceiptSettings] = useState(null);
    const receiptRef = useRef();


    const authHeaders = () => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : undefined;
    };

    const normalizeList = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    };

    const extractBookingBatchId = (notes) => {
        const match = String(notes || '').match(/BOOKING_BATCH_ID=([A-Za-z0-9_-]+)/);
        return match ? match[1] : null;
    };

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
        content: () => receiptRef.current,
    });

    useEffect(() => {
        fetchProducts();
        fetchPlans();
        fetchTrainers();
        fetchClassPackages();
        fetchMembers();
        fetchReceiptSettings();
    }, []);

    useEffect(() => {
        if (viewMode !== 'TRAINING_BOOKINGS') return;

        const fetchCollectCashData = async () => {
            await Promise.all([
                fetchTrainingBookings(),
                fetchPendingInAppPurchases()
            ]);
        };

        fetchCollectCashData();
        const intervalId = setInterval(fetchCollectCashData, 10000);
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
        } catch (_) {
            console.error("Failed to fetch products");
            setProducts([]);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans'));
            setPlans(normalizeList(res.data));
        } catch (_) {
            console.error("Failed to fetch plans");
            setPlans([]);
        }
    };

    const fetchTrainers = async () => {
        try {
            const res = await axios.get(withApiBase('/api/trainers'));
            setTrainers(normalizeList(res.data));
        } catch (_) {
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
        } catch (_) {
            console.error("Failed to fetch class session packages");
            setClassPackages([]);
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await axios.get(withApiBase('/api/members'));
            setMembers(normalizeList(res.data));
        } catch (_) {
            console.error("Failed to fetch members");
            setMembers([]);
        }
    }

    const fetchReceiptSettings = async () => {
        try {
            const res = await axios.get(withApiBase('/api/payments/receipt-settings'), {
                headers: authHeaders()
            });
            setReceiptSettings(res.data || null);
        } catch (_) {
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
            console.error("Failed to fetch pending in-app purchases");
            setPendingInAppPurchases([]);
        }
    };

    const formatCartPrice = (amount) => formatPrice(amount);

    // Cart logic now handled by usePOSStore


    const initiateCheckout = () => {
        try {
            console.log("initiateCheckout triggered. Cart:", cart);
            if (cart.length === 0) return;

            const hasTraining = cart.some(item => item.type === 'TRAINING');
            const hasNonTraining = cart.some(item => item.type !== 'TRAINING');

            // Validation for Membership
            const hasPlan = cart.some(item => item.type === 'PLAN');
            if (hasPlan && !selectedMemberId) {
                alert("A Member must be selected when purchasing a Membership Plan.");
                return;
            }
            if (hasTraining && !selectedMemberId) {
                alert("Select a member for trainer booking.");
                return;
            }
            if (hasClassPackages && !selectedMemberId) {
                alert("Select a member for class package purchase.");
                return;
            }

            if (hasTraining) {
                console.log("Validating training sessions...");
                const invalid = cart.some(item => item.type === 'TRAINING' && (!item.date || !item.time || !item.duration));
                if (invalid) {
                    alert("Please complete date, time, and duration for all training sessions.");
                    return;
                }
                const hasPastDateTime = cart.some((item) => {
                    if (item.type !== 'TRAINING') return false;
                    const scheduled = new Date(`${item.date}T${item.time}`);
                    return Number.isNaN(scheduled.getTime()) || scheduled <= new Date();
                });
                if (hasPastDateTime) {
                    alert("Past trainer booking schedule is not allowed.");
                    return;
                }
                const invalidSchedule = cart.some((item) => {
                    if (item.type !== 'TRAINING') return false;
                    const trainer = trainers.find((t) => Number(t.id) === Number(item.trainerId));
                    if (!trainer) {
                        console.error("Trainer not found for item:", item);
                        return true; // Consider invalid if trainer is missing
                    }
                    const slots = getAvailableTimeSlotsForTrainer(trainer, item.date, item.duration);
                    return !slots.includes(item.time);
                });
                if (invalidSchedule) {
                    alert("One or more trainer bookings use unavailable time slots or trainer not found. Please reselect time.");
                    return;
                }
            }

            console.log("Validation passed. Opening payment modal...");
            openModal('payment');
        } catch (error) {
            console.error("Checkout Error:", error);
            alert("A system error occurred during checkout initialization: " + error.message);
        }
    };


    const processPayment = async (method) => {
        setLoading(true);
        try {
            const { amountTendered, gcashReference, gcashDate, gcashTime } = paymentDetails;
            const parsedTendered = method === 'CASH' ? Number(amountTendered) : null;
            if (method === 'CASH' && (!Number.isFinite(parsedTendered) || parsedTendered < cartTotal)) {
                throw new Error("Cash tendered must be a valid amount and at least equal to the total.");
            }

            const tendered = method === 'CASH' ? parsedTendered : null;
            const change = method === 'CASH' ? Number((parsedTendered - cartTotal).toFixed(2)) : null;

            const trainingItems = cart.filter(i => i.type === 'TRAINING');
            const otherItems = cart.filter(i => i.type !== 'TRAINING');
            const memberId = selectedMemberId ? Number(selectedMemberId) : null;

            let mainTransaction = null;
            const externalDate = (gcashDate && gcashTime) ? `${gcashDate}T${gcashTime}` : null;

            // 1. Process Training Items (if any)
            if (trainingItems.length > 0) {
                if (!memberId) throw new Error("Member is required for training sessions");

                for (const item of trainingItems) {
                    const res = await axios.post(withApiBase('/api/staff/book-training'), {
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
                    amount: cartTotal, // This might need careful handling if sub-totals are different, but usually cartTotal is fine for the single swipe
                    type: paymentType,
                    method: method,
                    items: otherItems,
                    discount: discount,
                    memberId: memberId || null,
                    cashTendered: tendered,
                    changeDue: change,
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
            alert("Transaction Failed: " + (e.response?.data?.error || e.message));
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


    const renderStatusBadge = (status) => {
        const value = status || 'COMPLETED';
        const base = "px-2 py-1 rounded text-xs font-bold";
        if (value === 'VOIDED') return <span className={`${base} bg-red-500/10 text-red-400 border border-red-500/20`}>VOIDED</span>;
        if (value === 'RETURNED') return <span className={`${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`}>RETURNED</span>;
        if (value === 'PENDING') return <span className={`${base} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>PENDING</span>;
        return <span className={`${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>COMPLETED</span>;
    };

    const getBuyerLabel = (payment) => {
        if (payment?.member) {
            return `${payment.member.firstName} ${payment.member.lastName}`;
        }
        const cashierRole = String(payment?.cashier?.role || '').toUpperCase();
        if (cashierRole === 'TRAINER' && payment?.cashier?.name) {
            return `${payment.cashier.name} (Trainer)`;
        }
        return 'Walk-in';
    };

    const getMethodLabel = (method) => {
        const normalized = String(method || '').toUpperCase();
        if (normalized === 'COMMISSION_DEDUCTION') return 'Commission Deduction';
        if (normalized === 'GCASH') return 'GCash';
        if (normalized === 'MAYA') return 'Maya';
        if (normalized === 'CARD') return 'Card';
        if (normalized === 'CASH') return 'Cash';
        return method || '-';
    };

    const toIsoDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const toMinutes = (timeString) => {
        const [h, m] = String(timeString || '').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return h * 60 + m;
    };

    const formatTimeLabel = (timeString) => {
        const mins = toMinutes(timeString);
        if (mins === null) return timeString;
        const hour24 = Math.floor(mins / 60);
        const minute = mins % 60;
        const suffix = hour24 >= 12 ? 'PM' : 'AM';
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
    };

    const getTrainerDateWindow = (trainer, isoDate) => {
        if (!trainer || !isoDate) return null;
        if (String(trainer.bookingStatus || 'OPEN').toUpperCase() === 'CLOSED') return null;
        const dateObj = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(dateObj.getTime())) return null;

        const specificDate = trainer.specificDateAvailability?.[isoDate];
        if (specificDate) {
            if (specificDate.available === false) return null;
            return {
                start: specificDate.start || '09:00',
                end: specificDate.end || '18:00'
            };
        }

        const availabilityDays = Array.isArray(trainer.availabilityDays)
            ? trainer.availabilityDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            : [];
        if (availabilityDays.length > 0 && !availabilityDays.includes(dateObj.getDay())) return null;

        const dayKey = String(dateObj.getDay());
        const dayConfig = trainer.availabilityByDay?.[dayKey];
        return {
            start: dayConfig?.start || trainer.availabilityStart || '09:00',
            end: dayConfig?.end || trainer.availabilityEnd || '18:00'
        };
    };

    const getAvailableTimeSlotsForTrainer = (trainer, isoDate, duration) => {
        if (!trainer || !isoDate || !duration) return [];
        const dateObj = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(dateObj.getTime())) return [];

        const window = getTrainerDateWindow(trainer, isoDate);
        if (!window) return [];
        const interval = Number(trainer.availabilityIntervalMinutes) || 30;
        const start = toMinutes(window.start);
        const end = toMinutes(window.end);
        if (start === null || end === null || end <= start) return [];

        const bookedSessions = (trainer.trainingSessions || [])
            .filter((session) => {
                if (session.status === 'CANCELLED') return false;
                const sessionDate = new Date(session.date);
                return toIsoDate(sessionDate) === isoDate;
            })
            .map((session) => {
                const sessionDate = new Date(session.date);
                const sessionStart = sessionDate.getHours() * 60 + sessionDate.getMinutes();
                return {
                    start: sessionStart,
                    end: sessionStart + (Number(session.duration) || 60)
                };
            });

        const resolvedDuration = Number(duration) || 60;
        const slots = [];
        const todayIso = toIsoDate(new Date());
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        for (let t = start; t + resolvedDuration <= end; t += interval) {
            const slotStart = t;
            const slotEnd = t + resolvedDuration;
            if (isoDate === todayIso && slotStart <= nowMinutes) {
                continue;
            }
            const blocked = bookedSessions.some((session) => slotStart < session.end && slotEnd > session.start);
            if (!blocked) {
                const hh = String(Math.floor(t / 60)).padStart(2, '0');
                const mm = String(t % 60).padStart(2, '0');
                slots.push(`${hh}:${mm}`);
            }
        }
        return slots;
    };

    const getAvailableDatesForTrainer = (trainer, daysAhead = 45) => {
        if (!trainer) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dates = [];
        for (let i = 0; i <= daysAhead; i += 1) {
            const current = new Date(today);
            current.setDate(today.getDate() + i);
            const iso = toIsoDate(current);
            const window = getTrainerDateWindow(trainer, iso);
            const start = window ? toMinutes(window.start) : null;
            const end = window ? toMinutes(window.end) : null;
            if (window && start !== null && end !== null && end > start) dates.push(iso);
        }
        return dates;
    };

    const isTrainerDateAvailable = (trainer, isoDate) => {
        if (!trainer || !isoDate) return false;
        return getAvailableDatesForTrainer(trainer).includes(isoDate);
    };

    const getCalendarMonthForLine = (lineId) => {
        const now = new Date();
        return calendarMonthByLine[lineId] || new Date(now.getFullYear(), now.getMonth(), 1);
    };

    const shiftCalendarMonthForLine = (lineId, delta) => {
        setCalendarMonthByLine((prev) => {
            const current = getCalendarMonthForLine(lineId);
            const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
            return { ...prev, [lineId]: next };
        });
    };

    const getCalendarCells = (monthDate) => {
        const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        const leading = start.getDay();
        const cells = [];
        for (let i = 0; i < leading; i += 1) cells.push(null);
        for (let d = 1; d <= end.getDate(); d += 1) {
            cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
        }
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    };


    const filteredProducts = selectedCategory === 'All'
        ? products
        : products.filter(p => p.category === selectedCategory);

    // Combine Products and Plans for display if category is Memberships
    const displayItems = selectedCategory === POS_VIEWS.MEMBERSHIP
        ? plans
        : selectedCategory === POS_VIEWS.TRAINERS
            ? trainers
            : selectedCategory === POS_VIEWS.PACKAGES
                ? classPackages
                : filteredProducts;
    const safeDisplayItems = Array.isArray(displayItems) ? displayItems : [];

    if (viewMode === 'HISTORY') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-white">Transaction History</h1>
                    <button onClick={() => setViewMode('POS')} className="text-primary hover:text-orange-400 font-bold flex items-center gap-1">
                        <span className="material-icons-round">arrow_back</span> Back to POS
                    </button>
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
                            {history.length === 0 && (
                                <tr><td colSpan="9" className="p-6 text-center text-text-muted">No transactions found.</td></tr>
                            )}
                            {history.map(pay => (
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
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-white">Collect Cash</h1>
                    <button onClick={() => setViewMode('POS')} className="text-primary hover:text-orange-400 font-bold flex items-center gap-1">
                        <span className="material-icons-round">arrow_back</span> Back to POS
                    </button>
                </div>

                <div className="bg-surface rounded-2xl border border-white/10 p-2 inline-flex gap-2">
                    <button
                        type="button"
                        onClick={() => setCollectCashTab('BOOKINGS')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${collectCashTab === 'BOOKINGS'
                            ? 'bg-primary text-background'
                            : 'text-text-secondary hover:text-white bg-white/5'
                            }`}
                    >
                        Bookings
                    </button>
                    <button
                        type="button"
                        onClick={() => setCollectCashTab('IN_APP_PURCHASES')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${collectCashTab === 'IN_APP_PURCHASES'
                            ? 'bg-primary text-background'
                            : 'text-text-secondary hover:text-white bg-white/5'
                            }`}
                    >
                        In App Purchases
                    </button>
                </div>

                {collectCashTab === 'BOOKINGS' && (
                    <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Buyer</th>
                                    <th className="px-6 py-4">Trainer</th>
                                    <th className="px-6 py-4">Duration</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {groupedTrainingBookings.length === 0 && (
                                    <tr><td colSpan="7" className="p-6 text-center text-text-muted">No unpaid bookings found.</td></tr>
                                )}
                                {groupedTrainingBookings.map((bookingGroup) => (
                                    <tr key={bookingGroup.key} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">
                                            {bookingGroup.firstDate.toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{bookingGroup.firstDate.toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {bookingGroup.member ? `${bookingGroup.member.firstName} ${bookingGroup.member.lastName}` : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-white">{bookingGroup.trainer?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-white">{bookingGroup.count} session(s) � {bookingGroup.totalDuration} min</td>
                                        <td className="px-6 py-4 text-white font-bold">{formatPrice(bookingGroup.totalAmount)}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">UNPAID</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        openModal('collectCash', bookingGroup);
                                                    }}
                                                    className="text-xs font-bold px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm(`Decline ${bookingGroup.count} booking(s)?`)) return;
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
                                                            alert(detail ? `${message}\n\nDetails: ${detail}` : message);
                                                        }
                                                    }}
                                                    className="text-xs font-bold px-3 py-1 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
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

                {collectCashTab === 'IN_APP_PURCHASES' && (
                    <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Member</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pendingInAppPurchases.length === 0 && (
                                    <tr><td colSpan="6" className="p-6 text-center text-text-muted">No pending in-app cash purchases found.</td></tr>
                                )}
                                {pendingInAppPurchases.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">
                                            {new Date(payment.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(payment.date).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-white">{getBuyerLabel(payment)}</td>
                                        <td className="px-6 py-4 text-white">{payment.type}</td>
                                        <td className="px-6 py-4 text-white font-bold">{formatPrice(payment.amount)}</td>
                                        <td className="px-6 py-4">{renderStatusBadge(payment.status)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        openModal('collectPurchase', payment);
                                                    }}
                                                    className="text-xs font-bold px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm('Decline this pending cash purchase?')) return;
                                                        try {
                                                            await axios.post(withApiBase(`/api/payments/${payment.id}/decline-cash`), {}, { headers: authHeaders() });
                                                            await Promise.all([fetchPendingInAppPurchases(), fetchHistory()]);
                                                        } catch (e) {
                                                            alert(e.response?.data?.error || "Failed to decline payment");
                                                        }
                                                    }}
                                                    className="text-xs font-bold px-3 py-1 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
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

                {modals.collectCash && collectData.session && (
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
                                            setCollectLoading(true);
                                            try {
                                                await axios.post(withApiBase('/api/staff/training-sessions/collect-batch'), {
                                                    sessionIds: collectData.session.sessionIds || [collectData.session.id],
                                                    method: 'CASH',
                                                    cashTendered: parseFloat(collectData.tendered)
                                                }, { headers: authHeaders() });
                                                await fetchTrainingBookings();
                                                await fetchHistory();
                                                closeModal('collectCash');
                                            } catch (e) {
                                                alert("Failed to collect payment");
                                            } finally {
                                                setCollectLoading(false);
                                            }
                                        }}
                                        disabled={collectLoading || (parseFloat(collectData.tendered) || 0) < (collectData.session.totalAmount || collectData.session.price || 0)}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                                    >
                                        {collectLoading ? 'Collecting...' : 'Collect'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {modals.collectPurchase && collectData.purchase && (
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
                                            setCollectLoading(true);
                                            try {
                                                await axios.post(withApiBase(`/api/payments/${collectData.purchase.id}/collect-cash`), {
                                                    cashTendered: parseFloat(collectData.tendered)
                                                }, { headers: authHeaders() });
                                                await Promise.all([fetchPendingInAppPurchases(), fetchHistory()]);
                                                closeModal('collectPurchase');
                                            } catch (e) {
                                                alert(e.response?.data?.error || "Failed to collect payment");
                                            } finally {
                                                setCollectLoading(false);
                                            }
                                        }}
                                        disabled={collectLoading || (parseFloat(collectData.tendered) || 0) < collectData.purchase.amount}
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                                    >
                                        {collectLoading ? 'Collecting...' : 'Collect'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] gap-6 overflow-hidden relative">

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
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-up">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Select Payment Method</h2>
                            <p className="text-text-muted">Total Amount Due</p>
                            <p className="text-4xl font-bold text-primary mt-1">{formatCartPrice(cartTotal)}</p>
                        </div>

                        {!paymentDetails.method ? (
                            <div className="grid grid-cols-2 gap-4">
                                {PAYMENT_METHODS.filter(m => m.value !== 'LOYALTY_POINTS').map((method) => (
                                    <button
                                        key={method.value}
                                        onClick={() => {
                                            if (['CASH', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method.value)) {
                                                setPaymentField('method', method.value);
                                            } else {
                                                processPayment(method.value);
                                            }
                                        }}
                                        disabled={loading}
                                        className={`p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-[1.02] text-white
                                            ${method.value === 'CASH' ? 'bg-green-600 hover:bg-green-700' :
                                                method.value === 'GCASH' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                                    method.value === 'PAYMAYA' ? 'bg-blue-600 hover:bg-blue-700' :
                                                        'bg-indigo-600 hover:bg-indigo-700'}`}
                                    >
                                        {loading && !['CASH', 'GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(method.value) ? (
                                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <span className="material-icons-round text-4xl">{method.icon}</span>
                                                <span className="font-bold text-lg uppercase">{method.label}</span>
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* E-Wallet / Card / Bank Transfer Details */}
                                {['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(paymentDetails.method) && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-text-muted text-sm font-medium mb-2">
                                                {paymentDetails.method === 'CARD' ? 'Terminal / Reference ID' :
                                                    paymentDetails.method === 'GCASH' ? 'GCash Reference ID' :
                                                        paymentDetails.method === 'PAYMAYA' ? 'PayMaya Reference ID' :
                                                            'Bank Reference ID'}
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base font-bold focus:border-primary outline-none"
                                                placeholder={paymentDetails.method === 'CARD' ? "Enter terminal transaction ID" : "Enter transaction reference ID"}
                                                value={paymentDetails.gcashReference}
                                                onChange={(e) => setPaymentField('gcashReference', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-text-muted text-sm font-medium mb-2">Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base focus:border-primary outline-none"
                                                    value={paymentDetails.gcashDate}
                                                    onChange={(e) => setPaymentField('gcashDate', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-text-muted text-sm font-medium mb-2">Time</label>
                                                <input
                                                    type="time"
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base focus:border-primary outline-none"
                                                    value={paymentDetails.gcashTime}
                                                    onChange={(e) => setPaymentField('gcashTime', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {paymentDetails.method === 'CASH' && (
                                    <>
                                        <div>
                                            <label className="block text-text-muted text-sm font-medium mb-2">Amount Tendered</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold">₱</span>
                                                <input
                                                    type="number"
                                                    autoFocus
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 pl-8 pr-4 text-white text-xl font-bold focus:border-green-500 outline-none"
                                                    placeholder="0.00"
                                                    value={paymentDetails.amountTendered}
                                                    onChange={(e) => setPaymentField('amountTendered', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                            <span className="text-text-secondary">Change Due:</span>
                                            <span className={`text-2xl font-bold ${(parseFloat(paymentDetails.amountTendered) || 0) >= cartTotal ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatPrice(Math.max(0, (parseFloat(paymentDetails.amountTendered) || 0) - cartTotal))}
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setPaymentField('method', '')}
                                        className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => processPayment(paymentDetails.method)}
                                        disabled={
                                            (paymentDetails.method === 'CASH' && (parseFloat(paymentDetails.amountTendered) || 0) < cartTotal) ||
                                            (['GCASH', 'PAYMAYA', 'BANK_TRANSFER', 'CARD'].includes(paymentDetails.method) && (!paymentDetails.gcashReference || !paymentDetails.gcashDate || !paymentDetails.gcashTime))
                                        }
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                        Complete Sale
                                    </button>
                                </div>
                            </div>
                        )}

                        {!paymentDetails.method && (
                            <button
                                onClick={() => closeModal('payment')}
                                className="w-full mt-6 py-3 text-text-muted hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            )}


            {/* Left: Product Grid */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="mb-6 flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Touch-First POS</h1>
                        <p className="text-text-muted text-sm">Select items to add to cart</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <button onClick={() => { fetchHistory(); setViewMode('HISTORY'); }} className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors">
                            <span className="material-icons-round">history</span> History
                        </button>
                        <button onClick={() => { setCollectCashTab('BOOKINGS'); setViewMode('TRAINING_BOOKINGS'); }} className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors">
                            <span className="material-icons-round">payments</span> Collect Cash
                        </button>
                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-2 bg-surface p-1 rounded-xl border border-white/10">
                            {['All', ...Object.values(POS_VIEWS)].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                        ? 'bg-primary/10 text-primary shadow-sm'
                                        : 'text-text-muted hover:text-text-secondary'
                                        }`}
                                >
                                    {cat === POS_VIEWS.TRAINERS ? 'TRAINERS' : cat}
                                </button>
                            ))}
                        </div>

                    </div>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-20 pr-2 scrollbar-hide">
                    {safeDisplayItems.length === 0 && (
                        <div className="col-span-full text-center text-text-muted py-10">No items found in this category.</div>
                    )}
                    {safeDisplayItems.map(item => {
                        const isTrainer = selectedCategory === 'TRAINERS';
                        const isPackage = selectedCategory === 'PACKAGES';
                        const isSoldOut = !isTrainer && !isPackage && selectedCategory !== 'MEMBERSHIP' && item.stock <= 0;
                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (isSoldOut) return;
                                    if (isTrainer) {
                                        addToCart({
                                            ...item,
                                            trainerId: item.id,
                                            price: item.sessionPrice ?? 0,
                                            duration: Number(item.sessionDurations?.split(',')[0]?.trim()) || 60
                                        }, 'TRAINING');
                                    } else if (isPackage) {
                                        addToCart(item, 'CLASS_PACKAGE');
                                    } else {
                                        addToCart(item, selectedCategory === POS_VIEWS.MEMBERSHIP ? 'PLAN' : 'PRODUCT');
                                    }
                                }}
                                className={`group bg-surface hover:bg-primary/5 rounded-3xl p-3 cursor-pointer transition-all duration-300 border border-white/5 hover:border-primary/20 shadow-sm hover:shadow-primary/10 active:scale-95 ${selectedCategory === POS_VIEWS.MEMBERSHIP ? 'ring-1 ring-yellow-500/30' : ''} ${isSoldOut ? 'opacity-70 grayscale-[0.5] cursor-not-allowed' : ''}`}
                            >
                                <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-3 relative bg-white/5">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-text-muted group-hover:text-primary/50 transition-colors">
                                            <span className="material-icons-round text-4xl">{selectedCategory === POS_VIEWS.MEMBERSHIP ? 'card_membership' : isTrainer ? 'person' : isPackage ? 'redeem' : 'inventory_2'}</span>
                                        </div>
                                    )}

                                    {/* Sold Out Overlay */}
                                    {isSoldOut && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                                            <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg border border-red-400/50 uppercase tracking-widest">Sold Out</span>
                                        </div>
                                    )}

                                    {/* Stock Badge */}
                                    {item.stock !== undefined && !isTrainer && !isPackage && (
                                        <div className={`absolute top-2 left-2 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg border shadow-sm z-20 ${item.stock <= 5 ? 'bg-red-500/80 border-red-400/50' : 'bg-surface/80 border-white/10'
                                            }`}>
                                            {item.stock} In Stock
                                        </div>
                                    )}

                                    {selectedCategory === POS_VIEWS.MEMBERSHIP && (
                                        <div className="absolute top-2 right-2 bg-yellow-500/90 backdrop-blur-sm text-black text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                                            {item.duration} Days
                                        </div>
                                    )}
                                    {isTrainer && (
                                        <div className="absolute top-2 right-2 bg-emerald-500/90 backdrop-blur-sm text-black text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                                            {item.availableSlots ?? 0} slots
                                        </div>
                                    )}
                                    {isPackage && (
                                        <div className="absolute top-2 right-2 bg-blue-500/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                                            {item.sessions ?? 0} sessions
                                        </div>
                                    )}
                                </div>
                                <div className="px-1 mt-2">
                                    <h3 className="text-white font-bold truncate text-sm">{item.name}</h3>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-primary font-bold">
                                            {isTrainer ? formatPrice(item.sessionPrice ?? 0, true) : formatPrice(item.price)}
                                        </p>
                                        {item.category && !isTrainer && !isPackage && (
                                            <span className="text-[10px] text-text-muted uppercase font-bold tracking-tighter bg-white/5 px-1.5 py-0.5 rounded">
                                                {item.category}
                                            </span>
                                        )}
                                        {isTrainer && (
                                            <span className="text-[10px] text-text-muted uppercase font-bold tracking-tighter bg-white/5 px-1.5 py-0.5 rounded">
                                                Trainer
                                            </span>
                                        )}
                                        {isPackage && (
                                            <span className="text-[10px] text-text-muted uppercase font-bold tracking-tighter bg-white/5 px-1.5 py-0.5 rounded">
                                                Package
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right: Cart Panel */}
            <div className={`${isSidebarCollapsed ? 'w-96' : 'w-[320px]'} transition-all duration-300 flex flex-col bg-surface rounded-3xl border border-white/10 shadow-xl shadow-black/50 overflow-hidden`}>
                {/* Cart Header */}
                <div className="p-6 border-b border-white/5 bg-white/5">
                    <div className="flex justify-between items-center mb-1">
                        <h2 className="text-white font-bold text-lg">Current Cart</h2>
                        <span className="material-icons-round text-text-muted">shopping_bag</span>
                    </div>

                    {/* Member Selector */}
                    <div className="mt-4">
                        <select
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                        >
                            <option value="">Guest / Walk-in</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-text-muted mt-2 ml-1 justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedMemberId ? 'bg-emerald-500' : 'bg-gray-600'}`}></span>
                            <span>{selectedMemberId ? 'Member Linked' : 'No Member Linked'}</span>
                        </div>
                        {selectedMemberId && (
                            <div className="text-orange-400 font-bold">
                                {members.find(m => m.id === Number(selectedMemberId))?.points || 0} PTS
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-text-muted">
                            <span className="material-icons-round text-6xl mb-4 bg-white/5 p-4 rounded-full">shopping_cart_checkout</span>
                            <p className="font-medium text-text-muted">Cart is empty</p>
                        </div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={item.cartLineId || `${item.id}-${idx}`} className="p-3 hover:bg-white/5 rounded-2xl group transition-colors border border-transparent hover:border-white/5">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-white font-bold text-sm">
                                            {item.name}
                                            {item.type === 'PLAN' && <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/30">PLAN</span>}
                                            {item.type === 'TRAINING' && <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">TRAINER</span>}
                                            {item.type === 'CLASS_PACKAGE' && <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">PACKAGE</span>}
                                        </p>
                                        {item.type !== 'TRAINING' && (
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartLineId, item.quantity - 1, item.stock); }}
                                                    className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                                                >
                                                    <span className="material-icons-round text-xs">remove</span>
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-10 bg-transparent text-center text-text-muted text-sm font-medium focus:text-white outline-none border-b border-transparent focus:border-white/30 transition-colors"
                                                    value={item.quantity}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => updateQuantity(item.cartLineId, Math.max(1, parseInt(e.target.value) || 1), item.stock)}
                                                />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartLineId, item.quantity + 1, item.stock); }}
                                                    className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                                                >
                                                    <span className="material-icons-round text-xs">add</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-white font-bold text-sm">{formatCartPrice(item.price * item.quantity)}</p>
                                            <p className="text-text-muted text-[10px]">{formatCartPrice(item.price)} each</p>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartLineId); }}
                                            className="w-6 h-6 flex items-center justify-center bg-white/10 text-text-muted hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <span className="material-icons-round text-[14px]">close</span>
                                        </button>
                                    </div>
                                </div>

                                {item.type === 'TRAINING' && (
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                        <div className="col-span-2">
                                            <button
                                                type="button"
                                                onClick={() => setOpenCalendarLineId(openCalendarLineId === item.cartLineId ? null : item.cartLineId)}
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1.5 text-white text-left"
                                            >
                                                {item.date
                                                    ? new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                                                    : 'Select Date'}
                                            </button>
                                            {openCalendarLineId === item.cartLineId && (
                                                <div className="mt-2 bg-surfaceHighlight border border-white/10 rounded-xl p-2">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => shiftCalendarMonthForLine(item.cartLineId, -1)}
                                                            className="w-7 h-7 rounded bg-white/10 text-white"
                                                        >
                                                            <span className="material-icons-round text-sm">chevron_left</span>
                                                        </button>
                                                        <span className="text-[11px] text-white font-semibold">
                                                            {getCalendarMonthForLine(item.cartLineId).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => shiftCalendarMonthForLine(item.cartLineId, 1)}
                                                            className="w-7 h-7 rounded bg-white/10 text-white"
                                                        >
                                                            <span className="material-icons-round text-sm">chevron_right</span>
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-7 gap-1 mb-1">
                                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                                                            <div key={`${d}-${idx}`} className="text-[10px] text-center text-text-muted">{d}</div>
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-7 gap-1">
                                                        {(() => {
                                                            const month = getCalendarMonthForLine(item.cartLineId);
                                                            const cells = getCalendarCells(month);
                                                            const trainer = trainers.find(t => Number(t.id) === Number(item.trainerId));
                                                            const todayIso = toIsoDate(new Date());
                                                            return cells.map((day, idx) => {
                                                                if (!day) return <div key={`blank-${idx}`} className="h-7" />;
                                                                const iso = toIsoDate(day);
                                                                const isPast = iso < todayIso;
                                                                const unavailable = !isTrainerDateAvailable(trainer, iso);
                                                                const selected = item.date === iso;
                                                                return (
                                                                    <button
                                                                        key={iso}
                                                                        type="button"
                                                                        disabled={isPast || unavailable}
                                                                        onClick={() => {
                                                                            const lineTrainer = trainers.find(t => Number(t.id) === Number(item.trainerId));
                                                                            const slots = getAvailableTimeSlotsForTrainer(lineTrainer, iso, item.duration);
                                                                            updateTrainingDetails(item.cartLineId, 'date', iso);
                                                                            updateTrainingDetails(item.cartLineId, 'time', slots.includes(item.time) ? item.time : '');
                                                                            setOpenCalendarLineId(null);
                                                                        }}
                                                                        className={`h-7 rounded text-[10px] font-semibold ${selected
                                                                            ? 'bg-primary text-background'
                                                                            : (isPast || unavailable)
                                                                                ? 'bg-white/5 text-text-muted/40 cursor-not-allowed'
                                                                                : 'bg-white/5 text-white hover:bg-white/10'
                                                                            }`}
                                                                    >
                                                                        {day.getDate()}
                                                                    </button>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <select
                                            className="bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1.5 text-white"
                                            value={item.time}
                                            onChange={(e) => updateTrainingDetails(item.cartLineId, 'time', e.target.value)}
                                            disabled={!item.date}
                                        >
                                            <option value="">{item.date ? 'Select Time' : 'Select Date First'}</option>
                                            {(() => {
                                                const trainer = trainers.find(t => Number(t.id) === Number(item.trainerId));
                                                const slots = item.date ? getAvailableTimeSlotsForTrainer(trainer, item.date, item.duration) : [];
                                                return slots.map(slot => (
                                                    <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                                                ));
                                            })()}
                                        </select>
                                        <select
                                            className="bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1.5 text-white"
                                            value={item.duration}
                                            onChange={(e) => {
                                                const nextDuration = Number(e.target.value);
                                                const trainer = trainers.find(t => Number(t.id) === Number(item.trainerId));
                                                const slots = item.date ? getAvailableTimeSlotsForTrainer(trainer, item.date, nextDuration) : [];
                                                updateTrainingDetails(item.cartLineId, 'duration', nextDuration);
                                                updateTrainingDetails(item.cartLineId, 'time', slots.includes(item.time) ? item.time : '');
                                            }}
                                        >
                                            {(trainers.find(t => Number(t.id) === Number(item.trainerId))?.sessionDurations || '60')
                                                .split(',')
                                                .map((d) => Number(String(d).trim()))
                                                .filter((d) => Number.isFinite(d) && d > 0)
                                                .map((d) => (
                                                    <option key={d} value={d}>{d} min</option>
                                                ))}
                                        </select>
                                        <input
                                            type="text"
                                            className="bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1.5 text-white"
                                            placeholder="Notes"
                                            value={item.notes || ''}
                                            onChange={(e) => updateTrainingDetails(item.cartLineId, 'notes', e.target.value)}
                                        />
                                    </div>

                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Checkout Footer */}
                <div className="p-6 border-t border-white/5 bg-surfaceHighlight/50 backdrop-blur-sm">
                    <div className="flex justify-between items-end mb-2 text-text-secondary text-sm font-medium">
                        <span>Subtotal</span>
                        <span>{formatCartPrice(subtotal)}</span>
                    </div>

                    {/* Discount Input */}
                    <div className="mb-6 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary text-sm font-medium">Discount (%)</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-24 bg-surfaceHighlight border border-white/10 rounded-lg px-2 py-1 text-right text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={discount}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setDiscount(Math.min(100, Math.max(0, val)));
                                }}
                            />
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between items-center text-xs text-green-400">
                                <span>Less</span>
                                <span>-{formatPrice(discountAmount)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-end mb-6">
                        <span className="text-white font-bold text-lg">Total</span>
                        <span className="text-3xl font-bold text-white">{formatCartPrice(cartTotal)}</span>
                    </div>

                    <button
                        onClick={openReceiptTemplatePreview}
                        className="w-full mb-3 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl transition-colors"
                    >
                        Preview Receipt Layout
                    </button>

                    <button
                        onClick={initiateCheckout}
                        disabled={cart.length === 0 || loading}
                        className="w-full bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex flex-col items-center justify-center"
                    >
                        <span className="text-[10px] uppercase tracking-wider opacity-90 font-bold mb-0.5">Charge {selectedMemberId ? 'Member' : 'Guest'}</span>
                        <span className="text-lg">{formatCartPrice(cartTotal)}</span>
                    </button>
                </div>
            </div>

        </div>
    );
}



