import React, { useState, useEffect, useRef } from 'react';
import { POS_VIEWS } from '../../constants/categories'; // Added import
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useReactToPrint } from 'react-to-print';
import { useUIStore } from '../../stores/useUIStore';
import Receipt from '../../components/Receipt';
import { withApiBase } from '../../config/api';

export default function POS() {
    const { user } = useAuth();
    const { isSidebarCollapsed } = useUIStore();
    const { formatPrice } = useCurrency();
    const [products, setProducts] = useState([]);
    const [plans, setPlans] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [classPackages, setClassPackages] = useState([]);
    const [members, setMembers] = useState([]); // For POS member selection
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(false);
    const [discount, setDiscount] = useState(0); // in dollars
    const [viewMode, setViewMode] = useState('POS');
    const [history, setHistory] = useState([]);
    const [trainingBookings, setTrainingBookings] = useState([]);
    const [showCollectModal, setShowCollectModal] = useState(false);
    const [collectSession, setCollectSession] = useState(null);
    const [collectTendered, setCollectTendered] = useState('');
    const [collectLoading, setCollectLoading] = useState(false);
    const [openCalendarLineId, setOpenCalendarLineId] = useState(null);
    const [calendarMonthByLine, setCalendarMonthByLine] = useState({});

    // Derived Variables
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const discountAmount = (subtotal * (discount / 100));
    const cartTotal = subtotal - discountAmount;
    const hasTraining = cart.some(item => item.type === 'TRAINING');
    const hasClassPackages = cart.some(item => item.type === 'CLASS_PACKAGE');

    // Payment Selection
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [amountTendered, setAmountTendered] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [gcashReference, setGcashReference] = useState('');
    const [gcashDate, setGcashDate] = useState('');
    const [gcashTime, setGcashTime] = useState('');


    // Receipt Printing
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [lastTransaction, setLastTransaction] = useState(null);
    const receiptRef = useRef();

    const authHeaders = () => {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : undefined;
    };

    const handlePrint = useReactToPrint({
        content: () => receiptRef.current,
    });

    useEffect(() => {
        fetchProducts();
        fetchPlans();
        fetchTrainers();
        fetchClassPackages();
        fetchMembers();
    }, []);

    useEffect(() => {
        if (viewMode !== 'TRAINING_BOOKINGS') return;
        fetchTrainingBookings();
        const intervalId = setInterval(fetchTrainingBookings, 10000);
        return () => clearInterval(intervalId);
    }, [viewMode]);

    const fetchProducts = async () => {
        try {
            const res = await axios.get(withApiBase('/api/products'));
            setProducts(res.data);
        } catch (_) {
            console.error("Failed to fetch products");
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans'));
            setPlans(res.data);
        } catch (_) {
            console.error("Failed to fetch plans");
        }
    };

    const fetchTrainers = async () => {
        try {
            const res = await axios.get(withApiBase('/api/trainers'));
            setTrainers(res.data);
        } catch (_) {
            console.error("Failed to fetch trainers");
        }
    };

    const fetchClassPackages = async () => {
        try {
            const res = await axios.get(withApiBase('/api/plans/class-session-packages'), {
                headers: authHeaders()
            });
            setClassPackages((res.data || []).filter((pkg) => pkg.isActive));
        } catch (_) {
            console.error("Failed to fetch class session packages");
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await axios.get(withApiBase('/api/members'));
            setMembers(res.data);
        } catch (_) {
            console.error("Failed to fetch members");
        }
    }

    const fetchHistory = async () => {
        try {
            const res = await axios.get(withApiBase('/api/payments'), {
                headers: authHeaders()
            });
            setHistory(res.data);
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


    const formatCartPrice = (amount) => formatPrice(amount);

    const addToCart = (item, type = 'PRODUCT') => {
        setCart(prev => {
            if (type === 'TRAINING') {
                const durations = (item.sessionDurations || '60')
                    .split(',')
                    .map((d) => Number(String(d).trim()))
                    .filter((d) => Number.isFinite(d) && d > 0);
                return [...prev, {
                    id: item.id,
                    cartLineId: `training-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: item.name,
                    price: item.sessionPrice ?? item.price ?? 0,
                    type: 'TRAINING',
                    quantity: 1,
                    trainerId: item.id,
                    date: '',
                    time: '',
                    duration: durations[0] || 60,
                    notes: ''
                }];
            }

            const existing = prev.find(p => p.id === item.id && p.type === type);

            const currentQty = existing ? existing.quantity : 0;
            if (type === 'PRODUCT' && (currentQty + 1) > item.stock) {
                alert(`Not enough stock! Only ${item.stock} left.`);
                return prev;
            }

            if (existing) {
                return prev.map(p => p.id === item.id && p.type === type ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { ...item, type: type, quantity: 1 }];
        });
    };

    const removeFromCart = (id, type, cartLineId = null) => {
        if (cartLineId) {
            setCart(prev => prev.filter(item => item.cartLineId !== cartLineId));
            return;
        }
        setCart(prev => prev.filter(item => !(item.id === id && item.type === type)));
    };

    const updateQuantity = (id, type, newQty) => {
        if (newQty < 1) return;

        // Find original item to check stock
        const cartItem = cart.find(i => i.id === id && i.type === type);
        // We need the original product stock. Ideally we look up in 'products' array
        // but cartItem might have the original stock attached if we spread ...item
        const originalProduct = products.find(p => p.id === id);

        if (type === 'PRODUCT' && originalProduct && newQty > originalProduct.stock) {
            alert(`Cannot exceed available stock (${originalProduct.stock})`);
            return;
        }

        setCart(prev => prev.map(item =>
            (item.id === id && item.type === type) ? { ...item, quantity: newQty } : item
        ));
    };

    const initiateCheckout = () => {
        if (cart.length === 0) return;

        const hasTraining = cart.some(item => item.type === 'TRAINING');
        const hasNonTraining = cart.some(item => item.type !== 'TRAINING');
        if (hasTraining && hasNonTraining) {
            alert("Training sessions must be checked out separately from products or memberships.");
            return;
        }

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
                const trainer = trainers.find((t) => t.id === item.trainerId);
                const slots = getAvailableTimeSlotsForTrainer(trainer, item.date, item.duration);
                return !slots.includes(item.time);
            });
            if (invalidSchedule) {
                alert("One or more trainer bookings use unavailable time slots. Please reselect time.");
                return;
            }
        }

        setShowPaymentModal(true);
        setAmountTendered('');
        setPaymentMethod('');
        setGcashReference('');
        setGcashDate('');
        setGcashTime('');
    };

    const processPayment = async (method) => {
        setLoading(true);
        try {
            const parsedTendered = method === 'CASH' ? Number(amountTendered) : null;
            if (method === 'CASH' && (!Number.isFinite(parsedTendered) || parsedTendered < cartTotal)) {
                throw new Error("Cash tendered must be a valid amount and at least equal to the total.");
            }

            const tendered = method === 'CASH' ? parsedTendered : null;
            const change = method === 'CASH' ? Number((parsedTendered - cartTotal).toFixed(2)) : null;

            if (hasTraining) {
                const memberId = selectedMemberId ? Number(selectedMemberId) : null;
                if (!memberId) throw new Error("Member is required for training sessions");

                for (const item of cart.filter(i => i.type === 'TRAINING')) {
                    await axios.post(withApiBase('/api/staff/book-training'), {
                        memberId,
                        trainerId: item.trainerId,
                        date: item.date,
                        time: item.time,
                        duration: item.duration,
                        notes: item.notes,
                        method
                    }, { headers: authHeaders() });
                }

                const memberData = members.find(m => m.id === Number(selectedMemberId));
                setLastTransaction({
                    transaction: { id: 'TRAINING', amount: cartTotal, type: 'TRAINING', method },
                    items: cart,
                    member: memberData,
                    discount: discount,
                    cashierName: user?.name,
                    paymentDetails: { method, tendered, change }
                });

                setShowPaymentModal(false);
                setShowReceiptPreview(true);
                setCart([]);
                setDiscount(0);
                setSelectedMemberId('');
                setLoading(false);
                return;
            }

            const hasPlan = cart.some(item => item.type === 'PLAN');
            const hasPackage = cart.some(item => item.type === 'CLASS_PACKAGE');
            const paymentType = hasPlan ? 'MEMBERSHIP' : hasPackage ? 'CLASS_PACKAGE' : 'POS_SALE';

            const externalDate = (gcashDate && gcashTime) ? `${gcashDate}T${gcashTime}` : null;
            const res = await axios.post(withApiBase('/api/payments'), {
                amount: cartTotal,
                type: paymentType,
                method: method,
                items: cart,
                discount: discount,
                memberId: selectedMemberId || null,
                cashTendered: tendered,
                changeDue: change,
                externalRef: method === 'GCASH' ? gcashReference : null,
                externalDate: method === 'GCASH' ? externalDate : null
            }, {
                headers: authHeaders()
            });

            // Prepare Reciept Data
            const transactionData = res.data;
            const memberData = members.find(m => m.id === Number(selectedMemberId));

            setLastTransaction({
                transaction: transactionData,
                items: cart,
                member: memberData,
                discount: discountAmount,
                cashierName: user?.name,
                paymentDetails: {
                    method: method,
                    tendered: tendered,
                    change: change
                }
            });

            // Show Preview
            setShowPaymentModal(false);
            setShowReceiptPreview(true);

            // Clear Cart (will happen after modal close or separate)
            setCart([]);
            setDiscount(0);
            setSelectedMemberId('');
            fetchProducts(); // Refresh stock levels
            fetchClassPackages();
        } catch (e) {
            alert("Transaction Failed: " + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const renderStatusBadge = (status) => {
        const value = status || 'COMPLETED';
        const base = "px-2 py-1 rounded text-xs font-bold";
        if (value === 'VOIDED') return <span className={`${base} bg-red-500/10 text-red-400 border border-red-500/20`}>VOIDED</span>;
        if (value === 'RETURNED') return <span className={`${base} bg-amber-500/10 text-amber-400 border border-amber-500/20`}>RETURNED</span>;
        if (value === 'PENDING') return <span className={`${base} bg-yellow-500/10 text-yellow-400 border border-yellow-500/20`}>PENDING</span>;
        return <span className={`${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>COMPLETED</span>;
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

    const getAvailableTimeSlotsForTrainer = (trainer, isoDate, duration) => {
        if (!trainer || !isoDate || !duration) return [];
        const dateObj = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(dateObj.getTime())) return [];

        const availabilityDays = Array.isArray(trainer.availabilityDays)
            ? trainer.availabilityDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            : [];
        if (availabilityDays.length > 0 && !availabilityDays.includes(dateObj.getDay())) return [];

        const dayKey = String(dateObj.getDay());
        const interval = Number(trainer.availabilityIntervalMinutes) || 30;
        const dayConfig = trainer.availabilityByDay?.[dayKey];
        const start = toMinutes(dayConfig?.start || trainer.availabilityStart || '09:00');
        const end = toMinutes(dayConfig?.end || trainer.availabilityEnd || '18:00');
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
        const availabilityDays = Array.isArray(trainer.availabilityDays)
            ? trainer.availabilityDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            : [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dates = [];
        for (let i = 0; i <= daysAhead; i += 1) {
            const current = new Date(today);
            current.setDate(today.getDate() + i);
            if (availabilityDays.length > 0 && !availabilityDays.includes(current.getDay())) {
                continue;
            }
            dates.push(toIsoDate(current));
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
                                    <td className="px-6 py-4 text-text-secondary">{pay.method}</td>
                                    <td className="px-6 py-4 text-white">{pay.member ? `${pay.member.firstName} ${pay.member.lastName}` : 'Walk-in'}</td>
                                    <td className="px-6 py-4 text-white">{pay.cashier?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 text-white">
                                        {pay.method === 'CASH' ? formatPrice(pay.changeDue || 0) : '-'}
                                    </td>
                                    <td className="px-6 py-4">{renderStatusBadge(pay.status)}</td>
                                    <td className="px-6 py-4">
                                        <a
                                            href={`/pos/transactions/${pay.id}`}
                                            className="text-xs font-bold px-3 py-1 rounded-lg border border-white/10 text-white hover:bg-white/10"
                                        >
                                            View Transaction
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
                    <h1 className="text-2xl font-bold text-white">Bookings</h1>
                    <button onClick={() => setViewMode('POS')} className="text-primary hover:text-orange-400 font-bold flex items-center gap-1">
                        <span className="material-icons-round">arrow_back</span> Back to POS
                    </button>
                </div>

                <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Member</th>
                                <th className="px-6 py-4">Trainer</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {trainingBookings.length === 0 && (
                                <tr><td colSpan="7" className="p-6 text-center text-text-muted">No unpaid bookings found.</td></tr>
                            )}
                            {trainingBookings.map(session => (
                                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-white font-medium">
                                        {new Date(session.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(session.date).toLocaleTimeString()}</span>
                                    </td>
                                    <td className="px-6 py-4 text-white">
                                        {session.member ? `${session.member.firstName} ${session.member.lastName}` : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-white">{session.trainer?.name || 'N/A'}</td>
                                    <td className="px-6 py-4 text-white">{session.duration} min</td>
                                    <td className="px-6 py-4 text-white font-bold">{formatPrice(session.price)}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">UNPAID</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => {
                                                setCollectSession(session);
                                                setCollectTendered('');
                                                setShowCollectModal(true);
                                            }}
                                            className="text-xs font-bold px-3 py-1 rounded-lg border border-white/10 text-white hover:bg-white/10"
                                        >
                                            Collect Cash
                                        </button>

                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {showCollectModal && collectSession && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6">
                            <div className="mb-4">
                                <h2 className="text-xl font-bold text-white">Collect Cash</h2>
                                <p className="text-text-muted text-sm">
                                    {collectSession.member?.firstName} {collectSession.member?.lastName} • {collectSession.trainer?.name}
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-text-muted">Amount Due</span>
                                    <span className="text-white font-bold text-lg">{formatPrice(collectSession.price)}</span>
                                </div>
                                <div>
                                    <label className="block text-text-muted text-sm font-medium mb-2">Cash Tendered</label>
                                    <input
                                        type="number"
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-3 px-4 text-white text-base focus:border-primary outline-none"
                                        placeholder="0.00"
                                        value={collectTendered}
                                        onChange={(e) => setCollectTendered(e.target.value)}
                                    />
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                    <span className="text-text-secondary">Change Due:</span>
                                    {formatPrice(Math.max(0, (parseFloat(collectTendered) || 0) - collectSession.price))}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowCollectModal(false)}
                                        className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if ((parseFloat(collectTendered) || 0) < collectSession.price) return;
                                            setCollectLoading(true);
                                            try {
                                                await axios.post(withApiBase(`/api/staff/training-sessions/${collectSession.id}/collect`), {
                                                    method: 'CASH',
                                                    cashTendered: parseFloat(collectTendered)
                                                }, { headers: authHeaders() });
                                                await fetchTrainingBookings();
                                                await fetchHistory();
                                                setShowCollectModal(false);
                                            } catch (e) {
                                                alert("Failed to collect payment");
                                            } finally {
                                                setCollectLoading(false);
                                            }
                                        }}
                                        disabled={collectLoading || (parseFloat(collectTendered) || 0) < collectSession.price}
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
            {showReceiptPreview && lastTransaction && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white text-black rounded-lg shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-100 rounded-t-lg">
                            <h3 className="font-bold text-lg">Receipt Preview</h3>
                            <button onClick={() => setShowReceiptPreview(false)} className="text-gray-500 hover:text-gray-700">
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
                            />
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex gap-4">
                            <button
                                onClick={() => setShowReceiptPreview(false)}
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
            {showPaymentModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-up">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Select Payment Method</h2>
                            <p className="text-text-muted">Total Amount Due</p>
                            <p className="text-4xl font-bold text-primary mt-1">{formatCartPrice(cartTotal)}</p>
                        </div>

                        {!paymentMethod ? (
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setPaymentMethod('CASH')}
                                    className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-[1.02]"
                                >
                                    <span className="material-icons-round text-4xl">payments</span>
                                    <span className="font-bold text-lg">CASH</span>
                                </button>
                                <button
                                    onClick={() => processPayment('CARD')}
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-[1.02]"
                                >
                                    {loading ? (
                                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span className="material-icons-round text-4xl">credit_card</span>
                                            <span className="font-bold text-lg">CARD</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('GCASH')}
                                    disabled={loading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-[1.02]"
                                >
                                    {loading ? (
                                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span className="material-icons-round text-4xl">account_balance_wallet</span>
                                            <span className="font-bold text-lg">GCASH</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Cash Calculator */}
                                {paymentMethod === 'GCASH' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-text-muted text-sm font-medium mb-2">GCash Reference ID</label>
                                            <input
                                                type="text"
                                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base font-bold focus:border-primary outline-none"
                                                placeholder="Enter GCash transaction ID"
                                                value={gcashReference}
                                                onChange={(e) => setGcashReference(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-text-muted text-sm font-medium mb-2">Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base focus:border-primary outline-none"
                                                    value={gcashDate}
                                                    onChange={(e) => setGcashDate(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-text-muted text-sm font-medium mb-2">Time</label>
                                                <input
                                                    type="time"
                                                    className="w-full bg-surfaceHighlight border border-white/10 rounded-xl py-4 px-4 text-white text-base focus:border-primary outline-none"
                                                    value={gcashTime}
                                                    onChange={(e) => setGcashTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {paymentMethod === 'CASH' && (
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
                                                    value={amountTendered}
                                                    onChange={(e) => setAmountTendered(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                                            <span className="text-text-secondary">Change Due:</span>
                                            <span className={`text-2xl font-bold ${(parseFloat(amountTendered) || 0) >= cartTotal ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatPrice(Math.max(0, (parseFloat(amountTendered) || 0) - cartTotal))}
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setPaymentMethod('')}
                                        className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 rounded-xl"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => processPayment(paymentMethod)}
                                        disabled={
                                            (paymentMethod === 'CASH' && (parseFloat(amountTendered) || 0) < cartTotal) ||
                                            (paymentMethod === 'GCASH' && (!gcashReference || !gcashDate || !gcashTime))
                                        }
                                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                        Complete Sale
                                    </button>
                                </div>
                            </div>
                        )}

                        {!paymentMethod && (
                            <button
                                onClick={() => setShowPaymentModal(false)}
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
                        <button onClick={() => { fetchTrainingBookings(); setViewMode('TRAINING_BOOKINGS'); }} className="text-text-secondary hover:text-primary flex items-center gap-1 transition-colors">
                            <span className="material-icons-round">event_available</span> Bookings
                        </button>
                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-2 bg-surface p-1 rounded-xl border border-white/10">
                            {['All', ...Object.values(POS_VIEWS)].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
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
                    {displayItems.length === 0 && (
                        <div className="col-span-full text-center text-text-muted py-10">No items found in this category.</div>
                    )}
                    {displayItems.map(item => {
                        const isTrainer = selectedCategory === POS_VIEWS.TRAINERS;
                        const isPackage = selectedCategory === POS_VIEWS.PACKAGES;
                        const isSoldOut = !isTrainer && !isPackage && selectedCategory !== POS_VIEWS.MEMBERSHIP && item.stock <= 0;
                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (isSoldOut) return;
                                    if (isTrainer) {
                                        addToCart(item, 'TRAINING');
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
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, item.type, item.quantity - 1); }}
                                                    className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                                                >
                                                    <span className="material-icons-round text-xs">remove</span>
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-10 bg-transparent text-center text-text-muted text-sm font-medium focus:text-white outline-none border-b border-transparent focus:border-white/30 transition-colors"
                                                    value={item.quantity}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => updateQuantity(item.id, item.type, Math.max(1, parseInt(e.target.value) || 1))}
                                                />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, item.type, item.quantity + 1); }}
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
                                            onClick={(e) => { e.stopPropagation(); removeFromCart(item.id, item.type, item.cartLineId || null); }}
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
                                                            const trainer = trainers.find(t => t.id === item.trainerId);
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
                                                                            setCart(prev => prev.map(ci => {
                                                                                const isTarget = (item.cartLineId && ci.cartLineId === item.cartLineId) || ci === item;
                                                                                if (!isTarget) return ci;
                                                                                const lineTrainer = trainers.find(t => t.id === ci.trainerId);
                                                                                const slots = getAvailableTimeSlotsForTrainer(lineTrainer, iso, ci.duration);
                                                                                return {
                                                                                    ...ci,
                                                                                    date: iso,
                                                                                    time: slots.includes(ci.time) ? ci.time : ''
                                                                                };
                                                                            }));
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
                                            onChange={(e) => {
                                                const nextTime = e.target.value;
                                                setCart(prev => prev.map(ci => {
                                                    const isTarget = (item.cartLineId && ci.cartLineId === item.cartLineId) || ci === item;
                                                    return isTarget ? { ...ci, time: nextTime } : ci;
                                                }));
                                            }}
                                            disabled={!item.date}
                                        >
                                            <option value="">{item.date ? 'Select Time' : 'Select Date First'}</option>
                                            {(() => {
                                                const trainer = trainers.find(t => t.id === item.trainerId);
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
                                                setCart(prev => prev.map(ci => {
                                                    const isTarget = (item.cartLineId && ci.cartLineId === item.cartLineId) || ci === item;
                                                    if (!isTarget) return ci;
                                                    const trainer = trainers.find(t => t.id === ci.trainerId);
                                                    const slots = ci.date ? getAvailableTimeSlotsForTrainer(trainer, ci.date, nextDuration) : [];
                                                    return {
                                                        ...ci,
                                                        duration: nextDuration,
                                                        time: slots.includes(ci.time) ? ci.time : ''
                                                    };
                                                }));
                                            }}
                                        >
                                            {(trainers.find(t => t.id === item.trainerId)?.sessionDurations || '60')
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
                                            onChange={(e) => setCart(prev => prev.map(ci => {
                                                const isTarget = (item.cartLineId && ci.cartLineId === item.cartLineId) || ci === item;
                                                return isTarget ? { ...ci, notes: e.target.value } : ci;
                                            }))}
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
