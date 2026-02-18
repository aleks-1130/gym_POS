import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

export default function TrainerBooking() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingData, setBookingData] = useState({
        duration: 60,
        notes: '',
        paymentMethod: 'CASH'
    });
    const [selectedDates, setSelectedDates] = useState([]);
    const [selectedTimesByDate, setSelectedTimesByDate] = useState({});
    const [bookingLoading, setBookingLoading] = useState(false);
    const [memberSessions, setMemberSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsError, setSessionsError] = useState('');
    const [activeTab, setActiveTab] = useState('trainers'); // trainers, bookings
    const [filterView, setFilterView] = useState('all'); // all, available, top-rated
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    useEffect(() => {
        fetchTrainers();
    }, []);

    useEffect(() => {
        if (user?.role !== 'MEMBER') return;
        fetchMemberSessions();
    }, [user?.id, user?.role]);

    useEffect(() => {
        const fetchMethods = async () => {
            if (!user?.id) return;
            try {
                const token = sessionStorage.getItem('token') || localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/members/${user.id}/payment-methods`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                const methods = res.data || [];
                setPaymentMethods(methods);
                const defaultMethod = methods.find((m) => m.isDefault);
                if (defaultMethod) {
                    setSelectedMethodId(defaultMethod.id);
                    setBookingData((prev) => ({
                        ...prev,
                        paymentMethod: defaultMethod.type === 'GCASH' ? 'GCASH' : 'CARD'
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch payment methods', error);
            }
        };

        fetchMethods();
    }, [user?.id]);

    // Prevent body scroll when modal is open (PWA best practice)
    useEffect(() => {
        if (showBookingModal) {
            document.body.style.overflow = 'hidden';
            // Add safe area insets for iOS
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, [showBookingModal]);

    const fetchTrainers = async () => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/trainers', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setTrainers(res.data);
        } catch (error) {
            console.error("Failed to fetch trainers");
        } finally {
            setLoading(false);
        }
    };

    const fetchMemberSessions = async () => {
        if (!user?.id || user?.role !== 'MEMBER') return;
        setSessionsLoading(true);
        setSessionsError('');
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/members/me/training-sessions', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setMemberSessions(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            const status = error?.response?.status;
            const message = error?.response?.data?.error || error?.message || 'Failed to fetch member training sessions';
            setSessionsError(status ? `${message} (HTTP ${status})` : message);
            console.error("Failed to fetch member training sessions", error);
        } finally {
            setSessionsLoading(false);
        }
    };

    const handleCancelSession = async (sessionId) => {
        if (!confirm("Are you sure you want to cancel this session?")) return;

        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post(`http://localhost:5000/api/members/me/training-sessions/${sessionId}/cancel`, {}, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            alert("Session cancelled successfully.");
            fetchMemberSessions();
        } catch (error) {
            console.error("Failed to cancel session", error);
            alert(error.response?.data?.error || "Failed to cancel session");
        }
    };

    const handleBookSession = async (e) => {
        e.preventDefault();
        if (!selectedTrainer || selectedDates.length === 0) {
            alert("Please fill in all required fields");
            return;
        }
        if (!user?.id) {
            alert("Member session not found. Please log in again.");
            return;
        }
        if (!selectedMethodId && bookingData.paymentMethod !== 'CASH') {
            alert("Please select a payment method.");
            return;
        }
        const missingTimes = selectedDates.filter((date) => !selectedTimesByDate[date]);
        if (missingTimes.length > 0) {
            alert("Please choose a time for all selected dates.");
            return;
        }
        const hasPastDateTime = selectedDates.some((date) => {
            const time = selectedTimesByDate[date];
            if (!time) return true;
            const scheduled = new Date(`${date}T${time}`);
            return Number.isNaN(scheduled.getTime()) || scheduled <= new Date();
        });
        if (hasPastDateTime) {
            alert("Past date/time is not allowed. Please select a future schedule.");
            return;
        }

        setBookingLoading(true);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const endpoint = 'http://localhost:5000/api/members/book-training';
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

            for (const date of selectedDates) {
                const payload = {
                    trainerId: selectedTrainer.id,
                    date,
                    time: selectedTimesByDate[date],
                    duration: bookingData.duration,
                    notes: bookingData.notes,
                    method: bookingData.paymentMethod
                };
                await axios.post(endpoint, payload, { headers });
            }
            alert(`Booked ${selectedDates.length} training session${selectedDates.length > 1 ? 's' : ''} successfully!`);
            setShowBookingModal(false);
            setSelectedTrainer(null);
            setBookingData({ duration: 60, notes: '', paymentMethod: 'CASH' });
            setSelectedDates([]);
            setSelectedTimesByDate({});
            fetchTrainers();
            fetchMemberSessions();
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || "Failed to book training session";
            const errorDetail = error.response?.data?.detail;
            alert(errorDetail ? `${errorMessage}\n\nDetails: ${errorDetail}` : errorMessage);
        } finally {
            setBookingLoading(false);
        }
    };

    const closeModal = useCallback(() => {
        setShowBookingModal(false);
        setSelectedTrainer(null);
        setBookingData({ duration: 60, notes: '', paymentMethod: 'CASH' });
        setSelectedDates([]);
        setSelectedTimesByDate({});
        setSelectedMethodId('');
        setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    }, []);

    const filteredTrainers = trainers.filter(trainer => {
        if (filterView === 'available') return (trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0);
        if (filterView === 'top-rated') return trainer.rating >= 4.5;
        return true;
    });
    const now = new Date();
    const upcomingSessions = memberSessions.filter((session) => new Date(session.date) >= now);


    const getTrainerSpecialties = (trainer) => {
        if (!trainer?.specialties) return [];
        if (Array.isArray(trainer.specialties)) return trainer.specialties;
        if (typeof trainer.specialties === 'string') {
            return trainer.specialties.split(',').map((item) => item.trim()).filter(Boolean);
        }
        return [];
    };
    const getTrainerDurations = (trainer) => {
        const raw = trainer?.sessionDurations || '60';
        return raw
            .split(',')
            .map((item) => Number(item.trim()))
            .filter((value) => Number.isFinite(value) && value > 0);
    };
    const getEndTime = (start, duration) => {
        if (!start || !duration) return '';
        const [hours, minutes] = start.split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
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

    const calendarCells = useMemo(() => {
        const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
        const leading = start.getDay();
        const cells = [];
        for (let i = 0; i < leading; i += 1) cells.push(null);
        for (let d = 1; d <= end.getDate(); d += 1) {
            cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
        }
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [calendarMonth]);

    const availabilityDays = useMemo(() => {
        if (!selectedTrainer) return [];
        return Array.isArray(selectedTrainer.availabilityDays)
            ? selectedTrainer.availabilityDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            : [];
    }, [selectedTrainer]);

    const getAvailableTimeSlots = useCallback((isoDate) => {
        if (!selectedTrainer) return [];
        const dateObj = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(dateObj.getTime())) return [];

        const dayKey = String(dateObj.getDay());
        if (availabilityDays.length > 0 && !availabilityDays.includes(dateObj.getDay())) return [];

        const interval = Number(selectedTrainer.availabilityIntervalMinutes) || 30;
        const dayConfig = selectedTrainer.availabilityByDay?.[dayKey];
        const start = toMinutes(dayConfig?.start || selectedTrainer.availabilityStart || '09:00');
        const end = toMinutes(dayConfig?.end || selectedTrainer.availabilityEnd || '18:00');

        if (start === null || end === null || end <= start) return [];

        // Get booked sessions for this date
        const bookedSessions = (selectedTrainer.trainingSessions || []).filter(session => {
            if (session.status === 'CANCELLED') return false;
            const sDate = new Date(session.date);
            return toIsoDate(sDate) === isoDate;
        }).map(session => {
            const sDate = new Date(session.date);
            const startMins = sDate.getHours() * 60 + sDate.getMinutes();
            return {
                start: startMins,
                end: startMins + (session.duration || 60)
            };
        });

        const duration = Number(bookingData.duration) || 60;
        const slots = [];
        const todayIso = toIsoDate(new Date());
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        for (let t = start; t + duration <= end; t += interval) {
            const slotStart = t;
            const slotEnd = t + duration;
            if (isoDate === todayIso && slotStart <= nowMinutes) {
                continue;
            }

            // Check for overlap
            const isBlocked = bookedSessions.some(session => {
                return (slotStart < session.end && slotEnd > session.start);
            });

            if (!isBlocked) {
                const hh = String(Math.floor(t / 60)).padStart(2, '0');
                const mm = String(t % 60).padStart(2, '0');
                slots.push(`${hh}:${mm}`);
            }
        }
        return slots;
    }, [selectedTrainer, availabilityDays, bookingData.duration]);

    useEffect(() => {
        if (selectedDates.length === 0) return;
        setSelectedTimesByDate((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const date of selectedDates) {
                const selected = next[date];
                if (!selected) continue;
                const slots = getAvailableTimeSlots(date);
                if (!slots.includes(selected)) {
                    delete next[date];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [selectedDates, getAvailableTimeSlots]);


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading trainers...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 px-4 max-w-6xl mx-auto space-y-4 sm:space-y-6">
            {/* Header - PWA Sticky */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white">1-on-1 Training</h1>
                        <p className="text-text-muted text-xs sm:text-sm mt-0.5">Book personalized sessions</p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Available Trainers</p>
                        <p className="text-2xl sm:text-3xl font-bold text-primary">{trainers.length}</p>
                    </div>
                    <div className="bg-surface rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/5">
                        <p className="text-text-muted text-xs sm:text-sm mb-1">Avg. Rate</p>
                        {trainers.length > 0
                            ? formatPrice(trainers.reduce((sum, t) => sum + (t.sessionPrice ?? 300), 0) / trainers.length)
                            : formatPrice(0)
                        }
                    </div>
                </div>

                {/* Primary Tabs */}
                <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-xl bg-surface border border-white/10">
                    <button
                        type="button"
                        onClick={() => setActiveTab('trainers')}
                        className={`px-3 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all ${activeTab === 'trainers'
                            ? 'bg-primary text-background'
                            : 'text-text-muted hover:text-white'
                            }`}
                    >
                        All Trainers
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('bookings')}
                        className={`px-3 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all ${activeTab === 'bookings'
                            ? 'bg-primary text-background'
                            : 'text-text-muted hover:text-white'
                            }`}
                    >
                        My Bookings ({memberSessions.length})
                    </button>
                </div>

                {/* Trainer Filters */}
                {activeTab === 'trainers' && (
                    <div className="flex gap-2 mt-3">
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'available', label: 'Available' },
                            { value: 'top-rated', label: 'Top Rated' }
                        ].map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setFilterView(tab.value)}
                                className={`px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${filterView === tab.value
                                    ? 'bg-primary/15 text-primary border border-primary/30'
                                    : 'bg-surface text-text-muted hover:text-white border border-white/5'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {activeTab === 'bookings' ? (
                /* My Booked Sessions */
                <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-white font-bold text-base sm:text-lg">My Booked Sessions</h2>
                            <p className="text-text-muted text-xs sm:text-sm mt-0.5">Track your trainer session bookings</p>
                        </div>
                        <button
                            type="button"
                            onClick={fetchMemberSessions}
                            className="px-3 py-2 rounded-lg bg-white/5 text-text-muted hover:text-white text-xs font-semibold"
                        >
                            Refresh
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-wide text-text-muted">Upcoming</p>
                            <p className="text-xl font-bold text-white mt-1">{upcomingSessions.length}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <p className="text-[11px] uppercase tracking-wide text-text-muted">Total Booked</p>
                            <p className="text-xl font-bold text-white mt-1">{memberSessions.length}</p>
                        </div>
                    </div>

                    {sessionsLoading ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-text-muted">
                            Loading your sessions...
                        </div>
                    ) : sessionsError ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
                            {sessionsError}
                        </div>
                    ) : memberSessions.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-text-muted">
                            You have no trainer bookings yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {memberSessions.slice(0, 8).map((session) => {
                                const sessionDate = new Date(session.date);
                                const isUpcoming = sessionDate >= now;
                                return (
                                    <div key={session.id} className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-white font-semibold text-sm sm:text-base">{session.trainer?.name || 'Trainer'}</p>
                                                <p className="text-text-muted text-xs sm:text-sm mt-0.5">
                                                    {sessionDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    {' at '}
                                                    {sessionDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-md border ${isUpcoming
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                : 'bg-white/10 text-text-muted border-white/20'
                                                }`}>
                                                {session.status === 'CANCELLED' ? 'CANCELLED' : (isUpcoming ? 'Check-In' : 'Past')}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-right">
                                            {isUpcoming && session.status !== 'CANCELLED' && (
                                                <button
                                                    onClick={() => handleCancelSession(session.id)}
                                                    className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                                            <span className="px-2 py-1 rounded-md bg-white/10 text-text-muted">{session.duration} min</span>
                                            <span className="px-2 py-1 rounded-md bg-white/10 text-text-muted">{formatPrice(session.price)}</span>
                                            <span className={`px-2 py-1 rounded-md border ${session.paymentStatus === 'PAID'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                }`}>
                                                {session.paymentStatus || 'UNPAID'}
                                            </span>
                                            <span className="px-2 py-1 rounded-md bg-white/10 text-text-muted">{session.paymentMethod || 'N/A'}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {memberSessions.length > 8 && (
                                <p className="text-xs text-text-muted">Showing latest 8 sessions.</p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                filteredTrainers.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <span className="material-icons-round text-5xl text-text-muted opacity-50 block mb-3">person_off</span>
                        <p className="text-text-muted text-base">No trainers match your filter</p>
                        <button
                            onClick={() => setFilterView('all')}
                            className="mt-4 px-4 py-2 bg-primary text-background rounded-lg font-medium text-sm"
                        >
                            Show All Trainers
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTrainers.map(trainer => (
                            <div key={trainer.id} className="bg-surface rounded-2xl border border-white/5 overflow-hidden hover:border-primary/30 transition-all group flex flex-col">
                                {/* Trainer Image */}
                                <div className="aspect-[4/3] sm:aspect-square bg-white/5 overflow-hidden relative">
                                    {trainer.imageUrl ? (
                                        <img
                                            src={trainer.imageUrl}
                                            alt={trainer.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                            <span className="material-icons-round text-6xl text-primary/30">person</span>
                                        </div>
                                    )}

                                    {/* Rating Badge */}
                                    {trainer.rating && (
                                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1">
                                            <span className="material-icons-round text-base text-yellow-400">star</span>
                                            <span className="text-white font-bold text-sm">{trainer.rating}</span>
                                        </div>
                                    )}

                                    {/* Experience Tag */}
                                    {trainer.experience && (
                                        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md rounded-lg px-3 py-1.5">
                                            <span className="text-white font-medium text-xs">{trainer.experience}y exp</span>
                                        </div>
                                    )}
                                </div>

                                {/* Trainer Info */}
                                <div className="p-4 sm:p-5 flex flex-col flex-1">
                                    <div className="mb-3">
                                        <h3 className="font-bold text-white text-lg sm:text-xl">{trainer.name}</h3>
                                        <p className="text-text-muted text-sm mt-0.5">{trainer.specialization || 'Personal Trainer'}</p>
                                    </div>

                                    {/* Bio */}
                                    {trainer.bio && (
                                        <p className="text-text-muted text-sm mb-3 line-clamp-2 leading-relaxed">
                                            {trainer.bio}
                                        </p>
                                    )}

                                    {/* Specializations */}
                                    {getTrainerSpecialties(trainer).length > 0 && (
                                        <div className="mb-4 flex flex-wrap gap-2">
                                            {getTrainerSpecialties(trainer).slice(0, 3).map((specialty, idx) => (
                                                <span key={idx} className="bg-white/10 text-text-secondary px-2.5 py-1 rounded-md text-xs font-medium">
                                                    {specialty}
                                                </span>
                                            ))}
                                            {getTrainerSpecialties(trainer).length > 3 && (
                                                <span className="text-text-muted text-xs py-1 px-1">+{getTrainerSpecialties(trainer).length - 3} more</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-auto space-y-3">
                                        {/* Price */}
                                        <div className="flex justify-between items-center py-2 border-t border-white/5">
                                            <span className="text-text-muted text-sm">Per Session (60 min)</span>
                                            <span className="text-primary font-bold text-xl">{formatPrice(trainer.sessionPrice ?? 300)}</span>
                                        </div>

                                        {/* Availability */}
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className={`w-2 h-2 rounded-full ${(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0) ? 'bg-green-400' : 'bg-amber-400'}`}></div>
                                            <span className={(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0) ? 'text-green-400' : 'text-amber-400'}>
                                                {(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0)
                                                    ? `${Object.keys(trainer.availabilityByDay).length} available day(s)`
                                                    : 'Availability not set'
                                                }
                                            </span>
                                        </div>

                                        {/* Book Button - Touch Optimized */}
                                        <button
                                            onClick={() => {
                                                setSelectedTrainer(trainer);
                                                setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                                                setShowBookingModal(true);
                                            }}
                                            className="w-full py-3.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all active:scale-95 flex items-center justify-center gap-2 touch-manipulation bg-primary text-background hover:brightness-110 shadow-lg shadow-primary/25"
                                        >
                                            <span className="material-icons-round text-lg">event</span>
                                            Book Session
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Booking Modal - Mobile Optimized */}
            {
                showBookingModal && selectedTrainer && (
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center"
                        onClick={closeModal}
                        style={{
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            paddingTop: 'env(safe-area-inset-top)'
                        }}
                    >
                        <div
                            className="w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-slide-up sm:animate-none"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header - Sticky */}
                            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-surface sticky top-0 z-10">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h2 className="text-xl sm:text-2xl font-bold text-white truncate">Book Session</h2>
                                    <p className="text-text-muted text-sm mt-0.5 truncate">with {selectedTrainer.name}</p>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0 touch-manipulation"
                                    aria-label="Close modal"
                                >
                                    <span className="material-icons-round text-white text-2xl">close</span>
                                </button>
                            </div>

                            {/* Booking Form - Scrollable */}
                            <div className="flex-1 overflow-y-auto overscroll-contain">
                                <form onSubmit={handleBookSession} className="p-5 sm:p-6 space-y-6">
                                    {/* Trainer Info Card */}
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex gap-4">
                                        <div className="w-16 h-16 sm:w-14 sm:h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {selectedTrainer.imageUrl ? (
                                                <img src={selectedTrainer.imageUrl} alt={selectedTrainer.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-icons-round text-text-muted text-2xl">person</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-base truncate">{selectedTrainer.name}</p>
                                            <p className="text-text-muted text-sm truncate">{selectedTrainer.specialization}</p>
                                            <p className="text-primary font-bold text-lg mt-1">{formatPrice(selectedTrainer.sessionPrice ?? 300)}/session</p>
                                        </div>
                                    </div>

                                    <div className="pt-1">
                                        <h3 className="text-sm font-bold text-white">Step 1: Schedule</h3>
                                        <p className="text-xs text-text-muted mt-0.5">Select dates, choose duration, then assign a time for each date</p>
                                    </div>

                                    {/* Calendar Date Picker */}
                                    <div>
                                        <label className="block text-sm font-bold text-white mb-2">Session Dates *</label>
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                                                >
                                                    <span className="material-icons-round text-base">chevron_left</span>
                                                </button>
                                                <p className="text-sm font-semibold text-white">
                                                    {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                                                >
                                                    <span className="material-icons-round text-base">chevron_right</span>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-7 gap-1 mb-2">
                                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                                    <div key={d} className="text-[10px] text-center uppercase tracking-wide text-text-muted font-semibold">{d}</div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {calendarCells.map((day, idx) => {
                                                    if (!day) return <div key={`blank-${idx}`} className="h-9" />;
                                                    const iso = toIsoDate(day);
                                                    const todayIso = toIsoDate(new Date());
                                                    const isPast = iso < todayIso;
                                                    const dayOfWeek = day.getDay();
                                                    const unavailableDay = availabilityDays.length > 0 && !availabilityDays.includes(dayOfWeek);
                                                    const selected = selectedDates.includes(iso);
                                                    return (
                                                        <button
                                                            key={iso}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isPast || unavailableDay) return;
                                                                setSelectedDates((prev) => {
                                                                    if (prev.includes(iso)) {
                                                                        const next = prev.filter((d) => d !== iso);
                                                                        setSelectedTimesByDate((timesPrev) => {
                                                                            const copy = { ...timesPrev };
                                                                            delete copy[iso];
                                                                            return copy;
                                                                        });
                                                                        return next;
                                                                    }
                                                                    return [...prev, iso].sort();
                                                                });
                                                            }}
                                                            disabled={isPast || unavailableDay}
                                                            className={`h-9 rounded-lg text-xs font-semibold transition-all ${selected
                                                                ? 'bg-primary text-background'
                                                                : (isPast || unavailableDay)
                                                                    ? 'bg-white/5 text-text-muted/40 cursor-not-allowed'
                                                                    : 'bg-white/5 text-white hover:bg-white/10'
                                                                }`}
                                                        >
                                                            {day.getDate()}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Dates</p>
                                            <p className="text-xs font-semibold text-white truncate">{selectedDates.length} selected</p>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Times</p>
                                            <p className="text-xs font-semibold text-white truncate">{Object.keys(selectedTimesByDate).length}/{selectedDates.length}</p>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Duration</p>
                                            <p className="text-xs font-semibold text-white truncate">{bookingData.duration} min</p>
                                        </div>
                                    </div>

                                    {/* Duration - Touch Optimized */}
                                    <div>
                                        <label className="block text-sm font-bold text-white mb-2">Session Duration</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {getTrainerDurations(selectedTrainer).map((duration) => (
                                                <button
                                                    key={duration}
                                                    type="button"
                                                    onClick={() => setBookingData({ ...bookingData, duration })}
                                                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${bookingData.duration === duration
                                                        ? 'bg-primary/15 text-primary border-primary/40'
                                                        : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                                                        }`}
                                                >
                                                    {duration} min
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-white mb-2">Session Times *</label>
                                        {selectedDates.length === 0 ? (
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-text-muted">
                                                Select one or more dates first, then choose a time for each date.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {selectedDates.map((isoDate) => {
                                                    const slots = getAvailableTimeSlots(isoDate);
                                                    const selectedTime = selectedTimesByDate[isoDate];
                                                    return (
                                                        <div key={isoDate} className="bg-white/5 border border-white/10 rounded-xl p-3">
                                                            <p className="text-sm font-semibold text-white mb-2">
                                                                {new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                            </p>
                                                            {slots.length === 0 ? (
                                                                <p className="text-xs text-red-400">No available times for this day.</p>
                                                            ) : (
                                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                                    {slots.map((slot) => (
                                                                        <button
                                                                            key={`${isoDate}-${slot}`}
                                                                            type="button"
                                                                            onClick={() => setSelectedTimesByDate((prev) => ({ ...prev, [isoDate]: slot }))}
                                                                            className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-all ${selectedTime === slot
                                                                                ? 'bg-primary/15 text-primary border-primary/40'
                                                                                : 'bg-white/5 text-text-muted border-white/10 hover:text-white'
                                                                                }`}
                                                                        >
                                                                            {formatTimeLabel(slot)}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-1">
                                        <h3 className="text-sm font-bold text-white">Step 2: Payment</h3>
                                        <p className="text-xs text-text-muted mt-0.5">Choose how you want to pay for this booking</p>
                                    </div>

                                    {/* Payment Method - ShopCheckout style */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-bold text-white">Payment Method *</label>
                                            <button
                                                type="button"
                                                onClick={() => window.location.assign('/payment-methods')}
                                                className="text-primary text-xs font-semibold underline"
                                            >
                                                Manage methods
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <label
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${bookingData.paymentMethod === 'CASH'
                                                    ? 'bg-primary/10 border-primary/40'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="trainerPaymentMethod"
                                                    checked={bookingData.paymentMethod === 'CASH'}
                                                    onChange={() => {
                                                        setSelectedMethodId('');
                                                        setBookingData((prev) => ({ ...prev, paymentMethod: 'CASH' }));
                                                    }}
                                                    className="accent-orange-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-semibold truncate">Cash</p>
                                                    <p className="text-text-muted text-xs">Pay at the front desk after booking</p>
                                                </div>
                                            </label>
                                            {bookingData.paymentMethod === 'CASH' && (
                                                <div className="text-xs text-text-muted bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                                                    This booking will be marked as unpaid. Please settle the amount at the front desk.
                                                </div>
                                            )}
                                        </div>

                                        {paymentMethods.length === 0 ? (
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-text-muted">
                                                No saved payment methods. Please add a GCash or card first.
                                                <div className="mt-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => window.location.assign('/payment-methods')}
                                                        className="px-3 py-2 rounded-lg bg-primary text-background text-xs font-bold"
                                                    >
                                                        Add Payment Method
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 mt-2">
                                                {paymentMethods.map((method) => (
                                                    <label
                                                        key={method.id}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedMethodId === method.id
                                                            ? 'bg-primary/10 border-primary/40'
                                                            : 'bg-white/5 border-white/10 hover:border-white/20'
                                                            }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="trainerPaymentMethod"
                                                            checked={selectedMethodId === method.id}
                                                            onChange={() => {
                                                                setSelectedMethodId(method.id);
                                                                setBookingData((prev) => ({
                                                                    ...prev,
                                                                    paymentMethod: method.type === 'GCASH' ? 'GCASH' : 'CARD'
                                                                }));
                                                            }}
                                                            className="accent-orange-500"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-sm font-semibold truncate">
                                                                {method.label}
                                                                {method.isDefault && (
                                                                    <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Default</span>
                                                                )}
                                                            </p>
                                                            <p className="text-text-muted text-xs">
                                                                {method.type === 'GCASH'
                                                                    ? `${method.name} - ${method.phone}`
                                                                    : `${method.brand || 'Card'} - **** ${method.last4} - ${method.expMonth}/${method.expYear}`}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-1">
                                        <h3 className="text-sm font-bold text-white">Step 3: Notes (Optional)</h3>
                                        <p className="text-xs text-text-muted mt-0.5">Optional details to help your trainer prepare</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-white mb-2">Notes (optional)</label>
                                        <textarea
                                            value={bookingData.notes}
                                            onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                                            placeholder="Any specific goals or preferences?"
                                            rows="4"
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted focus:outline-none focus:border-primary text-base resize-none touch-manipulation"
                                        />
                                    </div>

                                    {/* Booking Summary */}
                                    <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-3">
                                        <h4 className="text-sm font-bold text-white">Step 4: Review</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-text-muted">Dates</span>
                                                <span className="text-white font-medium">{selectedDates.length}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-text-muted">Times Selected</span>
                                                <span className="text-white font-medium">{Object.keys(selectedTimesByDate).length}/{selectedDates.length}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-text-muted">Duration</span>
                                                <span className="text-white font-medium">{bookingData.duration} min</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-text-muted">Payment</span>
                                                <span className="text-white font-medium">
                                                    {bookingData.paymentMethod === 'CASH'
                                                        ? 'Cash at front desk'
                                                        : `${bookingData.paymentMethod}${selectedMethodId ? ' (saved method)' : ''}`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="border-t border-primary/20 pt-3 flex items-center justify-between">
                                            <span className="text-text-muted text-sm">Total ({selectedDates.length} session{selectedDates.length > 1 ? 's' : ''})</span>
                                            <span className="text-primary font-bold text-2xl">
                                                {formatPrice((((selectedTrainer.sessionPrice ?? 300) / 60) * bookingData.duration) * Math.max(selectedDates.length, 1))}
                                            </span>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* Modal Footer - Sticky */}
                            <div className="border-t border-white/10 p-5 sm:p-6 bg-surface sticky bottom-0 space-y-3">
                                <button
                                    onClick={handleBookSession}
                                    disabled={bookingLoading || selectedDates.length === 0 || Object.keys(selectedTimesByDate).length !== selectedDates.length || (!selectedMethodId && bookingData.paymentMethod !== 'CASH')}
                                    className="w-full py-4 bg-primary text-background rounded-xl font-bold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                >
                                    <span className="material-icons-round text-xl">check_circle</span>
                                    {bookingLoading ? 'Booking...' : 'Confirm Booking'}
                                </button>
                                <button
                                    onClick={closeModal}
                                    className="w-full py-3 bg-white/5 text-white rounded-xl font-medium text-sm hover:bg-white/10 transition-colors touch-manipulation"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add animation styles */}
            <style>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div >
    );
}
