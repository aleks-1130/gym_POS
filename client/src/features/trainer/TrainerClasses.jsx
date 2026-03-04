import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';

const parseTimeToMinutes = (timeValue) => {
    const raw = String(timeValue || '').trim().toUpperCase();
    if (!raw) return null;

    const hhmm24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (hhmm24) return (Number(hhmm24[1]) * 60) + Number(hhmm24[2]);

    const hhmm12 = raw.match(/^(0?\d|1[0-2]):([0-5]\d)\s*(AM|PM)$/);
    if (!hhmm12) return null;

    let hours = Number(hhmm12[1]) % 12;
    const minutes = Number(hhmm12[2]);
    if (hhmm12[3] === 'PM') hours += 12;
    return (hours * 60) + minutes;
};

const minutesTo12Hour = (minutes) => {
    const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = ((hour24 + 11) % 12) + 1;
    return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const getClassTimeRange = (time, duration) => {
    const startMinutes = parseTimeToMinutes(time);
    const durationMinutes = Number(duration);
    if (startMinutes === null || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return {
            start: String(time || 'TBA'),
            end: '',
            label: `${String(time || 'TBA')}${durationMinutes > 0 ? ` - ${durationMinutes} min` : ''}`
        };
    }

    const endMinutes = startMinutes + durationMinutes;
    return {
        start: minutesTo12Hour(startMinutes),
        end: minutesTo12Hour(endMinutes),
        label: `${minutesTo12Hour(startMinutes)} - ${minutesTo12Hour(endMinutes)}`
    };
};

const formatDateLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

const getCompletionGuard = (cls, now = new Date()) => {
    const timeRange = getClassTimeRange(cls.time, cls.duration);
    const durationMinutes = Number(cls.duration);
    const sessionStart = cls.sessionDate ? new Date(cls.sessionDate) : null;

    if (!sessionStart || Number.isNaN(sessionStart.getTime())) {
        return {
            canComplete: false,
            reason: 'No active session date found for this class.',
            timeRange
        };
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return {
            canComplete: false,
            reason: 'Invalid class schedule. Ask admin to set valid start and end time.',
            timeRange
        };
    }

    const nowDate = new Date(now);
    const todayStart = new Date(nowDate);
    todayStart.setHours(0, 0, 0, 0);
    const sessionStartDay = new Date(sessionStart);
    sessionStartDay.setHours(0, 0, 0, 0);
    if (todayStart.getTime() !== sessionStartDay.getTime()) {
        return {
            canComplete: false,
            reason: `This class can only be completed on ${formatDateLabel(sessionStart)}.`,
            timeRange
        };
    }

    const sessionEnd = new Date(sessionStart.getTime() + (durationMinutes * 60000));
    if (nowDate < sessionStart || nowDate > sessionEnd) {
        return {
            canComplete: false,
            reason: `Completion allowed only during ${timeRange.label}.`,
            timeRange
        };
    }

    return {
        canComplete: true,
        reason: '',
        timeRange
    };
};

export default function TrainerClasses() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [now, setNow] = useState(() => new Date());
    const { alert: showAlert, confirm: showConfirm } = useConfirm();

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await axios.get('/api/trainer/me/classes');
                setClasses(res.data || []);
            } catch (e) {
                console.error('Failed to fetch trainer classes', e);
            } finally {
                setLoading(false);
            }
        };

        fetchClasses();
    }, []);

    useEffect(() => {
        const intervalId = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(intervalId);
    }, []);

    const refreshClasses = async () => {
        const res = await axios.get('/api/trainer/me/classes');
        setClasses(res.data || []);
    };

    const updateAttendance = async (clsId, bookingId, status) => {
        setUpdatingId(bookingId);
        try {
            await axios.patch(`/api/trainer/me/classes/${clsId}/attendees/${bookingId}`, { status });
            await refreshClasses();
        } catch (e) {
            await showAlert({ title: 'Error', message: e.response?.data?.error || 'Failed to update attendance', type: 'danger' });
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">My Classes</h1>
                <p className="text-text-muted mt-1">Class schedule and attendee list</p>
            </header>

            {classes.length === 0 ? (
                <div className="text-center py-16 bg-surface rounded-2xl border border-white/5">
                    <p className="text-text-muted">No classes assigned yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5">
                    {classes.map((cls) => {
                        const completionGuard = getCompletionGuard(cls, now);
                        const scheduleLabel = completionGuard.timeRange.label;

                        return (
                            <div key={cls.id} className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                                <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-bold text-white">{cls.name}</h2>
                                        <p className="text-text-muted text-xs mt-1">
                                            {cls.dayOfWeek} - {scheduleLabel} ({cls.duration} min) - {cls.sessionDate ? formatDateLabel(cls.sessionDate) : 'No session date'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                                            {cls.enrolled}/{cls.capacity} enrolled
                                        </div>
                                        {cls.completedToday ? (
                                            <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-lg border border-emerald-500/20 text-emerald-400 bg-emerald-500/10">
                                                <span className="material-icons-round text-[14px]">check_circle</span>
                                                Completed Today - PHP {cls.todayCompletion?.commissionAmount?.toFixed(2) || '0.00'}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleCompleteClass(cls, completionGuard)}
                                                disabled={!completionGuard.canComplete}
                                                className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-lg border ${
                                                    completionGuard.canComplete
                                                        ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                                                        : 'border-white/10 text-text-muted bg-white/5 cursor-not-allowed'
                                                }`}
                                            >
                                                Complete and Pay
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5">
                                    {!cls.completedToday && !completionGuard.canComplete && (
                                        <p className="mb-3 text-xs text-amber-300">{completionGuard.reason}</p>
                                    )}
                                    <p className="text-text-muted text-xs uppercase tracking-widest font-bold mb-3">Attendees</p>
                                    {cls.bookings?.length ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {cls.bookings.map((booking) => (
                                                <div key={booking.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                                                    <p className="text-white font-semibold text-sm">
                                                        {booking.member?.firstName} {booking.member?.lastName}
                                                    </p>
                                                    <p className="text-text-muted text-xs mt-1">
                                                        Member #{booking.memberId} - {booking.status}
                                                    </p>
                                                    <div className="flex gap-2 mt-3">
                                                        <button
                                                            onClick={() => updateAttendance(cls.id, booking.id, 'ATTENDED')}
                                                            disabled={updatingId === booking.id}
                                                            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50"
                                                        >
                                                            Attended
                                                        </button>
                                                        <button
                                                            onClick={() => updateAttendance(cls.id, booking.id, 'CONFIRMED')}
                                                            disabled={updatingId === booking.id}
                                                            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50"
                                                        >
                                                            Confirmed
                                                        </button>
                                                        <button
                                                            onClick={() => updateAttendance(cls.id, booking.id, 'CANCELLED')}
                                                            disabled={updatingId === booking.id}
                                                            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-red-500/30 text-red-300 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
                                                        >
                                                            Cancelled
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-text-muted text-sm">No attendees yet.</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    async function handleCompleteClass(cls, completionGuard) {
        if (!completionGuard.canComplete) {
            await showAlert({ title: 'Not Allowed Yet', message: completionGuard.reason, type: 'warning' });
            return;
        }

        const confirmed = await showConfirm({
            title: 'Complete Class?',
            message: "This will record attendance for payroll based on current 'Attended' or 'Confirmed' bookings.",
            confirmLabel: 'Complete & Pay',
            type: 'info'
        });
        if (!confirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/classes/${cls.id}/complete`, {
                sessionDate: cls.sessionDate || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await showAlert({ title: 'Success', message: 'Class completed and commission recorded!', type: 'success' });
            refreshClasses();
        } catch (error) {
            console.error('Complete Class Error:', error);
            await showAlert({ title: 'Failed', message: error.response?.data?.error || 'Failed to complete class', type: 'danger' });
        }
    }
}
