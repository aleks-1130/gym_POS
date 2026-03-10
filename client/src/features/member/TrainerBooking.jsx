import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useConfirm } from '../../context/ConfirmContext';

const normalizeTrainerHistoryStatus = (session) => {
    const rawStatus = String(session?.status || '').toUpperCase();
    if (rawStatus === 'CANCELLED' || rawStatus === 'DECLINED') return 'CANCELLED';
    if (rawStatus === 'NO_SHOW' || rawStatus === 'MISSED') return 'MISSED';
    if (rawStatus === 'COMPLETED' || rawStatus === 'ATTENDED') return 'COMPLETED';
    if (rawStatus === 'SCHEDULED' || rawStatus === 'RESCHEDULED' || rawStatus === 'CONFIRMED') return 'MISSED';
    return 'UNKNOWN';
};

const toTrainerHistoryStatusLabel = (status) => {
    if (status === 'COMPLETED') return 'Completed';
    if (status === 'MISSED') return 'Missed';
    if (status === 'CANCELLED') return 'Cancelled';
    return 'Unknown';
};

const toTrainerHistoryStatusClass = (status) => {
    if (status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (status === 'MISSED') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (status === 'CANCELLED') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-white/10 text-text-muted border-white/20';
};

const toSessionStatusClass = (status) => {
    const raw = String(status || '').toUpperCase();
    if (raw === 'CANCELLED' || raw === 'NO_SHOW') return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (raw === 'RESCHEDULED') return 'bg-primary/10 text-primary border-primary/30';
    return 'bg-primary/15 text-primary border-primary/30';
};

const toPaymentStatusLabel = (status) => {
    const raw = String(status || '').toUpperCase();
    if (!raw || raw === 'UNPAID' || raw === 'PENDING') return 'PENDING';
    if (raw === 'PAID') return 'PAID';
    if (raw === 'CANCELLED' || raw === 'FAILED' || raw === 'VOID' || raw === 'DECLINED') return 'CANCELLED';
    return raw.replace(/_/g, ' ');
};

const toPaymentStatusClass = (status) => {
    const label = toPaymentStatusLabel(status);
    if (label === 'PAID') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (label === 'PENDING') return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    if (label === 'CANCELLED') return 'bg-red-500/10 text-red-400 border-red-500/30';
    return 'bg-white/10 text-text-muted border-white/20';
};

const fallbackTrainerImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%230f172a'/%3E%3Cstop offset='1' stop-color='%231e293b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='480' height='480' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='22'%3ETrainer Image Unavailable%3C/text%3E%3C/svg%3E";

const handleTrainerImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackTrainerImage;
};

export default function TrainerBooking() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const bookingPolicyNote = 'No refund by default for missed sessions. One reschedule is allowed with at least 24-hour notice.';
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
    const [activeTab, setActiveTab] = useState('trainers'); // trainers, bookings, history
    const [filterView, setFilterView] = useState('all'); // all, available, top-rated
    const [bookingFilter, setBookingFilter] = useState('all'); // all, upcoming, ratings
    const [bookingSearch, setBookingSearch] = useState('');
    const [showBookingFilters, setShowBookingFilters] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [paymentSelection, setPaymentSelection] = useState('CASH'); // CASH | E_WALLET | CARD
    const [rescheduleSession, setRescheduleSession] = useState(null);
    const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '', reason: '' });
    const [rescheduleLoading, setRescheduleLoading] = useState(false);
    const [rescheduleError, setRescheduleError] = useState('');
    const [rescheduleCalendarMonth, setRescheduleCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [bookingResult, setBookingResult] = useState(null);
    const [ratingSelections, setRatingSelections] = useState({});
    const [ratingSubmittingId, setRatingSubmittingId] = useState(null);

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
                const res = await axios.get(`/api/members/${user.id}/payment-methods`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                const methods = res.data || [];
                setPaymentMethods(methods);
                const defaultMethod = methods.find((m) => m.isDefault);
                if (defaultMethod) {
                    setSelectedMethodId(defaultMethod.id);
                    const defaultType = String(defaultMethod.type || '').toUpperCase();
                    const isWallet = ['GCASH', 'MAYA'].includes(defaultType);
                    setPaymentSelection(isWallet ? 'E_WALLET' : 'CARD');
                    setBookingData((prev) => ({
                        ...prev,
                        paymentMethod: isWallet ? defaultType : 'CARD'
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
        const hasOpenModal = showBookingModal || Boolean(rescheduleSession);
        if (hasOpenModal) {
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
    }, [showBookingModal, rescheduleSession]);

    const fetchTrainers = async () => {
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const res = await axios.get('/api/trainers', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setTrainers(Array.isArray(res.data) ? res.data : []);
        } catch {
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
            const res = await axios.get('/api/members/me/training-sessions', {
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
        const confirmed = await showConfirm({
            title: 'Cancel Session?',
            message: 'Are you sure you want to cancel this session?',
            confirmLabel: 'Cancel Session',
            type: 'danger'
        });
        if (!confirmed) return;

        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post(`/api/members/me/training-sessions/${sessionId}/cancel`, {}, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            await showAlert({ title: 'Session Cancelled', message: 'Session cancelled successfully.', type: 'success' });
            fetchMemberSessions();
        } catch (error) {
            console.error("Failed to cancel session", error);
            await showAlert({ title: 'Cancel Failed', message: error.response?.data?.error || 'Failed to cancel session', type: 'danger' });
        }
    };

    const handleOpenRescheduleModal = async (session) => {
        const sessionDate = new Date(session.date);
        const now = new Date();
        const hoursUntil = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntil < 24) {
            await showAlert({ title: 'Too Late to Reschedule', message: 'Rescheduling is only allowed at least 24 hours before your session.', type: 'warning' });
            return;
        }

        const currentIsoDate = toIsoDate(sessionDate);
        setRescheduleSession(session);
        setRescheduleForm({
            date: currentIsoDate,
            time: '',
            reason: ''
        });
        setRescheduleCalendarMonth(new Date(sessionDate.getFullYear(), sessionDate.getMonth(), 1));
        setRescheduleError('');
    };

    const handleSubmitReschedule = async () => {
        if (!rescheduleSession) return;
        if (!rescheduleForm.date || !rescheduleForm.time) {
            setRescheduleError('Please provide both date and time.');
            return;
        }
        const originalDate = new Date(rescheduleSession.date);
        const originalIso = toIsoDate(originalDate);
        const originalTime = `${String(originalDate.getHours()).padStart(2, '0')}:${String(originalDate.getMinutes()).padStart(2, '0')}`;
        if (rescheduleForm.date === originalIso && rescheduleForm.time === originalTime) {
            setRescheduleError('Please choose a different time from your previous schedule.');
            return;
        }
        if (!rescheduleAvailableSlots.includes(rescheduleForm.time)) {
            setRescheduleError('Selected time is not available for this trainer.');
            return;
        }

        setRescheduleLoading(true);
        setRescheduleError('');
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post(`/api/members/me/training-sessions/${rescheduleSession.id}/reschedule`, {
                date: rescheduleForm.date,
                time: rescheduleForm.time,
                reason: rescheduleForm.reason
            }, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            await showAlert({ title: 'Rescheduled!', message: 'Session rescheduled successfully.', type: 'success' });
            setRescheduleSession(null);
            setRescheduleForm({ date: '', time: '', reason: '' });
            fetchMemberSessions();
        } catch (error) {
            console.error("Failed to reschedule session", error);
            setRescheduleError(error.response?.data?.error || "Failed to reschedule session");
        } finally {
            setRescheduleLoading(false);
        }
    };

    const handleBookSession = async (e) => {
        e.preventDefault();
        if (pendingRatingSessions.length > 0) {
            await showAlert({
                title: 'Rating Required',
                message: 'Please rate your completed session(s) before booking another trainer.',
                type: 'warning'
            });
            setActiveTab('bookings');
            return;
        }
        if (!selectedTrainer || selectedDates.length === 0) {
            await showAlert({ title: 'Missing Info', message: 'Please fill in all required fields', type: 'warning' });
            return;
        }
        if (!user?.id) {
            await showAlert({ title: 'Session Expired', message: 'Member session not found. Please log in again.', type: 'warning' });
            return;
        }
        if (!selectedMethodId && bookingData.paymentMethod !== 'CASH') {
            await showAlert({ title: 'Payment Required', message: 'Please select a payment method.', type: 'warning' });
            return;
        }
        const missingTimes = selectedDates.filter((date) => !selectedTimesByDate[date]);
        if (missingTimes.length > 0) {
            await showAlert({ title: 'Missing Time', message: 'Please choose a time for all selected dates.', type: 'warning' });
            return;
        }
        const hasPastDateTime = selectedDates.some((date) => {
            const time = selectedTimesByDate[date];
            if (!time) return true;
            const scheduled = new Date(`${date}T${time}`);
            return Number.isNaN(scheduled.getTime()) || scheduled <= new Date();
        });
        if (hasPastDateTime) {
            await showAlert({ title: 'Invalid Date/Time', message: 'Past date/time is not allowed. Please select a future schedule.', type: 'warning' });
            return;
        }

        setBookingLoading(true);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const endpoint = '/api/members/book-training';
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
            const bookingBatchId = `MBR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const payload = {
                trainerId: selectedTrainer.id,
                duration: bookingData.duration,
                notes: bookingData.notes,
                method: bookingData.paymentMethod,
                bookingBatchId,
                slots: selectedDates.map((date) => ({
                    date,
                    time: selectedTimesByDate[date]
                })),
                ...(bookingData.paymentMethod !== 'CASH' ? { paymentMethodId: Number(selectedMethodId) } : {})
            };
            const response = await axios.post(endpoint, payload, { headers });
            const bookedCount = Number(response?.data?.bookedCount || selectedDates.length);
            setBookingResult({
                count: bookedCount,
                trainerName: selectedTrainer.name,
                dates: selectedDates,
                paymentMethod: bookingData.paymentMethod
            });
            setShowSuccessModal(true);

            setShowBookingModal(false);
            setSelectedTrainer(null);
            setBookingData({ duration: 60, notes: '', paymentMethod: 'CASH' });
            setSelectedDates([]);
            setSelectedTimesByDate({});
            fetchTrainers();
            fetchMemberSessions();
            setActiveTab('bookings'); // Auto-switch to bookings tab
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || "Failed to book training session";
            const errorDetail = error.response?.data?.detail;
            if (error?.response?.status === 409) {
                setActiveTab('bookings');
                closeModal();
            }
            await showAlert({ title: 'Booking Failed', message: errorDetail ? `${errorMessage}\n\nDetails: ${errorDetail}` : errorMessage, type: 'danger' });
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
        setPaymentSelection('CASH');
        setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    }, []);

    const filteredTrainers = trainers.filter(trainer => {
        if (filterView === 'available') return (trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0);
        if (filterView === 'top-rated') return trainer.rating >= 4.5;
        return true;
    });
    const trainerCardImageById = useMemo(() => {
        const map = new Map();
        trainers.forEach((trainer) => {
            const trainerId = Number(trainer?.id);
            if (!Number.isFinite(trainerId)) return;
            map.set(trainerId, trainer?.cardImageUrl || null);
        });
        return map;
    }, [trainers]);

    useEffect(() => {
        if (filterView === 'top-rated' && trainers.length > 0 && filteredTrainers.length === 0) {
            setFilterView('all');
        }
    }, [filterView, trainers.length, filteredTrainers.length]);
    const walletPaymentMethods = paymentMethods.filter((method) =>
        ['GCASH', 'MAYA'].includes(String(method.type || '').toUpperCase())
    );
    const cardPaymentMethods = paymentMethods.filter((method) =>
        !['GCASH', 'MAYA'].includes(String(method.type || '').toUpperCase())
    );
    const now = new Date();
    const upcomingSessions = memberSessions.filter((session) => new Date(session.date) >= now);
    const pastSessions = memberSessions.filter((session) => new Date(session.date) < now);
    const pendingRatingSessions = memberSessions.filter((session) =>
        String(session?.status || '').toUpperCase() === 'COMPLETED'
        && (session?.memberRating === null || session?.memberRating === undefined)
    );
    const bookingEntries = useMemo(() => {
        const upcoming = upcomingSessions.map((session) => ({ ...session, bookingType: 'upcoming' }));
        const ratings = pendingRatingSessions.map((session) => ({ ...session, bookingType: 'rating' }));

        return [...upcoming, ...ratings].sort((a, b) => {
            if (a.bookingType !== b.bookingType) return a.bookingType === 'upcoming' ? -1 : 1;
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (a.bookingType === 'upcoming') return dateA - dateB;
            return dateB - dateA;
        });
    }, [upcomingSessions, pendingRatingSessions]);
    const filteredBookingEntries = useMemo(() => {
        const query = bookingSearch.trim().toLowerCase();
        return bookingEntries.filter((entry) => {
            if (bookingFilter === 'upcoming' && entry.bookingType !== 'upcoming') return false;
            if (bookingFilter === 'ratings' && entry.bookingType !== 'rating') return false;

            if (query) {
                const searchableText = [
                    entry?.trainer?.name,
                    entry?.status,
                    entry?.paymentStatus,
                    entry?.notes,
                    entry?.date
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!searchableText.includes(query)) return false;
            }
            return true;
        });
    }, [bookingEntries, bookingFilter, bookingSearch]);
    const trainerHistoryEntries = useMemo(() => (
        pastSessions
            .map((session) => {
                const date = new Date(session?.date);
                if (Number.isNaN(date.getTime())) return null;
                return {
                    ...session,
                    date,
                    normalizedHistoryStatus: normalizeTrainerHistoryStatus(session)
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.date - a.date)
    ), [pastSessions]);
    const filteredTrainerHistoryEntries = useMemo(() => {
        if (historyFilter === 'all') return trainerHistoryEntries;
        if (historyFilter === 'completed') return trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'COMPLETED');
        if (historyFilter === 'missed') return trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'MISSED');
        if (historyFilter === 'cancelled') return trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'CANCELLED');
        return trainerHistoryEntries;
    }, [trainerHistoryEntries, historyFilter]);
    const trainerHistoryStatusCounts = useMemo(() => ({
        completed: trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'COMPLETED').length,
        missed: trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'MISSED').length,
        cancelled: trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'CANCELLED').length
    }), [trainerHistoryEntries]);
    const visibleUpcomingSessions = useMemo(
        () => filteredBookingEntries.filter((entry) => entry.bookingType === 'upcoming'),
        [filteredBookingEntries]
    );
    const visibleRatingSessions = useMemo(
        () => filteredBookingEntries.filter((entry) => entry.bookingType === 'rating'),
        [filteredBookingEntries]
    );
    const canBookNewSession = pendingRatingSessions.length === 0;

    const handleSubmitSessionRating = async (session) => {
        const rating = Number(ratingSelections[session.id] || 0);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            await showAlert({ title: 'Rating Required', message: 'Please select a star rating (1 to 5).', type: 'warning' });
            return;
        }

        setRatingSubmittingId(session.id);
        try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            await axios.post(`/api/members/me/training-sessions/${session.id}/rate`, { rating }, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            setRatingSelections((prev) => {
                const next = { ...prev };
                delete next[session.id];
                return next;
            });
            await Promise.all([fetchMemberSessions(), fetchTrainers()]);
            await showAlert({ title: 'Thanks for the rating', message: 'Your trainer rating has been recorded.', type: 'success' });
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to submit trainer rating.';
            await showAlert({ title: 'Rating Failed', message, type: 'danger' });
        } finally {
            setRatingSubmittingId(null);
        }
    };

    useEffect(() => {
        if (showBookingModal && !canBookNewSession) {
            closeModal();
        }
    }, [showBookingModal, canBookNewSession, closeModal]);


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

    const isTrainerDateAvailable = (trainer, isoDate) => {
        const window = getTrainerDateWindow(trainer, isoDate);
        if (!window) return false;
        const start = toMinutes(window.start);
        const end = toMinutes(window.end);
        return start !== null && end !== null && end > start;
    };

    const getRescheduleAvailableTimeSlots = useCallback((session, isoDate) => {
        if (!session || !isoDate) return [];
        const trainerId = Number(session.trainer?.id || session.trainerId);
        const trainer = trainers.find((t) => Number(t.id) === trainerId);
        if (!trainer) return [];

        const dateObj = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(dateObj.getTime())) return [];

        const window = getTrainerDateWindow(trainer, isoDate);
        if (!window) return [];
        const interval = Number(trainer.availabilityIntervalMinutes) || 30;
        const start = toMinutes(window.start);
        const end = toMinutes(window.end);
        if (start === null || end === null || end <= start) return [];

        const bookedSessions = (trainer.trainingSessions || [])
            .filter((s) => {
                if (s.status === 'CANCELLED') return false;
                if (Number(s.id) === Number(session.id)) return false;
                const sDate = new Date(s.date);
                return toIsoDate(sDate) === isoDate;
            })
            .map((s) => {
                const sDate = new Date(s.date);
                const startMins = sDate.getHours() * 60 + sDate.getMinutes();
                return {
                    start: startMins,
                    end: startMins + (Number(s.duration) || 60)
                };
            });

        const duration = Number(session.duration) || 60;
        const slots = [];
        const todayIso = toIsoDate(new Date());
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        for (let t = start; t + duration <= end; t += interval) {
            const slotStart = t;
            const slotEnd = t + duration;

            if (isoDate === todayIso && slotStart <= nowMinutes) continue;

            const isBlocked = bookedSessions.some((b) => slotStart < b.end && slotEnd > b.start);
            if (!isBlocked) {
                const hh = String(Math.floor(t / 60)).padStart(2, '0');
                const mm = String(t % 60).padStart(2, '0');
                slots.push(`${hh}:${mm}`);
            }
        }

        return slots;
    }, [trainers]);

    const rescheduleAvailableSlots = useMemo(() => {
        if (!rescheduleSession || !rescheduleForm.date) return [];
        const slots = getRescheduleAvailableTimeSlots(rescheduleSession, rescheduleForm.date);
        const originalDate = new Date(rescheduleSession.date);
        const originalIso = toIsoDate(originalDate);
        const originalTime = `${String(originalDate.getHours()).padStart(2, '0')}:${String(originalDate.getMinutes()).padStart(2, '0')}`;
        if (rescheduleForm.date === originalIso) {
            return slots.filter((slot) => slot !== originalTime);
        }
        return slots;
    }, [rescheduleSession, rescheduleForm.date, getRescheduleAvailableTimeSlots]);

    const showBookingPolicy = async () => {
        await showAlert({
            title: 'Trainer Session Policy',
            message: bookingPolicyNote,
            type: 'info'
        });
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

    const rescheduleCalendarCells = useMemo(() => {
        const start = new Date(rescheduleCalendarMonth.getFullYear(), rescheduleCalendarMonth.getMonth(), 1);
        const end = new Date(rescheduleCalendarMonth.getFullYear(), rescheduleCalendarMonth.getMonth() + 1, 0);
        const leading = start.getDay();
        const cells = [];
        for (let i = 0; i < leading; i += 1) cells.push(null);
        for (let d = 1; d <= end.getDate(); d += 1) {
            cells.push(new Date(rescheduleCalendarMonth.getFullYear(), rescheduleCalendarMonth.getMonth(), d));
        }
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [rescheduleCalendarMonth]);

    const rescheduleTrainer = useMemo(() => {
        if (!rescheduleSession) return null;
        const trainerId = Number(rescheduleSession.trainer?.id || rescheduleSession.trainerId);
        return trainers.find((t) => Number(t.id) === trainerId) || null;
    }, [rescheduleSession, trainers]);

    const getAvailableTimeSlots = useCallback((isoDate) => {
        if (!selectedTrainer) return [];
        const dateObj = new Date(`${isoDate}T00:00:00`);
        if (Number.isNaN(dateObj.getTime())) return [];

        const window = getTrainerDateWindow(selectedTrainer, isoDate);
        if (!window) return [];
        const interval = Number(selectedTrainer.availabilityIntervalMinutes) || 30;
        const start = toMinutes(window.start);
        const end = toMinutes(window.end);

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
    }, [selectedTrainer, bookingData.duration]);

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
        <div className="pb-20 px-4 max-w-5xl mx-auto space-y-4 sm:space-y-5">
            {/* Header - PWA Sticky */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-4 space-y-3 border-b border-white/5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white">
                            {activeTab === 'bookings'
                                ? 'My Bookings'
                                : activeTab === 'history'
                                    ? 'Session History'
                                    : 'Personal Trainers'}
                        </h1>
                        <p className="text-text-muted text-xs mt-0.5">
                            {activeTab === 'bookings'
                                ? 'Manage upcoming trainer sessions and pending ratings'
                                : activeTab === 'history'
                                    ? 'Review completed, missed, and cancelled past trainer sessions'
                                    : 'Find your trainer and book sessions quickly'}
                        </p>
                    </div>
                    {activeTab !== 'trainers' && (
                        <button
                            type="button"
                            onClick={showBookingPolicy}
                            className="shrink-0 h-9 w-9 rounded-lg border border-white/10 bg-surface text-text-secondary hover:text-white hover:bg-white/5"
                            aria-label="View trainer session policy"
                            title="Session policy"
                        >
                            <span className="material-icons-round text-base">info</span>
                        </button>
                    )}
                </div>

                {/* Primary Tabs */}
                <div className="grid grid-cols-3 gap-2 rounded-2xl p-1.5 bg-surface/80 border border-white/10 shadow-inner">
                    <button
                        type="button"
                        onClick={() => setActiveTab('trainers')}
                        className={`py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'trainers'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">group</span>
                        Trainers
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('bookings')}
                        className={`relative py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'bookings'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">event_note</span>
                        <span>My Bookings</span>
                        {bookingEntries.length > 0 && (
                            <span className={`absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${activeTab === 'bookings' ? 'bg-background/20 text-background' : 'bg-white/10 text-white'}`}>
                                {bookingEntries.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`relative py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'history'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">history</span>
                        <span>History</span>
                        {trainerHistoryEntries.length > 0 && (
                            <span className={`absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none ${activeTab === 'history' ? 'bg-background/20 text-background' : 'bg-white/10 text-white'}`}>
                                {trainerHistoryEntries.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Trainer Filters */}
                {activeTab === 'trainers' && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'all', label: 'All' },
                                { value: 'available', label: 'Available' },
                                { value: 'top-rated', label: 'Top Rated' }
                            ].map((tab) => (
                                <button
                                    key={tab.value}
                                    onClick={() => setFilterView(tab.value)}
                                    className={`px-2.5 py-2 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all border text-center ${filterView === tab.value
                                        ? 'bg-white text-black shadow-sm border-white'
                                        : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {!canBookNewSession && (
                            <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-xs text-text-muted flex items-start gap-2">
                                <span className="material-icons-round text-base text-primary">priority_high</span>
                                <span>Booking is temporarily locked. Complete the required trainer ratings in <strong>My Bookings</strong>.</span>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'completed', label: 'Done' },
                            { value: 'missed', label: 'Missed' },
                            { value: 'cancelled', label: 'Cancelled' }
                        ].map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setHistoryFilter(item.value)}
                                className={`px-2 py-2 rounded-lg text-[11px] font-semibold border transition-all ${historyFilter === item.value
                                    ? 'bg-white text-black border-white shadow-sm'
                                    : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {activeTab === 'bookings' ? (
                /* My Booked Sessions */
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-300 font-bold">BOOKED SESSIONS</p>
                            <p className="text-2xl font-black text-white mt-1">{upcomingSessions.length}</p>
                            <p className="text-[11px] text-text-muted mt-1">Upcoming trainer sessions</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-amber-300 font-bold">RATINGS</p>
                            <p className="text-2xl font-black text-white mt-1">{pendingRatingSessions.length}</p>
                            <p className="text-[11px] text-text-muted mt-1">Needs your rating</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="relative flex-1">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-sm text-text-muted">search</span>
                            <input
                                type="text"
                                value={bookingSearch}
                                onChange={(event) => setBookingSearch(event.target.value)}
                                placeholder="Search sessions"
                                className="h-8 w-full rounded-lg border border-white/10 bg-surface pl-8 pr-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowBookingFilters((prev) => !prev)}
                            className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${showBookingFilters || bookingFilter !== 'all'
                                ? 'bg-white text-black border-white'
                                : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                }`}
                        >
                            <span className="material-icons-round text-sm">tune</span>
                            Filter
                        </button>
                    </div>
                    <p className="text-[11px] text-text-muted">
                        {bookingFilter === 'all'
                            ? 'Showing upcoming bookings and sessions pending rating.'
                            : bookingFilter === 'upcoming'
                                ? 'Filter: Upcoming sessions'
                                : 'Filter: Needs rating'}
                    </p>

                    {showBookingFilters && (
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'all', label: 'All', icon: 'grid_view' },
                                { value: 'upcoming', label: 'Upcoming', icon: 'event_available' },
                                { value: 'ratings', label: 'Ratings', icon: 'star' }
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setBookingFilter(item.value)}
                                    className={`px-2.5 py-2 rounded-lg font-bold text-[11px] transition-all border flex items-center justify-center gap-1 ${bookingFilter === item.value
                                        ? 'bg-white text-black shadow-sm border-white'
                                        : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                        }`}
                                >
                                    <span className="material-icons-round text-sm">{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {sessionsLoading ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-text-muted flex items-center gap-2">
                            <span className="material-icons-round text-base animate-pulse">autorenew</span>
                            Loading your sessions...
                        </div>
                    ) : sessionsError ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
                            {sessionsError}
                        </div>
                    ) : memberSessions.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-sm text-text-muted text-center">
                            <span className="material-icons-round text-3xl text-text-muted/70 block mb-2">event_busy</span>
                            You have no trainer bookings yet.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {bookingFilter !== 'ratings' && (
                                <section className="space-y-3 rounded-2xl border border-white/10 bg-surface p-3 sm:p-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    BOOKED SESSIONS
                                </h3>
                                {visibleUpcomingSessions.length === 0 ? (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-text-muted">
                                        No upcoming booked sessions.
                                    </div>
                                ) : visibleUpcomingSessions.map((session) => {
                                    const sessionDate = new Date(session.date);
                                    const hoursUntil = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                                    const canRequestReschedule = hoursUntil >= 24 && session.status === 'SCHEDULED';
                                    const trainerId = Number(session?.trainer?.id || session?.trainerId);
                                    const trainerImage = trainerCardImageById.get(trainerId) || session?.trainer?.cardImageUrl || null;
                                    const bookingTimeLabel = sessionDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                                    const bookingDateLabel = sessionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                    const bookingWeekdayLabel = sessionDate.toLocaleDateString(undefined, { weekday: 'long' });
                                    return (
                                        <div key={session.id} className="bg-surface rounded-xl p-4 border border-primary/30 bg-primary/5 transition-all hover:border-primary/40">
                                            <div className="space-y-3">
                                                <div className="flex gap-3">
                                                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                                        {trainerImage ? (
                                                            <img src={trainerImage} alt={session.trainer?.name || 'Trainer'} onError={handleTrainerImageError} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                                <span className="material-icons-round text-2xl">person</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] uppercase tracking-wide text-text-muted">Next Session</p>
                                                                <p className="text-sm font-bold text-white">{bookingDateLabel}</p>
                                                                <p className="text-[11px] text-text-muted">{bookingWeekdayLabel}</p>
                                                                <p className="mt-0.5 text-lg font-extrabold text-primary leading-none">{bookingTimeLabel}</p>
                                                            </div>
                                                            <div className="shrink-0 flex flex-col items-end gap-1">
                                                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${toSessionStatusClass(session.status)}`}>
                                                                    {session.status || 'SCHEDULED'}
                                                                </span>
                                                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${toPaymentStatusClass(session.paymentStatus)}`}>
                                                                    {toPaymentStatusLabel(session.paymentStatus)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <h3 className="mt-2 text-base font-bold text-white leading-tight break-words">{session.trainer?.name || 'Trainer'}</h3>

                                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="material-icons-round text-sm">schedule</span>
                                                                {session.duration} min
                                                            </span>
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="material-icons-round text-sm">payments</span>
                                                                {formatPrice(session.price)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {canRequestReschedule && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenRescheduleModal(session); }}
                                                            className="flex-1 py-2.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 active:scale-95 transition-all text-sm border border-primary/25 flex items-center justify-center gap-1"
                                                        >
                                                            <span className="material-icons-round text-base">update</span>
                                                            Reschedule
                                                        </button>
                                                    )}
                                                    {session.status !== 'CANCELLED' && session.status !== 'NO_SHOW' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCancelSession(session.id); }}
                                                            className={`${canRequestReschedule ? 'flex-1' : 'w-full'} py-2.5 rounded-lg bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 active:scale-95 transition-all text-sm border border-red-500/20 flex items-center justify-center gap-1`}
                                                        >
                                                            <span className="material-icons-round text-base">cancel</span>
                                                            Cancel Booking
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                </section>
                            )}

                            {bookingFilter !== 'upcoming' && (
                                <section className="space-y-3 rounded-2xl border border-white/10 bg-surface p-3 sm:p-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                                    <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" />
                                    RATINGS
                                </h3>
                                {visibleRatingSessions.length === 0 ? (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-text-muted">
                                        No sessions need rating right now.
                                    </div>
                                ) : visibleRatingSessions.map((session) => {
                                    const sessionDate = new Date(session.date);
                                    const selectedRating = Number(ratingSelections[session.id] || 0);
                                    return (
                                        <div key={`pending-rating-${session.id}`} className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-white font-semibold text-sm sm:text-base leading-tight break-words">{session.trainer?.name || 'Trainer'}</p>
                                                    <p className="text-text-muted text-xs sm:text-sm mt-0.5">
                                                        {sessionDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                        {' at '}
                                                        {sessionDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-md border bg-white/10 text-text-secondary border-white/20">
                                                    {session.duration} min
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center gap-1.5">
                                                {[1, 2, 3, 4, 5].map((score) => (
                                                    <button
                                                        key={`${session.id}-rating-${score}`}
                                                        type="button"
                                                        onClick={() => setRatingSelections((prev) => ({ ...prev, [session.id]: score }))}
                                                        className={`w-9 h-9 rounded-lg border text-lg font-bold transition-all ${selectedRating >= score
                                                            ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300'
                                                            : 'bg-white/5 border-white/15 text-white/40 hover:text-yellow-300 hover:border-yellow-300/40'
                                                            }`}
                                                        aria-label={`Rate ${score} stars`}
                                                    >
                                                        <span className="material-icons-round text-base">star</span>
                                                    </button>
                                                ))}
                                                <span className="ml-2 text-xs text-text-muted">{selectedRating > 0 ? `${selectedRating}/5` : 'Select rating'}</span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                <span className="text-[11px] text-text-muted">Please rate to unlock new bookings.</span>
                                                <button
                                                    type="button"
                                                    disabled={ratingSubmittingId === session.id || selectedRating < 1}
                                                    onClick={() => handleSubmitSessionRating(session)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-background hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {ratingSubmittingId === session.id ? 'Saving...' : 'Submit Rating'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                </section>
                            )}

                        </div>
                    )}
                </div>
            ) : activeTab === 'history' ? (
                <section className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Completed</p>
                            <p className="text-base font-bold text-emerald-300 mt-1">{trainerHistoryStatusCounts.completed}</p>
                        </div>
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Missed</p>
                            <p className="text-base font-bold text-rose-300 mt-1">{trainerHistoryStatusCounts.missed}</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-text-muted">Cancelled</p>
                            <p className="text-base font-bold text-amber-300 mt-1">{trainerHistoryStatusCounts.cancelled}</p>
                        </div>
                    </div>

                    <div className="bg-surface border border-white/10 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-white font-bold text-base">Trainer Session History</h2>
                                <p className="text-text-muted text-xs mt-0.5">Review your completed, missed, and cancelled past trainer sessions</p>
                            </div>
                            <button
                                type="button"
                                onClick={fetchMemberSessions}
                                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-text-muted hover:text-white"
                            >
                                Refresh
                            </button>
                        </div>

                        {sessionsLoading ? (
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-muted">Loading session history...</div>
                        ) : sessionsError ? (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-4 text-sm text-red-300">{sessionsError}</div>
                        ) : filteredTrainerHistoryEntries.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-muted">No past session history found for this filter.</div>
                        ) : (
                            <div className="space-y-2.5">
                                {filteredTrainerHistoryEntries.map((entry) => (
                                    <article key={`trainer-history-${entry.id}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{entry?.trainer?.name || 'Trainer Session'}</p>
                                                <p className="text-[11px] text-text-muted mt-0.5">
                                                    {entry.date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    {' at '}
                                                    {entry.date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${toTrainerHistoryStatusClass(entry.normalizedHistoryStatus)}`}>
                                                {toTrainerHistoryStatusLabel(entry.normalizedHistoryStatus)}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                            <span className="inline-flex items-center gap-1">
                                                <span className="material-icons-round text-sm">schedule</span>
                                                {entry.duration} min
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <span className="material-icons-round text-sm">payments</span>
                                                {formatPrice(entry.price)}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <span className="material-icons-round text-sm">event</span>
                                                {String(entry.status || '').replace(/_/g, ' ') || 'N/A'}
                                            </span>
                                            {String(entry.status || '').toUpperCase() === 'COMPLETED' && (
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">star</span>
                                                    {entry.memberRating ? `Rated ${entry.memberRating}/5` : 'Not Rated'}
                                                </span>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
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
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                        {filteredTrainers.map(trainer => (
                            <div key={trainer.id} className="bg-surface/95 rounded-2xl border border-white/10 overflow-hidden hover:border-primary/30 transition-all group flex flex-col shadow-lg shadow-black/15">
                                {/* Trainer Image */}
                                <div className="aspect-[4/3] bg-white/5 overflow-hidden relative">
                                    {trainer.cardImageUrl ? (
                                        <img
                                            src={trainer.cardImageUrl}
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
                                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md rounded-full px-2 py-1 flex items-center gap-1">
                                        <span className="material-icons-round text-sm text-yellow-400">star</span>
                                        <span className="text-white font-bold text-xs">{Number(trainer.rating || 0).toFixed(1)}</span>
                                    </div>

                                    {/* Experience Tag */}
                                    {trainer.experience && (
                                        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md rounded-lg px-2 py-1">
                                            <span className="text-white font-medium text-[10px]">{trainer.experience}y exp</span>
                                        </div>
                                    )}
                                </div>

                                {/* Trainer Info */}
                                <div className="p-3 sm:p-4 flex flex-col flex-1">
                                    <div className="mb-2.5">
                                        <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-2">{trainer.name}</h3>
                                        <p className="text-text-muted text-[11px] mt-0.5 line-clamp-1">{trainer.specialization || 'Personal Trainer'}</p>
                                        {trainer.statusDescription && (
                                            <p className="text-[11px] text-white/70 mt-1.5 line-clamp-2">{trainer.statusDescription}</p>
                                        )}
                                    </div>

                                    {/* Bio */}
                                    {trainer.bio && (
                                        <p className="hidden sm:block text-text-muted text-xs mb-2.5 line-clamp-2 leading-relaxed">
                                            {trainer.bio}
                                        </p>
                                    )}

                                    {/* Specializations */}
                                    {getTrainerSpecialties(trainer).length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-1.5">
                                            {getTrainerSpecialties(trainer).slice(0, 2).map((specialty, idx) => (
                                                <span key={idx} className="bg-white/10 text-text-secondary px-2 py-0.5 rounded-md text-[10px] font-medium">
                                                    {specialty}
                                                </span>
                                            ))}
                                            {getTrainerSpecialties(trainer).length > 2 && (
                                                <span className="text-text-muted text-[10px] py-0.5 px-1">+{getTrainerSpecialties(trainer).length - 2} more</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-auto space-y-2.5">
                                        {/* Price */}
                                        <div className="flex justify-between items-center py-2 border-t border-white/10">
                                            <span className="text-text-muted text-[11px]">60 min</span>
                                            <span className="text-primary font-extrabold text-base sm:text-lg">{formatPrice(trainer.sessionPrice ?? 300)}</span>
                                        </div>

                                        {/* Availability */}
                                        <div className="flex items-center gap-1.5 text-[11px]">
                                            <div className={`w-1.5 h-1.5 rounded-full ${(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0) ? 'bg-green-400' : 'bg-amber-400'}`}></div>
                                            <span className={`line-clamp-1 ${(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0) ? 'text-green-400' : 'text-amber-400'}`}>
                                                {(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0)
                                                    ? `${Object.keys(trainer.availabilityByDay).length} available day(s)`
                                                    : 'Availability not set'
                                                }
                                            </span>
                                        </div>

                                        {/* Book Button - Touch Optimized */}
                                        <button
                                            onClick={() => {
                                                if (!canBookNewSession) {
                                                    showAlert({
                                                        title: 'Rating Required',
                                                        message: 'Please rate your completed session(s) first.',
                                                        type: 'warning'
                                                    });
                                                    setActiveTab('bookings');
                                                    return;
                                                }
                                                const defaultMethod = paymentMethods.find((m) => m.isDefault) || paymentMethods[0] || null;
                                                if (defaultMethod) {
                                                    const methodType = String(defaultMethod.type || '').toUpperCase();
                                                    const isWallet = ['GCASH', 'MAYA'].includes(methodType);
                                                    setPaymentSelection(isWallet ? 'E_WALLET' : 'CARD');
                                                    setSelectedMethodId(defaultMethod.id);
                                                    setBookingData((prev) => ({
                                                        ...prev,
                                                        paymentMethod: isWallet ? methodType : 'CARD'
                                                    }));
                                                } else {
                                                    setPaymentSelection('CASH');
                                                    setSelectedMethodId('');
                                                    setBookingData((prev) => ({ ...prev, paymentMethod: 'CASH' }));
                                                }
                                                setSelectedTrainer(trainer);
                                                setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                                                setShowBookingModal(true);
                                            }}
                                            disabled={!canBookNewSession}
                                            className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 touch-manipulation ${canBookNewSession
                                                ? 'bg-primary text-background hover:brightness-110 shadow-lg shadow-primary/25'
                                                : 'bg-white/10 text-text-muted border border-white/10 cursor-not-allowed'
                                                }`}
                                        >
                                            <span className="material-icons-round text-base">event</span>
                                            {canBookNewSession ? 'Book Now' : 'Rate First'}
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
                                            {selectedTrainer.cardImageUrl ? (
                                                <img src={selectedTrainer.cardImageUrl} alt={selectedTrainer.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-icons-round text-text-muted text-2xl">person</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-base truncate">{selectedTrainer.name}</p>
                                            <p className="text-text-muted text-sm truncate">{selectedTrainer.specialization}</p>
                                            <p className="text-primary font-bold text-lg mt-1">{formatPrice(selectedTrainer.sessionPrice ?? 300)}/session</p>
                                            {selectedTrainer.statusDescription && (
                                                <p className="text-xs text-white/70 mt-1 line-clamp-2">{selectedTrainer.statusDescription}</p>
                                            )}
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
                                                    const unavailableDay = !isTrainerDateAvailable(selectedTrainer, iso);
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

                                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-sm font-bold text-white">Payment Method *</label>
                                            <button
                                                type="button"
                                                onClick={() => window.location.assign('/payment-methods')}
                                                className="text-primary text-xs font-semibold underline"
                                            >
                                                Manage methods
                                            </button>
                                        </div>

                                        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                                            {['CASH', 'E_WALLET', 'CARD'].map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => {
                                                        setPaymentSelection(type);
                                                        if (type === 'CASH') {
                                                            setSelectedMethodId('');
                                                            setBookingData((prev) => ({ ...prev, paymentMethod: 'CASH' }));
                                                            return;
                                                        }
                                                        const source = type === 'E_WALLET' ? walletPaymentMethods : cardPaymentMethods;
                                                        const preferred = source.find((m) => m.isDefault) || source[0] || null;
                                                        if (!preferred) {
                                                            setSelectedMethodId('');
                                                            setBookingData((prev) => ({ ...prev, paymentMethod: type === 'E_WALLET' ? 'GCASH' : 'CARD' }));
                                                            return;
                                                        }
                                                        const selectedType = String(preferred.type || '').toUpperCase();
                                                        setSelectedMethodId(preferred.id);
                                                        setBookingData((prev) => ({
                                                            ...prev,
                                                            paymentMethod: type === 'E_WALLET' ? selectedType : 'CARD'
                                                        }));
                                                    }}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${paymentSelection === type
                                                        ? 'bg-primary text-background'
                                                        : 'text-text-muted hover:text-white hover:bg-white/5'
                                                        }`}
                                                >
                                                    {type === 'E_WALLET' ? 'E-Wallet' : type === 'CARD' ? 'Card' : 'Cash'}
                                                </button>
                                            ))}
                                        </div>

                                        {paymentSelection === 'CASH' && (
                                            <div className="text-xs text-text-muted bg-black/20 border border-white/5 rounded-xl px-3 py-3 mt-2">
                                                This booking will be marked as unpaid. Please settle the amount at the front desk.
                                            </div>
                                        )}

                                        {paymentSelection !== 'CASH' && (
                                            (paymentSelection === 'E_WALLET' ? walletPaymentMethods.length === 0 : cardPaymentMethods.length === 0) ? (
                                                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-sm text-text-muted mt-2">
                                                    No saved {paymentSelection === 'E_WALLET' ? 'e-wallet' : 'card'} methods. Please add one first.
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
                                                    {(paymentSelection === 'E_WALLET' ? walletPaymentMethods : cardPaymentMethods).map((method) => (
                                                        <label
                                                            key={method.id}
                                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedMethodId === method.id
                                                                ? 'bg-primary/10 border-primary/40'
                                                                : 'bg-black/20 border-white/5 hover:border-white/15'
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="trainerPaymentMethod"
                                                                checked={selectedMethodId === method.id}
                                                                onChange={() => {
                                                                    const methodType = String(method.type || '').toUpperCase();
                                                                    setSelectedMethodId(method.id);
                                                                    setBookingData((prev) => ({
                                                                        ...prev,
                                                                        paymentMethod: paymentSelection === 'E_WALLET' ? methodType : 'CARD'
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
                                                                    {['GCASH', 'MAYA'].includes(String(method.type || '').toUpperCase())
                                                                        ? `${String(method.type || '').toUpperCase() === 'MAYA' ? 'Maya' : 'GCash'} - ${method.phone}`
                                                                        : `${method.brand || 'Card'} - **** ${method.last4} - ${method.expMonth}/${method.expYear}`}
                                                                </p>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            )
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
                                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 space-y-3">
                                        <h4 className="text-sm font-bold text-white">Step 4: Order Details</h4>
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
                                        <div className="border-t border-white/10 pt-3 flex items-center justify-between">
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
                                    disabled={!canBookNewSession || bookingLoading || selectedDates.length === 0 || Object.keys(selectedTimesByDate).length !== selectedDates.length || (!selectedMethodId && bookingData.paymentMethod !== 'CASH')}
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

            {rescheduleSession && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-white/10">
                            <div>
                                <h3 className="text-lg font-bold text-white">Reschedule Session</h3>
                                <p className="text-text-muted text-xs mt-0.5">Review details and choose your new schedule</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRescheduleSession(null)}
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"
                            >
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="text-text-muted">Trainer</span>
                                    <span className="text-white font-semibold text-right">{rescheduleSession.trainer?.name || 'Trainer'}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-text-muted">Current Schedule</span>
                                    <span className="text-white font-semibold text-right">
                                        {new Date(rescheduleSession.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        {' at '}
                                        {new Date(rescheduleSession.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-text-muted">Duration</span>
                                    <span className="text-white font-semibold">{rescheduleSession.duration} min</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-text-muted">Payment</span>
                                    <span className="text-white font-semibold">
                                        <span className="material-icons-round text-base">star</span>
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-white mb-2">New Date *</label>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setRescheduleCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                                        >
                                            <span className="material-icons-round text-base">chevron_left</span>
                                        </button>
                                        <p className="text-sm font-semibold text-white">
                                            {rescheduleCalendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setRescheduleCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
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
                                        {rescheduleCalendarCells.map((day, idx) => {
                                            if (!day) return <div key={`reschedule-blank-${idx}`} className="h-9" />;
                                            const iso = toIsoDate(day);
                                            const todayIso = toIsoDate(new Date());
                                            const isPast = iso < todayIso;
                                            const unavailableDay = !isTrainerDateAvailable(rescheduleTrainer, iso);
                                            const selected = rescheduleForm.date === iso;
                                            return (
                                                <button
                                                    key={iso}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isPast || unavailableDay) return;
                                                        setRescheduleForm((prev) => ({ ...prev, date: iso, time: '' }));
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

                            <div>
                                <label className="block text-sm font-bold text-white mb-2">New Time *</label>
                                <select
                                    value={rescheduleForm.time}
                                    onChange={(e) => setRescheduleForm((prev) => ({ ...prev, time: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary cursor-pointer"
                                    disabled={!rescheduleForm.date || rescheduleAvailableSlots.length === 0}
                                >
                                    <option style={{ color: '#111', backgroundColor: '#fff' }} value="">
                                        {!rescheduleForm.date
                                            ? 'Select date first'
                                            : (rescheduleAvailableSlots.length === 0 ? 'No available time slots' : 'Select available time')}
                                    </option>
                                    {rescheduleAvailableSlots.map((slot) => (
                                        <option
                                            key={slot}
                                            value={slot}
                                            style={{ color: '#111', backgroundColor: '#fff' }}
                                        >
                                            {formatTimeLabel(slot)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-white mb-2">Reason (optional)</label>
                                <textarea
                                    rows={3}
                                    value={rescheduleForm.reason}
                                    onChange={(e) => setRescheduleForm((prev) => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Tell your trainer why you need to reschedule"
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-text-muted focus:outline-none focus:border-primary resize-none"
                                />
                            </div>

                            {rescheduleError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
                                    {rescheduleError}
                                </div>
                            )}

                            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-xs text-text-muted">
                                Policy reminder: One member reschedule is allowed with at least 24-hour notice. Refund is not automatic for missed sessions.
                            </div>
                        </div>

                        <div className="p-5 border-t border-white/10 bg-surface space-y-2">
                            <button
                                type="button"
                                onClick={handleSubmitReschedule}
                                disabled={rescheduleLoading}
                                className="w-full py-3 rounded-xl font-bold bg-primary text-background hover:brightness-110 transition-all disabled:opacity-50"
                            >
                                {rescheduleLoading ? 'Submitting...' : 'Confirm Reschedule'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setRescheduleSession(null)}
                                disabled={rescheduleLoading}
                                className="w-full py-3 rounded-xl font-medium bg-white/5 text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        onClick={() => setShowSuccessModal(false)}
                    />
                    <div className="relative w-full max-w-sm bg-surface rounded-3xl border border-primary/20 p-6 shadow-2xl animate-in zoom-in duration-300 text-center">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                            <span className="material-icons-round text-5xl text-primary">check_circle</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Booking Success!</h2>
                        <p className="text-text-muted text-sm mb-6 px-4">
                            You've successfully booked {bookingResult?.count} session{bookingResult?.count > 1 ? 's' : ''} with <strong>{bookingResult?.trainerName}</strong>.
                        </p>

                        <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5 text-left">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-text-muted">Payment Method</span>
                                <span className="text-xs font-bold text-primary">{bookingResult?.paymentMethod === 'CASH' ? 'Pay at Front Desk' : bookingResult?.paymentMethod}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-text-muted block">Booked Dates</span>
                                {bookingResult?.dates?.map((date, idx) => (
                                    <div key={idx} className="text-sm text-white font-medium">
                                        {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full py-4 bg-primary text-background rounded-2xl font-bold text-base hover:bg-primary-hover transition-all shadow-lg active:scale-95"
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
