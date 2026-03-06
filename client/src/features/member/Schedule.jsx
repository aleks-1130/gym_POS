import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { withApiBase } from '../../config/api';
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
            label: String(time || 'TBA')
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
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

const fallbackClassImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%230f172a'/%3E%3Cstop offset='1' stop-color='%231e293b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='480' height='480' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='22'%3EClass Image Unavailable%3C/text%3E%3C/svg%3E";

const handleClassImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackClassImage;
};

export default function Schedule() {
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const sessionPolicyNote = 'Joining a class consumes 1 session. If you leave later, that session is still consumed and not refunded.';
    const [classes, setClasses] = useState([]);
    const [sessionInfo, setSessionInfo] = useState({
        classSessionsRemaining: 0,
        classSessionsUsed: 0,
        canBookClasses: false
    });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedDay, setSelectedDay] = useState(null);

    const fetchClasses = useCallback(async () => {
        try {
            const res = await axios.get(withApiBase('/api/members/classes'), {
                params: { _t: Date.now() }
            });
            setClasses(res.data?.classes || []);
            setSessionInfo(res.data?.sessionInfo || {
                classSessionsRemaining: 0,
                classSessionsUsed: 0,
                canBookClasses: false
            });
        } catch (error) {
            console.error('Failed to fetch classes', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    useEffect(() => {
        const handleFocus = () => fetchClasses();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchClasses();
            }
        };

        const intervalId = setInterval(fetchClasses, 15000);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchClasses]);

    const handleBook = async (classId, sessionDate) => {
        const confirmed = await showConfirm({
            title: 'Session Policy',
            message: `${sessionPolicyNote} Continue joining this class?`,
            confirmLabel: 'Join Class'
        });
        if (!confirmed) return;

        try {
            await axios.post(withApiBase('/api/members/book'), { classId, sessionDate });
            await showAlert({ title: 'Joined!', message: 'Joined class successfully!', type: 'success' });
            fetchClasses();
        } catch (error) {
            await showAlert({ title: 'Booking Failed', message: error.response?.data?.error || 'Booking failed', type: 'danger' });
        }
    };

    const handleCancel = async (classId, sessionDate) => {
        const policyConfirmed = await showConfirm({
            title: 'Leave Class?',
            message: 'Leaving this class will NOT refund your session. Your session remains consumed.',
            confirmLabel: 'I Understand',
            type: 'danger'
        });
        if (!policyConfirmed) return;

        const finalConfirmed = await showConfirm({
            title: 'Final Confirmation',
            message: 'Are you sure you want to leave this class?',
            confirmLabel: 'Leave Anyway',
            type: 'danger'
        });
        if (!finalConfirmed) return;

        try {
            await axios.post(withApiBase('/api/members/cancel-booking'), { classId, sessionDate });
            await showAlert({ title: 'Left Class', message: 'You left the class. Your session is still counted as used.', type: 'success' });
            fetchClasses();
        } catch (error) {
            await showAlert({ title: 'Cancel Failed', message: error.response?.data?.error || 'Failed to cancel', type: 'danger' });
        }
    };

    const filteredClasses = classes.filter(cls => {
        if (filter === 'booked' && !cls.isBooked) return false;
        if (filter === 'available' && (cls.isBooked || cls.enrolled >= cls.capacity)) return false;

        if (selectedDay) {
            const dayMapping = {
                M: ['Mon', 'Monday'],
                T: ['Tue', 'Tuesday'],
                W: ['Wed', 'Wednesday'],
                TH: ['Thu', 'Thursday'],
                F: ['Fri', 'Friday'],
                S: ['Sat', 'Saturday'],
                SUN: ['Sun', 'Sunday']
            };
            const matchDays = dayMapping[selectedDay];
            if (!matchDays?.some(day => cls.dayOfWeek?.includes(day))) return false;
        }

        return true;
    });

    const dayButtons = [
        { value: 'M', label: 'M' },
        { value: 'T', label: 'T' },
        { value: 'W', label: 'W' },
        { value: 'TH', label: 'TH' },
        { value: 'F', label: 'F' },
        { value: 'S', label: 'S' },
        { value: 'SUN', label: 'SUN' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-text-muted text-sm">Loading schedule...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-20 px-4 max-w-5xl mx-auto">
            <div className="pt-4 pb-3">
                <h1 className="text-xl font-bold text-white">Gym Class Schedule</h1>
                <p className="text-text-muted text-xs mt-0.5">Join class sessions (session consumed on join, no refund on leave)</p>
            </div>

            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-[11px] sm:text-xs text-amber-200 leading-relaxed">
                    <span className="font-bold">Important:</span> {sessionPolicyNote}
                </p>
            </div>

            <div className="mb-4 bg-surface border border-white/10 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <p className="text-xs font-semibold tracking-wide uppercase text-text-muted">Sessions Left</p>
                        <p className={`mt-1 text-2xl font-extrabold ${sessionInfo.classSessionsRemaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {sessionInfo.classSessionsRemaining}
                        </p>
                    </div>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                        <p className="text-xs font-semibold tracking-wide uppercase text-text-muted">Sessions Used</p>
                        <p className="mt-1 text-2xl font-extrabold text-white">{sessionInfo.classSessionsUsed}</p>
                    </div>
                </div>
                {sessionInfo.classSessionsRemaining <= 0 && (
                    <p className="text-xs text-red-400 mt-3">No class sessions left. Buy a class session package at the front desk to join again.</p>
                )}
            </div>

            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 -mx-4 px-4 py-3 mb-2 border-b border-white/5">
                <div className="flex gap-2">
                    {[
                        { value: 'all', label: 'All Classes', icon: 'grid_view' },
                        { value: 'booked', label: 'Joined Classes', icon: 'check_circle' },
                        { value: 'available', label: 'Available', icon: 'event_available' }
                    ].map(f => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${filter === f.value
                                    ? 'bg-primary text-background shadow-lg'
                                    : 'bg-surface text-text-muted hover:text-white border border-white/5'
                                }`}
                        >
                            <span className="material-icons-round text-base">{f.icon}</span>
                            <span className="hidden sm:inline">{f.label}</span>
                            <span className="sm:hidden">{f.label.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-4 px-1">
                <div className="grid grid-cols-7 gap-2">
                    {dayButtons.map(day => (
                        <button
                            key={day.value}
                            onClick={() => setSelectedDay(selectedDay === day.value ? null : day.value)}
                            className={`w-full h-9 rounded-lg font-bold text-[10px] sm:text-xs transition-all active:scale-95 ${selectedDay === day.value
                                    ? 'bg-primary text-background shadow-lg'
                                    : 'bg-surface text-text-muted hover:text-white border border-white/5'
                                }`}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                {filteredClasses.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <span className="material-icons-round text-3xl text-text-muted">event_busy</span>
                        </div>
                        <p className="text-text-muted text-sm">No classes found</p>
                    </div>
                ) : (
                    filteredClasses.map(cls => {
                        const isFull = cls.enrolled >= cls.capacity;
                        const capacityPercent = (cls.enrolled / cls.capacity) * 100;
                        const noSessionsLeft = sessionInfo.classSessionsRemaining <= 0;
                        const cannotJoin = isFull || noSessionsLeft;
                        const classTime = getClassTimeRange(cls.time, cls.duration);
                        const scheduleType = String(cls.scheduleType || 'RECURRING').toUpperCase();

                        return (
                            <div
                                key={cls.id}
                                className={`bg-surface rounded-xl p-4 border transition-all ${cls.isBooked
                                        ? 'border-primary/30 bg-primary/5'
                                        : 'border-white/5 hover:border-white/10'
                                    }`}
                            >
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                            {cls.imageUrl ? (
                                                <img src={cls.imageUrl} alt={cls.name} onError={handleClassImageError} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                    <span className="material-icons-round text-2xl">fitness_center</span>
                                                </div>
                                            )}
                                            {cls.isBooked && (
                                                <span className="absolute bottom-1 left-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-background">
                                                    BOOKED
                                                </span>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex items-start justify-between gap-2">
                                                <h3 className="line-clamp-1 text-base font-bold text-white">{cls.name}</h3>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-xs font-bold text-primary">{classTime.start}</p>
                                                    <p className="text-[10px] text-text-muted">{classTime.end ? classTime.end : `${cls.duration} min`}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                                <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">person</span>{cls.trainer?.name || 'TBA'}</span>
                                                <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">calendar_today</span>{cls.dayOfWeek}</span>
                                                {scheduleType === 'ONE_TIME' && (
                                                    <span className="inline-flex items-center gap-1"><span className="material-icons-round text-sm">event</span>{formatDateLabel(cls.oneTimeDate || cls.sessionDate)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <span className="text-xs text-text-muted">{cls.enrolled} / {cls.capacity} spots filled</span>
                                            <span className={`text-xs font-bold ${isFull ? 'text-red-400' :
                                                    capacityPercent > 75 ? 'text-yellow-400' :
                                                        'text-emerald-400'
                                                }`}>
                                                {isFull ? 'Full' : `${cls.capacity - cls.enrolled} left`}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                            <div
                                                className={`h-full transition-all ${isFull ? 'bg-red-500' :
                                                        capacityPercent > 75 ? 'bg-yellow-500' :
                                                            'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {cls.isBooked ? (
                                        <button
                                            onClick={() => handleCancel(cls.id, cls.sessionDate)}
                                            className="w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 active:scale-95 transition-all text-sm border border-red-500/20 flex items-center justify-center gap-1"
                                        >
                                            <span className="material-icons-round text-base">cancel</span>
                                            Leave Class (Session Stays Used)
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleBook(cls.id, cls.sessionDate)}
                                            disabled={cannotJoin}
                                            className={`w-full py-2.5 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-1 ${cannotJoin
                                                    ? 'bg-white/5 text-text-muted cursor-not-allowed border border-white/5'
                                                    : 'bg-primary text-background hover:brightness-110 active:scale-95 shadow-lg'
                                                }`}
                                        >
                                            <span className="material-icons-round text-base">
                                                {isFull ? 'block' : noSessionsLeft ? 'lock' : 'add_circle'}
                                            </span>
                                            {isFull ? 'Class Full' : noSessionsLeft ? 'No Sessions Left' : 'Join Class'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {filteredClasses.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="bg-surface rounded-lg p-3 border border-white/5 text-center">
                        <div className="text-xl font-bold text-white">{classes.length}</div>
                        <div className="text-xs text-text-muted mt-0.5">Total Classes</div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-white/5 text-center">
                        <div className="text-xl font-bold text-primary">{classes.filter(c => c.isBooked).length}</div>
                        <div className="text-xs text-text-muted mt-0.5">My Bookings</div>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-white/5 text-center">
                        <div className={`text-xl font-bold ${sessionInfo.classSessionsRemaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {sessionInfo.classSessionsRemaining}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">Sessions Left</div>
                    </div>
                </div>
            )}
        </div>
    );
}
