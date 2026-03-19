import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useConfirm } from '../../context/ConfirmContext';
import MemberPageHeader from './components/MemberPageHeader';

const parseSessionExceptionFlags = (session) => {
    const rawStatus = String(session?.status || '').toUpperCase();
    const lines = String(session?.notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const markedNoShow = rawStatus === 'NO_SHOW' || lines.some((line) => line.startsWith('Marked NO_SHOW'));
    const refundApproved = lines.some((line) => line.startsWith('REFUND_EXCEPTION_APPROVED'));

    return {
        markedNoShow,
        refundApproved
    };
};

const normalizeTrainerHistoryStatus = (session) => {
    const rawStatus = String(session?.status || '').toUpperCase();
    const flags = parseSessionExceptionFlags(session);
    if (flags.markedNoShow && flags.refundApproved) return 'MISSED';
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

const ACTIVE_BOOKING_STATUSES = ['SCHEDULED', 'RESCHEDULED'];

const hasActiveBookingStatus = (session) => ACTIVE_BOOKING_STATUSES.includes(String(session?.status || '').toUpperCase());

const getSessionWindow = (session) => {
    const start = new Date(session?.date);
    if (Number.isNaN(start.getTime())) return null;
    const durationMinutes = Math.max(0, Number(session?.duration || 0));
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return { start, end };
};

const isSessionOngoing = (session, now = new Date()) => {
    if (!hasActiveBookingStatus(session)) return false;
    const window = getSessionWindow(session);
    if (!window) return false;
    return now >= window.start && now < window.end;
};

const isSessionUpcoming = (session, now = new Date()) => {
    if (!hasActiveBookingStatus(session)) return false;
    const window = getSessionWindow(session);
    if (!window) return false;
    return now < window.start;
};

const fallbackTrainerImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%230f172a'/%3E%3Cstop offset='1' stop-color='%231e293b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='480' height='480' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='22'%3ETrainer Image Unavailable%3C/text%3E%3C/svg%3E";
const fallbackMemberAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23111827'/%3E%3Cstop offset='1' stop-color='%231e293b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='60' cy='60' r='60' fill='url(%23g)'/%3E%3Ccircle cx='60' cy='46' r='20' fill='%23475569'/%3E%3Cpath d='M24 101c8-17 22-27 36-27s28 10 36 27' fill='%23475569'/%3E%3C/svg%3E";
const RATING_COMMENT_LIMIT = 500;
const TOP_RATED_MIN_SCORE = 4.5;
const TOP_RATED_MIN_COUNT = 5;
const NO_SHOW_ACTION_WINDOW_HOURS = 24;
const NO_SHOW_ACTION_WINDOW_MS = NO_SHOW_ACTION_WINDOW_HOURS * 60 * 60 * 1000;

const handleTrainerImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackTrainerImage;
};

const handleMemberAvatarError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackMemberAvatar;
};

const getMemberInitials = (name) => {
    const raw = String(name || '').trim();
    if (!raw) return 'GM';
    const parts = raw.split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
    return initials || 'GM';
};

const formatReviewDateLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const parseNoShowMarkedAt = (session) => {
    const lines = String(session?.notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (!line.startsWith('Marked NO_SHOW')) continue;
        const atMatch = line.match(/ at ([^|]+)/);
        const parsed = atMatch?.[1] ? new Date(atMatch[1].trim()) : null;
        if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
    }
    const fallbackUpdated = session?.updatedAt ? new Date(session.updatedAt) : null;
    if (fallbackUpdated && !Number.isNaN(fallbackUpdated.getTime())) return fallbackUpdated;
    return null;
};

const parseNoShowRequestMeta = (notes) => {
    const lines = String(notes || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    let hasRefundRequest = false;
    let refundStatus = 'NONE';
    let hasRescheduleRequest = false;
    let rescheduleStatus = 'NONE';

    lines.forEach((line) => {
        if (line.startsWith('REFUND_EXCEPTION_REQUESTED')) {
            hasRefundRequest = true;
            refundStatus = 'PENDING';
        }
        if (line.startsWith('REFUND_EXCEPTION_APPROVED')) {
            hasRefundRequest = true;
            refundStatus = 'APPROVED';
        }
        if (line.startsWith('REFUND_EXCEPTION_REJECTED')) {
            hasRefundRequest = true;
            refundStatus = 'REJECTED';
        }
        if (line.startsWith('TRAINER_CHANGE_REQUESTED')) {
            hasRescheduleRequest = true;
            rescheduleStatus = 'PENDING';
        }
        if (line.startsWith('TRAINER_CHANGE_RESOLVED')) {
            hasRescheduleRequest = true;
            rescheduleStatus = 'RESOLVED';
        }
    });

    return {
        hasRefundRequest,
        refundStatus,
        hasRescheduleRequest,
        rescheduleStatus,
        hasAnyRequest: hasRefundRequest || hasRescheduleRequest
    };
};

const getNoShowActionMeta = (session, now = new Date()) => {
    const status = String(session?.status || '').toUpperCase();
    if (status !== 'NO_SHOW') {
        return {
            eligible: false,
            isOpen: false,
            expiresAt: null,
            remainingMs: 0,
            ...parseNoShowRequestMeta(session?.notes)
        };
    }

    const noShowMarkedAt = parseNoShowMarkedAt(session);
    if (!noShowMarkedAt) {
        return {
            eligible: true,
            isOpen: false,
            expiresAt: null,
            remainingMs: 0,
            ...parseNoShowRequestMeta(session?.notes)
        };
    }

    const expiresAt = new Date(noShowMarkedAt.getTime() + NO_SHOW_ACTION_WINDOW_MS);
    const remainingMs = expiresAt.getTime() - now.getTime();

    return {
        eligible: true,
        isOpen: remainingMs > 0,
        expiresAt,
        remainingMs: Math.max(0, remainingMs),
        ...parseNoShowRequestMeta(session?.notes)
    };
};

const formatNoShowRemaining = (remainingMs) => {
    const totalMinutes = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m left`;
    return `${hours}h ${minutes}m left`;
};

export default function TrainerBooking() {
    const { user } = useAuth();
    const { formatPrice } = useCurrency();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const bookingPolicyNote = 'No refund by default for missed sessions. If trainer marks no-show, member may request refund/reschedule review within 24 hours. Paid session cancellations require staff/admin approval. One direct member reschedule is allowed with at least 24-hour notice.';
    const trainersInfoNote = 'Review trainer credentials, specialties, ratings, and open slots before confirming your booking.';
    const historyInfoNote = 'History shows completed, missed, and cancelled trainer sessions including your rating and payment records.';
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [showTrainerDetail, setShowTrainerDetail] = useState(false);
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
    const [noShowActionSubmittingId, setNoShowActionSubmittingId] = useState(null);
    const [paidCancelRequestSubmittingId, setPaidCancelRequestSubmittingId] = useState(null);
    const [activeTab, setActiveTab] = useState('trainers'); // trainers, bookings, history
    const [filterView, setFilterView] = useState('all'); // all, available, top-rated
    const [trainerSearch, setTrainerSearch] = useState('');
    const [showTrainerFilters, setShowTrainerFilters] = useState(false);
    const [bookingFilter, setBookingFilter] = useState('all'); // all, upcoming, ratings
    const [bookingSearch, setBookingSearch] = useState('');
    const [showBookingFilters, setShowBookingFilters] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [historySearch, setHistorySearch] = useState('');
    const [showHistoryFilters, setShowHistoryFilters] = useState(false);
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
    const [ratingComments, setRatingComments] = useState({});
    const [ratingSubmittingId, setRatingSubmittingId] = useState(null);
    const [ratingVoidingId, setRatingVoidingId] = useState(null);
    const [trainerReviewsById, setTrainerReviewsById] = useState({});

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
                
                const res = await axios.get(`/api/members/${user.id}/payment-methods`);
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
        const hasOpenModal = showBookingModal || showTrainerDetail || Boolean(rescheduleSession);
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
    }, [showBookingModal, showTrainerDetail, rescheduleSession]);

    const fetchTrainers = async () => {
        try {
            
            const res = await axios.get('/api/trainers');
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
            
            const res = await axios.get('/api/members/me/training-sessions');
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
            
            await axios.post(`/api/members/me/training-sessions/${sessionId}/cancel`, {});
            await showAlert({ title: 'Session Cancelled', message: 'Session cancelled successfully.', type: 'success' });
            fetchMemberSessions();
        } catch (error) {
            console.error("Failed to cancel session", error);
            await showAlert({ title: 'Cancel Failed', message: error.response?.data?.error || 'Failed to cancel session', type: 'danger' });
        }
    };

    const handleRequestNoShowAction = async (session, action) => {
        if (!session?.id) return;
        const isRefund = action === 'REFUND';
        const confirmed = await showConfirm({
            title: isRefund ? 'Request Refund Review?' : 'Request Reschedule Review?',
            message: isRefund
                ? 'This will submit your refund request to staff/admin for approval.'
                : 'This will submit your reschedule request to staff/admin for approval.',
            confirmLabel: isRefund ? 'Request Refund' : 'Request Reschedule',
            type: 'warning'
        });
        if (!confirmed) return;

        setNoShowActionSubmittingId(session.id);
        try {
            await axios.post(`/api/members/me/training-sessions/${session.id}/no-show-action`, {
                action
            });
            await showAlert({
                title: 'Request Submitted',
                message: isRefund
                    ? 'Refund request sent for staff/admin approval.'
                    : 'Reschedule request sent for staff/admin approval.',
                type: 'success'
            });
            fetchMemberSessions();
        } catch (error) {
            await showAlert({
                title: 'Request Failed',
                message: error.response?.data?.error || 'Failed to submit request',
                type: 'danger'
            });
        } finally {
            setNoShowActionSubmittingId(null);
        }
    };

    const handleRequestPaidCancellationReview = async (session) => {
        if (!session?.id) return;
        const confirmed = await showConfirm({
            title: 'Request Paid Cancellation Review?',
            message: 'This sends your paid cancellation/refund request to staff/admin for approval. Direct cancellation is disabled for paid sessions.',
            confirmLabel: 'Submit Request',
            type: 'warning'
        });
        if (!confirmed) return;

        setPaidCancelRequestSubmittingId(session.id);
        try {
            await axios.post(`/api/members/me/training-sessions/${session.id}/refund-exception`, {
                reason: 'MEMBER_CANCEL_PAID',
                details: 'Member requested cancellation review for paid upcoming session.'
            });
            await showAlert({
                title: 'Request Submitted',
                message: 'Paid cancellation/refund request sent for staff/admin approval.',
                type: 'success'
            });
            fetchMemberSessions();
        } catch (error) {
            await showAlert({
                title: 'Request Failed',
                message: error.response?.data?.error || 'Failed to submit cancellation review request',
                type: 'danger'
            });
        } finally {
            setPaidCancelRequestSubmittingId(null);
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
            
            await axios.post(`/api/members/me/training-sessions/${rescheduleSession.id}/reschedule`, {
                date: rescheduleForm.date,
                time: rescheduleForm.time,
                reason: rescheduleForm.reason
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
            
            const endpoint = '/api/members/book-training';
            
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
            const response = await axios.post(endpoint, payload);
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
            setSelectedTimesByDate();
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
        setShowTrainerDetail(false);
        setShowBookingModal(false);
        setSelectedTrainer(null);
        setBookingData({ duration: 60, notes: '', paymentMethod: 'CASH' });
        setSelectedDates([]);
        setSelectedTimesByDate();
        setSelectedMethodId('');
        setPaymentSelection('CASH');
        setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    }, []);

    const filteredTrainers = trainers.filter((trainer) => {
        const trainerRating = Number(trainer?.rating || 0);
        const trainerRatingCount = Number(trainer?.ratingCount || 0);
        if (filterView === 'available' && !(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0)) {
            return false;
        }
        if (filterView === 'top-rated' && !(trainerRating >= TOP_RATED_MIN_SCORE && trainerRatingCount >= TOP_RATED_MIN_COUNT)) {
            return false;
        }
        const query = trainerSearch.trim().toLowerCase();
        if (!query) return true;
        const searchableText = [
            trainer?.name,
            trainer?.specialization,
            trainer?.specialty,
            trainer?.bio,
            trainer?.specialties,
            trainer?.statusDescription
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(query);
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
    const ongoingSessions = memberSessions.filter((session) => isSessionOngoing(session, now));
    const upcomingSessions = memberSessions.filter((session) => isSessionUpcoming(session, now));
    const pastSessions = memberSessions.filter((session) => !isSessionOngoing(session, now) && !isSessionUpcoming(session, now));
    const noShowActionSessions = useMemo(() => {
        const current = new Date();
        return memberSessions
            .map((session) => {
                const meta = getNoShowActionMeta(session, current);
                return { session, meta };
            })
            .filter(({ meta }) => (
                meta.eligible
                && meta.isOpen
                && meta.refundStatus !== 'APPROVED'
                && meta.rescheduleStatus !== 'RESOLVED'
            ))
            .sort((a, b) => {
                const aExpiry = a.meta.expiresAt ? new Date(a.meta.expiresAt).getTime() : Number.POSITIVE_INFINITY;
                const bExpiry = b.meta.expiresAt ? new Date(b.meta.expiresAt).getTime() : Number.POSITIVE_INFINITY;
                return aExpiry - bExpiry;
            });
    }, [memberSessions]);
    const pendingRatingSessions = memberSessions.filter((session) =>
        String(session?.status || '').toUpperCase() === 'COMPLETED'
        && (session?.memberRating === null || session?.memberRating === undefined)
        && !session?.memberRatingVoided
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
        let historyEntries = trainerHistoryEntries;
        if (historyFilter === 'completed') historyEntries = trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'COMPLETED');
        if (historyFilter === 'missed') historyEntries = trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'MISSED');
        if (historyFilter === 'cancelled') historyEntries = trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'CANCELLED');

        const query = historySearch.trim().toLowerCase();
        if (!query) return historyEntries;

        return historyEntries.filter((entry) => {
            const searchableText = [
                entry?.trainer?.name,
                entry?.status,
                entry?.normalizedHistoryStatus,
                entry?.duration,
                entry?.price,
                entry?.memberRating,
                parseSessionExceptionFlags(entry).refundApproved ? 'refunded' : '',
                entry?.date ? entry.date.toISOString() : ''
            ]
                .filter((item) => item !== null && item !== undefined && item !== '')
                .join(' ')
                .toLowerCase();
            return searchableText.includes(query);
        });
    }, [trainerHistoryEntries, historyFilter, historySearch]);
    const trainerHistoryStatusCounts = useMemo(() => ({
        completed: trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'COMPLETED').length,
        missed: trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'MISSED').length,
        cancelled: trainerHistoryEntries.filter((entry) => entry.normalizedHistoryStatus === 'CANCELLED').length
    }), [trainerHistoryEntries]);
    const visibleUpcomingSessions = useMemo(
        () => filteredBookingEntries.filter((entry) => entry.bookingType === 'upcoming'),
        [filteredBookingEntries]
    );
    const visibleOngoingSessions = useMemo(() => {
        if (bookingFilter === 'ratings') return [];
        const query = bookingSearch.trim().toLowerCase();
        if (!query) return ongoingSessions;

        return ongoingSessions.filter((session) => {
            const searchableText = [
                session?.trainer?.name,
                session?.status,
                session?.notes,
                session?.date
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return searchableText.includes(query);
        });
    }, [bookingFilter, bookingSearch, ongoingSessions]);
    const visibleNoShowActionSessions = useMemo(() => {
        if (bookingFilter === 'ratings') return [];
        const query = bookingSearch.trim().toLowerCase();
        if (!query) return noShowActionSessions;

        return noShowActionSessions.filter(({ session }) => {
            const searchableText = [
                session?.trainer?.name,
                session?.status,
                session?.notes,
                session?.date
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return searchableText.includes(query);
        });
    }, [bookingFilter, bookingSearch, noShowActionSessions]);
    const visibleRatingSessions = useMemo(
        () => filteredBookingEntries.filter((entry) => entry.bookingType === 'rating'),
        [filteredBookingEntries]
    );
    const bookingActionCount = pendingRatingSessions.length + noShowActionSessions.filter(({ meta }) => !meta.hasAnyRequest).length;
    const hasPendingRatings = pendingRatingSessions.length > 0;
    const nextUpcomingSession = useMemo(() => {
        if (!Array.isArray(upcomingSessions) || upcomingSessions.length === 0) return null;
        const sorted = [...upcomingSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
        return sorted[0] || null;
    }, [upcomingSessions]);
    const nextOngoingSession = useMemo(() => {
        if (!Array.isArray(ongoingSessions) || ongoingSessions.length === 0) return null;
        const sorted = [...ongoingSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
        return sorted[0] || null;
    }, [ongoingSessions]);
    const selectedTrainerReviewState = selectedTrainer
        ? (trainerReviewsById[selectedTrainer.id] || null)
        : null;

    const fetchTrainerReviews = useCallback(async (trainerId, { force = false } = {}) => {
        const numericTrainerId = Number(trainerId);
        if (!Number.isInteger(numericTrainerId)) return;

        if (!force) {
            const current = trainerReviewsById[numericTrainerId];
            if (current && (current.loading || current.loaded)) return;
        }

        setTrainerReviewsById((prev) => ({
            ...prev,
            [numericTrainerId]: {
                ...(prev[numericTrainerId] || {}),
                loading: true,
                loaded: false,
                error: ''
            }
        }));

        try {
            const response = await axios.get(`/api/trainers/${numericTrainerId}/reviews`, {
                params: { limit: 12 }
            });
            setTrainerReviewsById((prev) => ({
                ...prev,
                [numericTrainerId]: {
                    loading: false,
                    loaded: true,
                    error: '',
                    summary: response?.data?.summary || { rating: 0, ratingCount: 0 },
                    reviews: Array.isArray(response?.data?.reviews) ? response.data.reviews : []
                }
            }));
        } catch (error) {
            setTrainerReviewsById((prev) => ({
                ...prev,
                [numericTrainerId]: {
                    ...(prev[numericTrainerId] || {}),
                    loading: false,
                    loaded: false,
                    error: error?.response?.data?.error || 'Failed to load trainer reviews',
                    summary: prev[numericTrainerId]?.summary || { rating: 0, ratingCount: 0 },
                    reviews: prev[numericTrainerId]?.reviews || []
                }
            }));
        }
    }, [trainerReviewsById]);

    const primeBookingForTrainer = useCallback((trainer) => {
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
    }, [paymentMethods]);

    const handleOpenTrainerDetail = useCallback((trainer) => {
        primeBookingForTrainer(trainer);
        setShowTrainerDetail(true);
        setShowBookingModal(false);
    }, [primeBookingForTrainer]);

    const handleOpenBookingModal = useCallback(() => {
        if (!selectedTrainer) return;
        setShowTrainerDetail(false);
        setShowBookingModal(true);
    }, [selectedTrainer]);

    useEffect(() => {
        if (!showTrainerDetail || !selectedTrainer?.id) return;
        fetchTrainerReviews(selectedTrainer.id);
    }, [showTrainerDetail, selectedTrainer?.id, fetchTrainerReviews]);

    const handleSubmitSessionRating = async (session) => {
        const rating = Number(ratingSelections[session.id] || 0);
        const comment = String(ratingComments[session.id] || '').trim();
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            await showAlert({ title: 'Rating Required', message: 'Please select a star rating (1 to 5).', type: 'warning' });
            return;
        }
        if (comment.length > RATING_COMMENT_LIMIT) {
            await showAlert({ title: 'Comment Too Long', message: `Please keep your comment within ${RATING_COMMENT_LIMIT} characters.`, type: 'warning' });
            return;
        }

        setRatingSubmittingId(session.id);
        try {
            await axios.post(`/api/members/me/training-sessions/${session.id}/rate`, {
                rating,
                comment
            });
            setRatingSelections((prev) => {
                const next = { ...prev };
                delete next[session.id];
                return next;
            });
            setRatingComments((prev) => {
                const next = { ...prev };
                delete next[session.id];
                return next;
            });
            await Promise.all([fetchMemberSessions(), fetchTrainers()]);
            if (selectedTrainer?.id && Number(selectedTrainer.id) === Number(session?.trainer?.id || session?.trainerId)) {
                await fetchTrainerReviews(selectedTrainer.id, { force: true });
            }
            await showAlert({ title: 'Thanks for the rating', message: 'Your trainer rating has been recorded.', type: 'success' });
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to submit trainer rating.';
            await showAlert({ title: 'Rating Failed', message, type: 'danger' });
        } finally {
            setRatingSubmittingId(null);
        }
    };

    const handleVoidSessionRating = async (session) => {
        const confirmed = await showConfirm({
            title: 'Skip This Rating?',
            message: 'This session will be marked as skipped and will not affect trainer ratings or reviews.',
            confirmLabel: 'Skip Rating',
            type: 'warning'
        });
        if (!confirmed) return;

        setRatingVoidingId(session.id);
        try {
            await axios.post(`/api/members/me/training-sessions/${session.id}/rate/void`, {});
            setRatingSelections((prev) => {
                const next = { ...prev };
                delete next[session.id];
                return next;
            });
            setRatingComments((prev) => {
                const next = { ...prev };
                delete next[session.id];
                return next;
            });
            await Promise.all([fetchMemberSessions(), fetchTrainers()]);
            if (selectedTrainer?.id && Number(selectedTrainer.id) === Number(session?.trainer?.id || session?.trainerId)) {
                await fetchTrainerReviews(selectedTrainer.id, { force: true });
            }
            await showAlert({ title: 'Rating Skipped', message: 'You can continue booking without rating this session.', type: 'success' });
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to skip rating.';
            await showAlert({ title: 'Skip Failed', message, type: 'danger' });
        } finally {
            setRatingVoidingId(null);
        }
    };

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

    const showTabInfo = async () => {
        if (activeTab === 'trainers') {
            await showAlert({
                title: 'Trainer Booking Info',
                message: trainersInfoNote,
                type: 'info'
            });
            return;
        }
        if (activeTab === 'history') {
            await showAlert({
                title: 'Session History Info',
                message: historyInfoNote,
                type: 'info'
            });
            return;
        }
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
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
            <MemberPageHeader
                title={activeTab === 'bookings' ? 'My Bookings' : activeTab === 'history' ? 'Session History' : 'Personal Trainers'}
                subtitle={
                    activeTab === 'bookings'
                        ? 'Manage upcoming sessions, no-show requests, and pending ratings'
                        : activeTab === 'history'
                            ? 'Review completed, missed, and cancelled past trainer sessions'
                            : 'Find your trainer and book sessions quickly'
                }
                icon="sports_gymnastics"
                className="border-white/10"
                rightSlot={(
                    <button
                        type="button"
                        onClick={showTabInfo}
                        className="shrink-0 h-9 w-9 rounded-lg border border-white/10 bg-surface text-text-secondary hover:text-white hover:bg-white/5 mt-0.5"
                        aria-label="View tab info"
                        title="Tab info"
                    >
                        <span className="material-icons-round text-base">info</span>
                    </button>
                )}
            />

            <section className="space-y-3">
                <div className="grid grid-cols-3 gap-2 rounded-2xl p-1 bg-surface/80 border border-white/10 shadow-inner">
                    <button
                        type="button"
                        onClick={() => setActiveTab('trainers')}
                        className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'trainers'
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
                        className={`relative py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'bookings'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">event_note</span>
                        <span>My Bookings</span>
                        {ongoingSessions.length > 0 && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${activeTab === 'bookings' ? 'bg-emerald-700/80 text-emerald-100' : 'bg-emerald-500/30 text-emerald-200'}`}>
                                LIVE
                            </span>
                        )}
                        {bookingActionCount > 0 && (
                            <span className={`absolute right-1 top-1 min-w-[16px] h-4 px-1 rounded-md text-[9px] font-bold leading-none inline-flex items-center justify-center ${activeTab === 'bookings' ? 'bg-amber-400 text-black' : 'bg-amber-500/90 text-black'}`}>
                                {bookingActionCount > 9 ? '9+' : bookingActionCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`relative py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeTab === 'history'
                            ? 'bg-primary text-background shadow-md'
                            : 'text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-icons-round text-base">history</span>
                        <span>History</span>
                    </button>
                </div>

                {/* Trainer Search + Filters */}
                {activeTab === 'trainers' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <label className="relative flex-1">
                                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-sm text-text-muted">search</span>
                                <input
                                    type="text"
                                    value={trainerSearch}
                                    onChange={(event) => setTrainerSearch(event.target.value)}
                                    placeholder="Search trainers, specialty, skills..."
                                    className="h-8 w-full rounded-lg border border-white/10 bg-surface pl-8 pr-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowTrainerFilters((prev) => !prev)}
                                className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${showTrainerFilters || filterView !== 'all'
                                    ? 'bg-white text-black border-white'
                                    : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                    }`}
                            >
                                <span className="material-icons-round text-sm">tune</span>
                                Filter
                            </button>
                        </div>
                        <p className="text-[11px] text-text-muted">
                            {filterView === 'all'
                                ? 'Showing all trainers.'
                                : filterView === 'available'
                                    ? 'Filter: Available trainers'
                                    : `Filter: Top rated (${TOP_RATED_MIN_SCORE}+ with ${TOP_RATED_MIN_COUNT}+ ratings)`}
                        </p>
                        {showTrainerFilters && (
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
                        )}
                        {hasPendingRatings && (
                            <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-xs text-text-muted flex items-start gap-2">
                                <span className="material-icons-round text-base text-primary">priority_high</span>
                                <span>You still have unrated completed sessions. You can continue booking, but please rate or skip those sessions in <strong>My Bookings</strong>.</span>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {activeTab === 'bookings' ? (
                /* My Booked Sessions */
                <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-3.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/90 font-bold">Ongoing</p>
                            <p className="text-2xl font-black text-white mt-1">{ongoingSessions.length}</p>
                            <p className="text-[11px] text-cyan-100/75 mt-1">Live sessions now</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-3.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/90 font-bold">Upcoming</p>
                            <p className="text-2xl font-black text-white mt-1">{upcomingSessions.length}</p>
                            <p className="text-[11px] text-emerald-100/75 mt-1">Booked sessions</p>
                        </div>
                        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-3.5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-300/90 font-bold">Pending Rating</p>
                            <p className="text-2xl font-black text-white mt-1">{pendingRatingSessions.length}</p>
                            <p className="text-[11px] text-amber-100/75 mt-1">Complete to unlock booking</p>
                        </div>
                    </div>

                    {nextOngoingSession && (
                        <div className="rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200 font-bold">Ongoing Now</p>
                                    <p className="text-base font-bold text-white mt-1 truncate">{nextOngoingSession?.trainer?.name || 'Trainer'}</p>
                                    <p className="text-[11px] text-text-muted mt-0.5">
                                        Started at {new Date(nextOngoingSession.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
                                    Live
                                </span>
                            </div>
                        </div>
                    )}

                    {nextUpcomingSession && (
                        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary/90 font-bold">Next Session</p>
                                    <p className="text-base font-bold text-white mt-1 truncate">{nextUpcomingSession?.trainer?.name || 'Trainer'}</p>
                                    <p className="text-[11px] text-text-muted mt-0.5">
                                        {new Date(nextUpcomingSession.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        {' at '}
                                        {new Date(nextUpcomingSession.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${toSessionStatusClass(nextUpcomingSession.status)}`}>
                                    {nextUpcomingSession.status || 'SCHEDULED'}
                                </span>
                            </div>
                        </div>
                    )}

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
                            ? 'Showing ongoing/upcoming bookings and sessions pending rating.'
                            : bookingFilter === 'upcoming'
                                ? 'Filter: Active sessions (ongoing/upcoming)'
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
                                <>
                                    <section className="space-y-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 sm:p-4">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
                                            ONGOING NOW
                                        </h3>
                                        {visibleOngoingSessions.length === 0 ? (
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-text-muted">
                                                No ongoing sessions right now.
                                            </div>
                                        ) : visibleOngoingSessions.map((session) => {
                                            const sessionDate = new Date(session.date);
                                            const durationMinutes = Math.max(0, Number(session?.duration || 0));
                                            const sessionEnd = new Date(sessionDate.getTime() + durationMinutes * 60 * 1000);
                                            const trainerId = Number(session?.trainer?.id || session?.trainerId);
                                            const trainerImage = trainerCardImageById.get(trainerId) || session?.trainer?.cardImageUrl || null;
                                            return (
                                                <div key={`ongoing-${session.id}`} className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4">
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
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-wide text-cyan-200/80">In Progress</p>
                                                                    <p className="text-sm font-bold text-white">
                                                                        {sessionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </p>
                                                                    <p className="text-[11px] text-text-muted">
                                                                        {sessionDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                                        {' - '}
                                                                        {sessionEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-200">
                                                                    Live
                                                                </span>
                                                            </div>
                                                            <h3 className="mt-2 text-base font-bold text-white leading-tight break-words">{session.trainer?.name || 'Trainer'}</h3>
                                                            <p className="mt-1 text-[11px] text-text-muted">Session is currently in progress.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </section>

                                    <section className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 sm:p-4">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            MISSED BOOKINGS
                                        </h3>
                                        {visibleNoShowActionSessions.length === 0 ? (
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-text-muted">
                                                No no-show sessions requiring action right now.
                                            </div>
                                        ) : visibleNoShowActionSessions.map(({ session, meta }) => {
                                            const sessionDate = new Date(session.date);
                                            const trainerId = Number(session?.trainer?.id || session?.trainerId);
                                            const trainerImage = trainerCardImageById.get(trainerId) || session?.trainer?.cardImageUrl || null;
                                            const busy = noShowActionSubmittingId === session.id;
                                            return (
                                                <div key={`no-show-${session.id}`} className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 space-y-3">
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
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-wide text-text-muted">Missed Session</p>
                                                                    <p className="text-sm font-bold text-white">
                                                                        {sessionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </p>
                                                                    <p className="text-[11px] text-text-muted">
                                                                        {sessionDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                                                                    No Show
                                                                </span>
                                                            </div>
                                                            <h3 className="mt-2 text-base font-bold text-white leading-tight break-words">{session.trainer?.name || 'Trainer'}</h3>
                                                            <p className="mt-1 text-[11px] text-amber-200 font-semibold">
                                                                {meta.isOpen && meta.remainingMs > 0
                                                                    ? `${formatNoShowRemaining(meta.remainingMs)} to submit request`
                                                                    : 'Request window closed'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {meta.hasAnyRequest ? (
                                                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-text-muted">
                                                            {meta.refundStatus === 'PENDING' && 'Refund request pending staff/admin approval.'}
                                                            {meta.refundStatus === 'APPROVED' && 'Refund request approved by staff/admin.'}
                                                            {meta.refundStatus === 'REJECTED' && 'Refund request rejected by staff/admin.'}
                                                            {meta.rescheduleStatus === 'PENDING' && 'Reschedule request pending staff/admin approval.'}
                                                            {meta.rescheduleStatus === 'RESOLVED' && 'Reschedule request resolved by staff/admin.'}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                disabled={busy}
                                                                onClick={() => handleRequestNoShowAction(session, 'RESCHEDULE')}
                                                                className="flex-1 py-2.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 active:scale-95 transition-all text-sm border border-primary/25 disabled:opacity-60"
                                                            >
                                                                {busy ? 'Submitting...' : 'Request Reschedule'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={busy}
                                                                onClick={() => handleRequestNoShowAction(session, 'REFUND')}
                                                                className="flex-1 py-2.5 rounded-lg bg-red-500/10 text-red-300 font-bold hover:bg-red-500/20 active:scale-95 transition-all text-sm border border-red-500/25 disabled:opacity-60"
                                                            >
                                                                {busy ? 'Submitting...' : 'Request Refund'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </section>

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
                                        const isPaidSession = String(session?.paymentStatus || '').toUpperCase() === 'PAID';
                                        const refundRequestMeta = parseNoShowRequestMeta(session?.notes);
                                        const hasPendingPaidCancelRequest = refundRequestMeta.hasRefundRequest && refundRequestMeta.refundStatus === 'PENDING';
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
                                                        {!isPaidSession && session.status !== 'CANCELLED' && session.status !== 'NO_SHOW' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCancelSession(session.id); }}
                                                                className={`${canRequestReschedule ? 'flex-1' : 'w-full'} py-2.5 rounded-lg bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 active:scale-95 transition-all text-sm border border-red-500/20 flex items-center justify-center gap-1`}
                                                            >
                                                                <span className="material-icons-round text-base">cancel</span>
                                                                Cancel Booking
                                                            </button>
                                                        )}
                                                        {isPaidSession && session.status !== 'CANCELLED' && session.status !== 'NO_SHOW' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRequestPaidCancellationReview(session); }}
                                                                disabled={paidCancelRequestSubmittingId === session.id || hasPendingPaidCancelRequest}
                                                                className={`${canRequestReschedule ? 'flex-1' : 'w-full'} py-2.5 rounded-lg bg-amber-500/10 text-amber-300 font-bold hover:bg-amber-500/20 active:scale-95 transition-all text-sm border border-amber-500/25 flex items-center justify-center gap-1 disabled:opacity-60`}
                                                            >
                                                                <span className="material-icons-round text-base">assignment</span>
                                                                {hasPendingPaidCancelRequest
                                                                    ? 'Review Requested'
                                                                    : (paidCancelRequestSubmittingId === session.id ? 'Submitting...' : 'Request Cancel Review')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </section>
                                </>
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
                                    const commentValue = String(ratingComments[session.id] || '');
                                    const ratingBusy = ratingSubmittingId === session.id || ratingVoidingId === session.id;
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
                                                        disabled={ratingBusy}
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
                                            <div className="mt-3">
                                                <label className="block text-[11px] font-semibold text-text-muted mb-1.5">Comment (optional)</label>
                                                <textarea
                                                    rows={2}
                                                    value={commentValue}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        if (value.length > RATING_COMMENT_LIMIT) return;
                                                        setRatingComments((prev) => ({ ...prev, [session.id]: value }));
                                                    }}
                                                    placeholder="Share your experience with this trainer"
                                                    disabled={ratingBusy}
                                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-xs text-white placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
                                                />
                                                <p className="mt-1 text-[10px] text-text-muted text-right">{commentValue.length}/{RATING_COMMENT_LIMIT}</p>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
                                                <span className="text-[11px] text-text-muted">Rate or skip to keep your trainer feedback updated.</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={ratingBusy}
                                                        onClick={() => handleVoidSessionRating(session)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-text-secondary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {ratingVoidingId === session.id ? 'Skipping...' : 'Skip'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={ratingBusy || selectedRating < 1}
                                                        onClick={() => handleSubmitSessionRating(session)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-background hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {ratingSubmittingId === session.id ? 'Saving...' : 'Submit Rating'}
                                                    </button>
                                                </div>
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

                    <div className="space-y-2 rounded-xl border border-white/10 bg-surface p-3">
                        <div className="flex items-center gap-2">
                            <label className="relative flex-1">
                                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-sm text-text-muted">search</span>
                                <input
                                    type="text"
                                    value={historySearch}
                                    onChange={(event) => setHistorySearch(event.target.value)}
                                    placeholder="Search trainer, status, date..."
                                    className="h-8 w-full rounded-lg border border-white/10 bg-background/40 pl-8 pr-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowHistoryFilters((prev) => !prev)}
                                className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${showHistoryFilters || historyFilter !== 'all'
                                    ? 'bg-white text-black border-white'
                                    : 'bg-surface border-white/10 text-text-muted hover:text-white'
                                    }`}
                            >
                                <span className="material-icons-round text-sm">tune</span>
                                Filters
                            </button>
                        </div>
                        <p className="text-[11px] text-text-muted">
                            {historyFilter === 'all'
                                ? 'Showing all history statuses.'
                                : `Filter: ${historyFilter === 'completed'
                                    ? 'Done'
                                    : historyFilter === 'missed'
                                        ? 'Missed'
                                        : 'Cancelled'}`}
                        </p>
                        {showHistoryFilters && (
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
                                        onClick={() => {
                                            setHistoryFilter(item.value);
                                            setShowHistoryFilters(false);
                                        }}
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

                    <div className="bg-surface border border-white/10 rounded-2xl p-4 space-y-4">
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
                                {filteredTrainerHistoryEntries.map((entry) => {
                                    const trainerId = Number(entry?.trainer?.id || entry?.trainerId);
                                    const matchedTrainer = trainers.find((trainer) => Number(trainer.id) === trainerId) || null;
                                    const exceptionFlags = parseSessionExceptionFlags(entry);
                                    return (
                                        <article key={`trainer-history-${entry.id}`} className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{entry?.trainer?.name || 'Trainer Session'}</p>
                                                    <p className="text-[11px] text-text-muted mt-0.5">
                                                        {entry.date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        {' at '}
                                                        {entry.date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${toTrainerHistoryStatusClass(entry.normalizedHistoryStatus)}`}>
                                                        {toTrainerHistoryStatusLabel(entry.normalizedHistoryStatus)}
                                                    </span>
                                                    {exceptionFlags.refundApproved && (
                                                        <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
                                                            Refunded
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">schedule</span>
                                                    {entry.duration} min
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">payments</span>
                                                    {formatPrice(entry.price)}
                                                </span>
                                                <span className="inline-flex items-center gap-1 col-span-2">
                                                    <span className="material-icons-round text-sm">event</span>
                                                    {String(entry.status || '').replace(/_/g, ' ') || 'N/A'}
                                                </span>
                                                {String(entry.status || '').toUpperCase() === 'COMPLETED' && Boolean(entry.memberRatingVoided) && (
                                                    <span className="inline-flex items-center gap-1 col-span-2">
                                                        <span className="material-icons-round text-sm">remove_circle</span>
                                                        Rating skipped
                                                    </span>
                                                )}
                                                {String(entry.status || '').toUpperCase() === 'COMPLETED' && (
                                                    <span className="inline-flex items-center gap-1 col-span-2">
                                                        <span className="material-icons-round text-sm">star</span>
                                                        {entry.memberRating ? `Rated ${entry.memberRating}/5` : (entry.memberRatingVoided ? 'Not Rated (Skipped)' : 'Not Rated')}
                                                    </span>
                                                )}
                                                {exceptionFlags.refundApproved && (
                                                    <span className="inline-flex items-center gap-1 col-span-2 text-cyan-300">
                                                        <span className="material-icons-round text-sm">payments</span>
                                                        Refunded by staff/admin approval
                                                    </span>
                                                )}
                                            </div>
                                            {matchedTrainer && (
                                                <div className="mt-3 pt-3 border-t border-white/10">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenTrainerDetail(matchedTrainer)}
                                                        className="w-full py-2 rounded-lg bg-primary/10 text-primary border border-primary/25 font-semibold text-xs hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <span className="material-icons-round text-sm">replay</span>
                                                        Book Again
                                                    </button>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                        {filteredTrainers.map((trainer) => {
                            const specialties = getTrainerSpecialties(trainer);
                            const availableDays = trainer.availabilityByDay ? Object.keys(trainer.availabilityByDay).length : 0;
                            const todayIso = toIsoDate(new Date());
                            const todayWindow = getTrainerDateWindow(trainer, todayIso);
                            const bookingStatusLabel = String(trainer.bookingStatus || 'OPEN').toUpperCase();
                            const sessionDurations = getTrainerDurations(trainer);
                            const isTrainerOpen = bookingStatusLabel === 'OPEN' || isTrainerTemporarilyOpenForDate(trainer, todayIso);

                            return (
                                <article key={trainer.id} className="bg-surface/95 rounded-2xl border border-white/10 overflow-hidden hover:border-primary/30 transition-all group flex flex-col shadow-lg shadow-black/15">
                                    <div className="aspect-[16/9] bg-white/5 overflow-hidden relative">
                                        {trainer.cardImageUrl ? (
                                            <img
                                                src={trainer.cardImageUrl}
                                                alt={trainer.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                                onError={handleTrainerImageError}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                                <span className="material-icons-round text-6xl text-primary/30">person</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                                            <div className="flex items-center justify-between">
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${isTrainerOpen
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                                                    }`}>
                                                    {isTrainerOpen ? 'Open for booking' : 'Closed'}
                                                </span>
                                                <span className="rounded-full bg-black/70 backdrop-blur-md px-2 py-1 flex items-center gap-1">
                                                    <span className="material-icons-round text-xs text-yellow-400">star</span>
                                                    <span className="text-white font-bold text-xs">{Number(trainer.rating || 0).toFixed(1)}</span>
                                                    <span className="text-[10px] text-white/70">({Number(trainer.ratingCount || 0)})</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 flex flex-col flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-white text-base leading-tight truncate">{trainer.name}</h3>
                                                <p className="text-text-muted text-xs mt-1 truncate">{trainer.specialization || 'Personal Trainer'}</p>
                                            </div>
                                            {trainer.experience && (
                                                <span className="shrink-0 text-[10px] font-semibold text-text-secondary rounded-md border border-white/15 bg-white/5 px-2 py-1">
                                                    {trainer.experience}y exp
                                                </span>
                                            )}
                                        </div>

                                        {specialties.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {specialties.slice(0, 3).map((specialty, idx) => (
                                                    <span key={idx} className="bg-white/10 text-text-secondary px-2 py-0.5 rounded-md text-[10px] font-medium">
                                                        {specialty}
                                                    </span>
                                                ))}
                                                {specialties.length > 3 && (
                                                    <span className="text-text-muted text-[10px] py-0.5 px-1">+{specialties.length - 3} more</span>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-text-muted">Session Price</span>
                                                <span className="text-primary font-extrabold">{formatPrice(trainer.sessionPrice ?? 300)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-text-muted">Durations</span>
                                                <span className="text-white font-medium">{sessionDurations.join(', ')} min</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-text-muted">Availability</span>
                                                <span className={`${availableDays > 0 ? 'text-emerald-300' : 'text-amber-300'} font-medium`}>
                                                    {availableDays > 0 ? `${availableDays} day(s)` : 'Not set'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-text-muted">Today</span>
                                                <span className="text-white/90 font-medium">
                                                    {todayWindow ? `${formatTimeLabel(todayWindow.start)} - ${formatTimeLabel(todayWindow.end)}` : 'Unavailable'}
                                                </span>
                                            </div>
                                        </div>

                                        {trainer.statusDescription && (
                                            <p className="mt-2.5 text-[11px] text-white/70 line-clamp-2">{trainer.statusDescription}</p>
                                        )}

                                        <div className="mt-auto pt-3">
                                            <button
                                                onClick={() => handleOpenTrainerDetail(trainer)}
                                                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 touch-manipulation bg-primary text-background hover:brightness-110 shadow-lg shadow-primary/25"
                                            >
                                                <span className="material-icons-round text-base">fitness_center</span>
                                                View Details & Book
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )
            )}

            {showTrainerDetail && selectedTrainer && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center"
                    onClick={closeModal}
                    style={{
                        paddingBottom: 'env(safe-area-inset-bottom)',
                        paddingTop: 'env(safe-area-inset-top)'
                    }}
                >
                    <div
                        className="w-full sm:max-w-2xl bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 flex flex-col max-h-[90vh] overflow-hidden animate-slide-up sm:animate-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between p-5 border-b border-white/10">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-primary/90 font-bold">Trainer Profile</p>
                                <h2 className="text-xl font-bold text-white mt-1">Review Before Booking</h2>
                            </div>
                            <button
                                onClick={closeModal}
                                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                aria-label="Close trainer details"
                            >
                                <span className="material-icons-round text-white text-2xl">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex gap-4">
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                                        {selectedTrainer.cardImageUrl ? (
                                            <img src={selectedTrainer.cardImageUrl} alt={selectedTrainer.name} className="w-full h-full object-cover" onError={handleTrainerImageError} />
                                        ) : (
                                            <span className="material-icons-round text-text-muted text-3xl">person</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-bold text-white truncate">{selectedTrainer.name}</h3>
                                        <p className="text-xs text-text-muted mt-0.5 truncate">{selectedTrainer.specialization || 'Personal Trainer'}</p>
                                        {selectedTrainer.statusDescription && (
                                            <p className="text-xs text-white/70 mt-2 leading-relaxed">
                                                {selectedTrainer.statusDescription}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                        <p className="text-[10px] uppercase tracking-wide text-text-muted">Rating</p>
                                        <p className="mt-1 text-sm font-bold text-white inline-flex items-center gap-1">
                                            {Number(selectedTrainer.rating || 0).toFixed(1)}
                                            <span className="material-icons-round text-sm text-yellow-400">star</span>
                                        </p>
                                        <p className="mt-1 text-[11px] text-text-muted">
                                            {Number(selectedTrainerReviewState?.summary?.ratingCount ?? selectedTrainer.ratingCount ?? 0)} member ratings
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                        <p className="text-[10px] uppercase tracking-wide text-text-muted">Experience</p>
                                        <p className="mt-1 text-sm font-bold text-white">
                                            {selectedTrainer.experience ? `${selectedTrainer.experience} years` : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5">
                                        <p className="text-[10px] uppercase tracking-wide text-primary/80">Rate</p>
                                        <p className="mt-1 text-sm font-bold text-white">{formatPrice(selectedTrainer.sessionPrice ?? 300)}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                        <p className="text-[10px] uppercase tracking-wide text-text-muted">Durations</p>
                                        <p className="mt-1 text-sm font-bold text-white">
                                            {getTrainerDurations(selectedTrainer).join(', ')} min
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2">Specialties</p>
                                    {getTrainerSpecialties(selectedTrainer).length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {getTrainerSpecialties(selectedTrainer).map((specialty, idx) => (
                                                <span key={`${specialty}-${idx}`} className="bg-white/10 text-text-secondary px-2 py-1 rounded-md text-[11px] font-medium">
                                                    {specialty}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-text-muted">No specialties listed yet.</p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Quick Availability</p>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${String(selectedTrainer.bookingStatus || 'OPEN').toUpperCase() === 'CLOSED' && !selectedTrainer.temporarilyOpenToday
                                        ? 'text-red-300'
                                        : 'text-emerald-300'
                                        }`}>
                                        {String(selectedTrainer.bookingStatus || 'OPEN').toUpperCase() === 'CLOSED' && !selectedTrainer.temporarilyOpenToday ? 'Closed' : 'Open'}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {(() => {
                                        const rows = [];
                                        const today = new Date();
                                        for (let offset = 0; offset < 10 && rows.length < 4; offset += 1) {
                                            const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
                                            const iso = toIsoDate(date);
                                            if (!isTrainerDateAvailable(selectedTrainer, iso)) continue;
                                            const slots = getAvailableTimeSlots(iso).slice(0, 3);
                                            rows.push({ date, slots });
                                        }
                                        if (rows.length === 0) {
                                            return (
                                                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-text-muted">
                                                    No open dates found in the next 10 days.
                                                </div>
                                            );
                                        }
                                        return rows.map((row) => (
                                            <div key={row.date.toISOString()} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold text-white">
                                                        {row.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className="text-[11px] text-text-muted">
                                                        {row.slots.length > 0 ? `${row.slots.length}+ open slot(s)` : 'No open slot'}
                                                    </span>
                                                </div>
                                                {row.slots.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {row.slots.map((slot) => (
                                                            <span key={`${row.date.toISOString()}-${slot}`} className="rounded-md bg-primary/10 border border-primary/25 px-2 py-1 text-[10px] font-semibold text-primary">
                                                                {formatTimeLabel(slot)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Member Reviews</p>
                                        <p className="text-xs text-text-muted mt-0.5">Latest verified feedback from completed sessions</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fetchTrainerReviews(selectedTrainer.id, { force: true })}
                                        className="h-8 px-3 rounded-lg border border-white/15 bg-black/20 text-[11px] font-semibold text-primary hover:bg-black/30"
                                        disabled={Boolean(selectedTrainerReviewState?.loading)}
                                    >
                                        {selectedTrainerReviewState?.loading ? 'Refreshing...' : 'Refresh'}
                                    </button>
                                </div>

                                <div className="mb-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5">
                                        <p className="text-[10px] uppercase tracking-wide text-primary/80">Average Rating</p>
                                        <div className="mt-1 flex items-center gap-1.5">
                                            <span className="text-lg font-extrabold text-white">
                                                {Number(selectedTrainerReviewState?.summary?.rating ?? selectedTrainer.rating ?? 0).toFixed(1)}
                                            </span>
                                            <span className="material-icons-round text-base text-yellow-400">star</span>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                                        <p className="text-[10px] uppercase tracking-wide text-text-muted">Total Reviews</p>
                                        <p className="mt-1 text-lg font-bold text-white">
                                            {Number(selectedTrainerReviewState?.summary?.ratingCount || 0)}
                                        </p>
                                    </div>
                                </div>

                                {selectedTrainerReviewState?.loading ? (
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-text-muted">
                                        Loading member feedback...
                                    </div>
                                ) : selectedTrainerReviewState?.error ? (
                                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-300">
                                        {selectedTrainerReviewState.error}
                                    </div>
                                ) : Array.isArray(selectedTrainerReviewState?.reviews) && selectedTrainerReviewState.reviews.length > 0 ? (
                                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                        {selectedTrainerReviewState.reviews.map((review) => {
                                            const normalizedRating = Number(review.rating || 0);
                                            const initials = getMemberInitials(review.memberName);
                                            return (
                                                <article key={`trainer-review-${review.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3.5">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-11 h-11 rounded-full overflow-hidden border border-white/15 bg-slate-700/50 shrink-0 flex items-center justify-center">
                                                            {review.memberImageUrl ? (
                                                                <img
                                                                    src={review.memberImageUrl}
                                                                    alt={review.memberName || 'Gym Member'}
                                                                    className="w-full h-full object-cover"
                                                                    onError={handleMemberAvatarError}
                                                                />
                                                            ) : (
                                                                <span className="text-[11px] font-bold tracking-wide text-white">{initials}</span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-white truncate">{review.memberName || 'Gym Member'}</p>
                                                                    <p className="text-[11px] text-text-muted">{formatReviewDateLabel(review.date)}</p>
                                                                </div>
                                                                <div className="shrink-0">
                                                                    <div className="flex items-center gap-0.5">
                                                                        {[1, 2, 3, 4, 5].map((score) => (
                                                                            <span
                                                                                key={`review-${review.id}-star-${score}`}
                                                                                className={`material-icons-round text-sm ${score <= normalizedRating ? 'text-yellow-400' : 'text-white/25'}`}
                                                                            >
                                                                                star
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    <p className="mt-0.5 text-[10px] text-right text-text-muted">{normalizedRating}/5</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5">
                                                                <p className="text-xs text-text-secondary leading-relaxed">
                                                                    {review.comment ? review.comment : 'Member left a star-only rating without a written comment.'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-text-muted">
                                        No published reviews yet for this trainer.
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="border-t border-white/10 p-5 bg-surface space-y-2">
                            <button
                                type="button"
                                onClick={handleOpenBookingModal}
                                className="w-full py-3.5 rounded-xl font-bold bg-primary text-background hover:brightness-110 transition-all"
                            >
                                Continue Booking
                            </button>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="w-full py-3 rounded-xl font-medium bg-white/5 text-white hover:bg-white/10 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
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
                                            <p className="text-xs font-semibold text-white truncate">{Object.keys(selectedTimesByDate || {}).length}/{selectedDates.length}</p>
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
                                                <span className="text-white font-medium">{Object.keys(selectedTimesByDate || {}).length}/{selectedDates.length}</span>
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
