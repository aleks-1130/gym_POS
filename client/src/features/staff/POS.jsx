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
import { useConfirm } from '../../context/ConfirmContext';

export default function POS() {
    const { user } = useAuth();
    const { isSidebarCollapsed } = useUIStore();
    const { formatPrice } = useCurrency();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();

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
    const [discountOptions, setDiscountOptions] = useState([]);
    const [selectedDiscountPresetId, setSelectedDiscountPresetId] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('POS');
    const [catalogView, setCatalogView] = useState('GRID');
    const [productSearch, setProductSearch] = useState('');
    const [barcodeQuantityModal, setBarcodeQuantityModal] = useState({ open: false, item: null, quantity: '1' });
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
    const [historyMethodFilter, setHistoryMethodFilter] = useState('ALL');
    const [collectSearch, setCollectSearch] = useState('');
    const [history, setHistory] = useState([]);
    const [trainingBookings, setTrainingBookings] = useState([]);
    const [pendingInAppPurchases, setPendingInAppPurchases] = useState([]);

    const [collectLoading, setCollectLoading] = useState(false);
    const [openCalendarLineId, setOpenCalendarLineId] = useState(null);
    const [calendarMonthByLine, setCalendarMonthByLine] = useState({});
    const lastAutoBarcodeMatchRef = useRef('');

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

    useEffect(() => {
        if (!selectedDiscountPresetId) return;
        const exists = discountOptions.some((preset) => preset.id === selectedDiscountPresetId);
        if (!exists) {
            setSelectedDiscountPresetId('');
            setDiscount(0);
        }
    }, [discountOptions, selectedDiscountPresetId, setDiscount]);

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
        } catch (_) {
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


    const initiateCheckout = async () => {
        try {
            console.log("initiateCheckout triggered. Cart:", cart);
            if (cart.length === 0) return;

            const hasTraining = cart.some(item => item.type === 'TRAINING');
            const hasNonTraining = cart.some(item => item.type !== 'TRAINING');

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
            setSelectedDiscountPresetId('');
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

    const isTrainerTemporarilyOpenForDate = (trainer, isoDate) => {
        if (!trainer || !isoDate) return false;
        return Boolean(trainer.temporarilyOpenToday) && isoDate === toIsoDate(new Date());
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
        const isClosed = String(trainer.bookingStatus || 'OPEN').toUpperCase() === 'CLOSED';
        if (isClosed && !isTrainerTemporarilyOpenForDate(trainer, isoDate)) return null;
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
        : products.filter((product) => product.category === selectedCategory);

    const displayItems = selectedCategory === POS_VIEWS.MEMBERSHIP
        ? plans
        : selectedCategory === POS_VIEWS.TRAINERS
            ? trainers
            : selectedCategory === POS_VIEWS.PACKAGES
                ? classPackages
                : filteredProducts;
    const safeDisplayItems = Array.isArray(displayItems) ? displayItems : [];

    const catalogQuery = String(productSearch || '').trim().toLowerCase();
    const searchedDisplayItems = safeDisplayItems.filter((item) => {
        if (!catalogQuery) return true;

        const searchFields = [
            item?.name,
            item?.description,
            item?.category,
            item?.barcode,
            item?.sku,
            item?.code,
            item?.type,
            item?.duration,
            item?.sessions,
            item?.sessionPrice
        ];

        return searchFields.some((field) => String(field || '').toLowerCase().includes(catalogQuery));
    });

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

    const categoryTabs = ['All', ...Object.values(POS_VIEWS)];
    const selectedDiscountPreset = discountOptions.find((preset) => preset.id === selectedDiscountPresetId) || null;
    const collectNotificationCount = groupedTrainingBookings.length + pendingInAppPurchases.length;
    const collectNotificationLabel = collectNotificationCount > 99 ? '99+' : String(collectNotificationCount);
    const commonInputClass = "w-full rounded-xl border border-white/10 bg-surface px-10 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary";
    const commonSelectClass = "w-full rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary";
    const getItemImageSrc = (item) => item?.imageUrl || item?.image || item?.photoUrl || item?.avatarUrl || '';

    const applyDiscountPreset = (presetId) => {
        if (!presetId) {
            setSelectedDiscountPresetId('');
            setDiscount(0);
            return;
        }
        const preset = discountOptions.find((item) => item.id === presetId);
        if (!preset) {
            setSelectedDiscountPresetId('');
            setDiscount(0);
            return;
        }
        setSelectedDiscountPresetId(preset.id);
        setDiscount(Number(preset.rate));
    };

    const handleAddCatalogItem = async (item) => {
        const isTrainer = selectedCategory === POS_VIEWS.TRAINERS;
        const isPackage = selectedCategory === POS_VIEWS.PACKAGES;
        const isSoldOut = !isTrainer && !isPackage && selectedCategory !== POS_VIEWS.MEMBERSHIP && Number(item?.stock || 0) <= 0;
        if (isSoldOut) return;

        let result;
        if (isTrainer) {
            result = addToCart({
                ...item,
                trainerId: item.id,
                price: item.sessionPrice ?? 0,
                duration: Number(item.sessionDurations?.split(',')[0]?.trim()) || 60
            }, 'TRAINING');
        } else if (isPackage) {
            result = addToCart(item, 'CLASS_PACKAGE');
        } else {
            result = addToCart(item, selectedCategory === POS_VIEWS.MEMBERSHIP ? 'PLAN' : 'PRODUCT');
        }

        if (result && !result.success && result.error) {
            await showAlert({ title: 'Cannot Add Item', message: result.error, type: 'warning' });
        }
    };

    const closeBarcodeQuantityModal = () => {
        lastAutoBarcodeMatchRef.current = '';
        setProductSearch('');
        setBarcodeQuantityModal({ open: false, item: null, quantity: '1' });
    };

    const findProductByBarcodeOrSku = (rawQuery) => {
        const normalized = String(rawQuery || '').trim().toLowerCase();
        if (!normalized) return null;
        return products.find((product) => {
            const barcode = String(product?.barcode || '').trim().toLowerCase();
            const sku = String(product?.sku || '').trim().toLowerCase();
            const code = String(product?.code || '').trim().toLowerCase();
            return barcode === normalized || sku === normalized || code === normalized;
        }) || null;
    };

    const openBarcodeQuantityModalForProduct = async (matchedProduct) => {
        if (!matchedProduct || barcodeQuantityModal.open) return;
        const stockValue = Number(matchedProduct?.stock);
        if (Number.isFinite(stockValue) && stockValue <= 0) {
            await showAlert({ title: 'Sold Out', message: `${matchedProduct.name} has no stock left.`, type: 'warning' });
            return;
        }

        setBarcodeQuantityModal({
            open: true,
            item: matchedProduct,
            quantity: '1'
        });
    };

    const handleCatalogSearchKeyDown = async (event) => {
        if (event.key !== 'Enter') return;
        const matchedProduct = findProductByBarcodeOrSku(productSearch);
        if (!matchedProduct) return;
        event.preventDefault();
        await openBarcodeQuantityModalForProduct(matchedProduct);
    };

    const confirmBarcodeQuantityAdd = async () => {
        const targetItem = barcodeQuantityModal.item;
        const requestedQty = Math.max(1, Number.parseInt(barcodeQuantityModal.quantity, 10) || 1);
        if (!targetItem) return;

        const existingLine = cart.find((entry) => entry.id === targetItem.id && entry.type === 'PRODUCT');
        const existingQty = Number(existingLine?.quantity || 0);
        const stockLimit = Number(targetItem?.stock || 0);
        if (Number.isFinite(stockLimit) && stockLimit > 0 && existingQty + requestedQty > stockLimit) {
            await showAlert({
                title: 'Stock Limit',
                message: `Only ${stockLimit} stocks are available for ${targetItem.name}.`,
                type: 'warning'
            });
            return;
        }

        for (let index = 0; index < requestedQty; index += 1) {
            const result = addToCart(targetItem, 'PRODUCT');
            if (result && !result.success && result.error) {
                await showAlert({ title: 'Cannot Add Item', message: result.error, type: 'warning' });
                break;
            }
        }

        setProductSearch('');
        closeBarcodeQuantityModal();
    };

    useEffect(() => {
        if (viewMode !== 'POS') return;
        const normalizedQuery = String(productSearch || '').trim().toLowerCase();
        if (!normalizedQuery) {
            lastAutoBarcodeMatchRef.current = '';
            return;
        }
        if (barcodeQuantityModal.open) return;

        const matchedProduct = findProductByBarcodeOrSku(normalizedQuery);
        if (!matchedProduct) return;

        const autoMatchToken = `${matchedProduct.id}:${normalizedQuery}`;
        if (lastAutoBarcodeMatchRef.current === autoMatchToken) return;
        lastAutoBarcodeMatchRef.current = autoMatchToken;
        void openBarcodeQuantityModalForProduct(matchedProduct);
    }, [productSearch, products, barcodeQuantityModal.open, viewMode]);

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
                                                    await showAlert({ title: 'Collection Failed', message: 'Failed to collect payment', type: 'danger' });
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
                                                setCollectLoading(true);
                                                try {
                                                    await axios.post(withApiBase(`/api/payments/${collectData.purchase.id}/collect-cash`), {
                                                        cashTendered: parseFloat(collectData.tendered)
                                                    }, { headers: authHeaders() });
                                                    await Promise.all([fetchPendingInAppPurchases(), fetchHistory()]);
                                                    closeModal('collectPurchase');
                                                } catch (e) {
                                                    await showAlert({ title: 'Collection Failed', message: e.response?.data?.error || 'Failed to collect payment', type: 'danger' });
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

            {barcodeQuantityModal.open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-surface to-surfaceHighlight p-5 shadow-2xl">
                        <div className="mb-4 flex items-start gap-4">
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                                {getItemImageSrc(barcodeQuantityModal.item) ? (
                                    <img src={getItemImageSrc(barcodeQuantityModal.item)} alt={barcodeQuantityModal.item?.name || 'Product'} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-text-muted">
                                        <span className="material-icons-round text-2xl">inventory_2</span>
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">Barcode Matched</p>
                                <h3 className="mt-1 text-lg font-bold text-white leading-tight">{barcodeQuantityModal.item?.name || 'Product'}</h3>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-text-secondary">
                                        {barcodeQuantityModal.item?.barcode || barcodeQuantityModal.item?.sku || 'No Barcode'}
                                    </span>
                                    {Number.isFinite(Number(barcodeQuantityModal.item?.stock)) && (
                                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                                            {Number(barcodeQuantityModal.item?.stock)} in stock
                                        </span>
                                    )}
                                </div>
                                <p className="text-base text-primary font-bold mt-2">{formatPrice(barcodeQuantityModal.item?.price || 0)}</p>
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-xs text-text-muted font-semibold uppercase tracking-wide">Quantity</span>
                            <input
                                autoFocus
                                type="number"
                                min="1"
                                value={barcodeQuantityModal.quantity}
                                onChange={(event) => setBarcodeQuantityModal((prev) => ({ ...prev, quantity: event.target.value }))}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        confirmBarcodeQuantityAdd();
                                    }
                                }}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-white outline-none focus:border-primary"
                            />
                        </label>
                        <p className="mt-2 text-xs text-text-muted">Enter quantity then press Enter or click Add to Cart.</p>

                        <div className="mt-5 flex gap-2">
                            <button
                                type="button"
                                onClick={closeBarcodeQuantityModal}
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-text-secondary hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmBarcodeQuantityAdd}
                                className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-background hover:bg-orange-500 transition-colors"
                            >
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
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
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr),220px,auto]">
                    <label className="relative block">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">search</span>
                        <input
                            type="text"
                            value={productSearch}
                            onChange={(event) => setProductSearch(event.target.value)}
                            onKeyDown={handleCatalogSearchKeyDown}
                            placeholder="Search products by name, category, barcode, or SKU"
                            className="w-full rounded-xl border border-white/10 bg-surface px-10 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
                        />
                    </label>
                    <select
                        value={selectedCategory}
                        onChange={(event) => setCategory(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-surface px-3 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
                    >
                        {categoryTabs.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <div className="inline-flex items-center rounded-xl border border-white/10 bg-surface p-1">
                        <button
                            type="button"
                            onClick={() => setCatalogView('GRID')}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${catalogView === 'GRID' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                        >
                            <span className="material-icons-round text-sm">grid_view</span>
                            Grid
                        </button>
                        <button
                            type="button"
                            onClick={() => setCatalogView('LIST')}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${catalogView === 'LIST' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                        >
                            <span className="material-icons-round text-sm">view_list</span>
                            List
                        </button>
                    </div>
                </div>
                {/* Left: Product Grid */}
                <div className={catalogView === 'GRID'
                    ? 'flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 auto-rows-max items-start content-start gap-4 overflow-y-auto overflow-x-hidden pb-20 pr-2 scrollbar-hide'
                    : 'flex-1 min-h-0 space-y-3 overflow-y-auto overflow-x-hidden pb-20 pr-2 scrollbar-hide'}
                >
                    {searchedDisplayItems.length === 0 && (
                        <div className="col-span-full text-center text-text-muted py-10">No items match your category and search filters.</div>
                    )}
                    {searchedDisplayItems.map((item) => {
                        const isTrainer = selectedCategory === 'TRAINERS';
                        const isPackage = selectedCategory === 'PACKAGES';
                        const isSoldOut = !isTrainer && !isPackage && selectedCategory !== 'MEMBERSHIP' && item.stock <= 0;
                        const addLabel = isSoldOut ? 'Sold Out' : 'Add';

                        if (catalogView === 'LIST') {
                            return (
                                <div
                                    key={item.id}
                                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface p-3 transition-colors ${isSoldOut ? 'border-red-500/20 opacity-70' : 'border-white/10 hover:border-primary/40'}`}
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white/5">
                                            {getItemImageSrc(item) ? (
                                                <img src={getItemImageSrc(item)} alt={item.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                    <span className="material-icons-round text-lg">{selectedCategory === POS_VIEWS.MEMBERSHIP ? 'card_membership' : isTrainer ? 'person' : isPackage ? 'redeem' : 'inventory_2'}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                                            <p className="truncate text-xs text-text-muted">{item.category || (isTrainer ? 'Trainer Service' : isPackage ? 'Class Package' : 'Product')}</p>
                                            <p className="truncate text-[11px] font-mono text-text-secondary">Barcode/SKU: {item.barcode || item.sku || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-sm font-bold text-primary">{isTrainer ? formatPrice(item.sessionPrice ?? 0, true) : formatPrice(item.price)}</p>
                                        <button
                                            type="button"
                                            onClick={() => handleAddCatalogItem(item)}
                                            disabled={isSoldOut}
                                            className="rounded-lg border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {addLabel}
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={item.id}
                                onClick={() => handleAddCatalogItem(item)}
                                className={`group self-start flex flex-col rounded-3xl border border-white/5 bg-surface p-3 transition-all duration-300 hover:border-primary/20 hover:bg-primary/5 hover:shadow-primary/10 active:scale-95 ${selectedCategory === POS_VIEWS.MEMBERSHIP ? 'ring-1 ring-yellow-500/30' : ''} ${isSoldOut ? 'cursor-not-allowed opacity-70 grayscale-[0.5]' : 'cursor-pointer'}`}
                            >
                                <div className="relative mb-3 aspect-square shrink-0 overflow-hidden rounded-2xl bg-white/5">
                                    {getItemImageSrc(item) ? (
                                        <img src={getItemImageSrc(item)} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                                <div className="px-1 pt-1 flex-1">
                                    <h3 className="text-sm font-bold leading-tight text-white min-h-[2.25rem]">{item.name}</h3>
                                    <p className="mt-1 text-[11px] text-text-muted">{item.category || (isTrainer ? 'Trainer Service' : isPackage ? 'Class Package' : 'Product')}</p>
                                    <p className="mt-1 text-[11px] font-mono text-text-secondary">Barcode/SKU: {item.barcode || item.sku || 'N/A'}</p>
                                    <div className="mt-2 flex items-center justify-between">
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
            <div className={`${isSidebarCollapsed ? 'w-[340px]' : 'w-[300px]'} h-full flex-shrink-0 transition-all duration-300 flex flex-col bg-surface rounded-3xl border border-white/10 shadow-xl shadow-black/50 overflow-hidden`}>
                {/* Cart Header */}
                <div className="p-4 border-b border-white/5 bg-white/5">
                    <div className="flex justify-between items-center mb-1">
                        <h2 className="text-white font-bold text-base">Current Cart</h2>
                        <span className="material-icons-round text-text-muted">shopping_bag</span>
                    </div>

                    {/* Member Selector */}
                    <div className="mt-4">
                        <select
                            className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
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

                    <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Discounts</p>
                            <span className="text-[11px] text-text-muted">{discount > 0 ? `${discount}% Applied` : 'No Discount'}</span>
                        </div>

                        {discountOptions.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyDiscountPreset('')}
                                    className={`rounded-xl border p-2 text-left transition-colors ${!selectedDiscountPresetId
                                        ? 'border-primary/60 bg-primary/10 text-primary'
                                        : 'border-white/10 bg-surfaceHighlight text-text-secondary hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons-round text-base">remove_circle_outline</span>
                                        <span className="text-xs font-semibold">No Discount</span>
                                    </div>
                                </button>

                                {discountOptions.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => applyDiscountPreset(preset.id)}
                                        className={`rounded-xl border p-2 text-left transition-colors ${selectedDiscountPresetId === preset.id
                                            ? 'border-primary/60 bg-primary/10 text-primary'
                                            : 'border-white/10 bg-surfaceHighlight text-text-secondary hover:text-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-icons-round text-base">{preset.icon || 'local_offer'}</span>
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold">{preset.name}</p>
                                                <p className="text-[11px] opacity-80">{preset.rate}%</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-text-muted">No discount presets configured in POS Settings.</p>
                        )}
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-text-muted">
                            <span className="material-icons-round text-6xl mb-4 bg-white/5 p-4 rounded-full">shopping_cart_checkout</span>
                            <p className="font-medium text-text-muted">Cart is empty</p>
                        </div>
                    ) : (
                        cart.map((item, idx) => {
                            const cartImage = item.imageUrl || item.photoUrl || item.avatarUrl || '';
                            const fallbackIcon = item.type === 'PLAN'
                                ? 'card_membership'
                                : item.type === 'TRAINING'
                                    ? 'person'
                                    : item.type === 'CLASS_PACKAGE'
                                        ? 'redeem'
                                        : 'inventory_2';
                            return (
                                <div key={item.cartLineId || `${item.id}-${idx}`} className="p-2 hover:bg-white/5 rounded-xl group transition-colors border border-transparent hover:border-white/5">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-white/5 border border-white/10">
                                                {cartImage ? (
                                                    <img src={cartImage} alt={item.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                        <span className="material-icons-round text-base">{fallbackIcon}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-white font-bold text-[13px] leading-tight">{item.name}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                                    {item.type === 'PLAN' && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/30">PLAN</span>}
                                                    {item.type === 'TRAINING' && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">TRAINER</span>}
                                                    {item.type === 'CLASS_PACKAGE' && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">PACKAGE</span>}
                                                </div>
                                                {item.type !== 'TRAINING' && (
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        <button
                                                            onClick={async (e) => { e.stopPropagation(); const r = updateQuantity(item.cartLineId, item.quantity - 1, item.stock); if (r && !r.success && r.error) await showAlert({ title: 'Stock Limit', message: r.error, type: 'warning' }); }}
                                                            className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                                                        >
                                                            <span className="material-icons-round text-[11px]">remove</span>
                                                        </button>
                                                        <input
                                                            type="number"
                                                            className="w-8 bg-transparent text-center text-text-muted text-xs font-semibold focus:text-white outline-none border-b border-transparent focus:border-white/30 transition-colors"
                                                            value={item.quantity}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={async (e) => { const r = updateQuantity(item.cartLineId, Math.max(1, parseInt(e.target.value) || 1), item.stock); if (r && !r.success && r.error) await showAlert({ title: 'Stock Limit', message: r.error, type: 'warning' }); }}
                                                        />
                                                        <button
                                                            onClick={async (e) => { e.stopPropagation(); const r = updateQuantity(item.cartLineId, item.quantity + 1, item.stock); if (r && !r.success && r.error) await showAlert({ title: 'Stock Limit', message: r.error, type: 'warning' }); }}
                                                            className="w-5 h-5 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                                                        >
                                                            <span className="material-icons-round text-[11px]">add</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="text-right">
                                                <p className="text-white font-bold text-xs">{formatCartPrice(item.price * item.quantity)}</p>
                                                <p className="text-text-muted text-[10px]">{formatCartPrice(item.price)} each</p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartLineId); }}
                                                className="w-5 h-5 flex items-center justify-center bg-white/10 text-text-muted hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <span className="material-icons-round text-[12px]">close</span>
                                            </button>
                                        </div>
                                    </div>

                                {item.type === 'TRAINING' && (
                                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
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
                            );
                        })
                    )}
                </div>

                {/* Checkout Footer */}
                <div className="p-4 border-t border-white/5 bg-surfaceHighlight/50 backdrop-blur-sm">
                    <div className="flex justify-between items-end mb-1.5 text-text-secondary text-sm font-medium">
                        <span>Subtotal</span>
                        <span>{formatCartPrice(subtotal)}</span>
                    </div>

                    {discount > 0 && (
                        <div className="mb-4 flex justify-between items-center text-xs text-green-400">
                            <span>Less {selectedDiscountPreset ? `${selectedDiscountPreset.name}` : 'Discount'}</span>
                            <span>-{formatPrice(discountAmount)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-end mb-4">
                        <span className="text-white font-bold text-lg">Total</span>
                        <span className="text-2xl font-bold text-white">{formatCartPrice(cartTotal)}</span>
                    </div>

                    <button
                        onClick={openReceiptTemplatePreview}
                        className="w-full mb-2 bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-xl transition-colors text-sm"
                    >
                        Preview Receipt Layout
                    </button>

                    <button
                        onClick={initiateCheckout}
                        disabled={cart.length === 0 || loading}
                        className="w-full bg-primary hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex flex-col items-center justify-center"
                    >
                        <span className="text-[10px] uppercase tracking-wider opacity-90 font-bold mb-0.5">Charge {selectedMemberId ? 'Member' : 'Guest'}</span>
                        <span className="text-base">{formatCartPrice(cartTotal)}</span>
                    </button>
                </div>
            </div>
            </div>

        </div>
    );
}



