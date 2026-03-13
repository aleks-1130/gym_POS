import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';

export default function TrainerSessions() {
    const COMPLETE_GRACE_MINUTES = 5;
    const NO_SHOW_GRACE_MINUTES = 10;
    const { alert: showAlert } = useConfirm();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('calendar'); // calendar | history
    const [activeDay, setActiveDay] = useState('');
    const [completingId, setCompletingId] = useState(null);
    const [editingSession, setEditingSession] = useState(null);
    const [notesDraft, setNotesDraft] = useState('');
    const [refundModalSession, setRefundModalSession] = useState(null);
    const [refundReason, setRefundReason] = useState('OTHER');
    const [refundDetails, setRefundDetails] = useState('');
    const [refundSubmitting, setRefundSubmitting] = useState(false);
    const [refundError, setRefundError] = useState('');
    const [refundNotice, setRefundNotice] = useState('');
    const [unavailableModalSession, setUnavailableModalSession] = useState(null);
    const [unavailableForm, setUnavailableForm] = useState({ reason: '', preferredDate: '', preferredTime: '' });
    const [unavailableLoading, setUnavailableLoading] = useState(false);
    const [unavailableError, setUnavailableError] = useState('');
    const [noShowModalSession, setNoShowModalSession] = useState(null);
    const [noShowNote, setNoShowNote] = useState('');
    const [noShowSubmitting, setNoShowSubmitting] = useState(false);
    const [noShowError, setNoShowError] = useState('');
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [draggingId, setDraggingId] = useState(null);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const res = await axios.get('/api/trainer/me/sessions');
                setSessions(res.data || []);
            } catch (e) {
                console.error("Failed to fetch trainer sessions", e);
            } finally {
                setLoading(false);
            }
        };

        fetchSessions();
    }, []);

    const refreshSessions = async () => {
        const res = await axios.get('/api/trainer/me/sessions');
        setSessions(res.data || []);
    };

    const handleMarkCompleted = async (sessionId) => {
        setCompletingId(sessionId);
        try {
            await axios.post(`/api/trainer/me/sessions/${sessionId}/complete`);
            await refreshSessions();
        } catch (e) {
            await showAlert({ title: 'Error', message: e.response?.data?.error || 'Failed to mark session completed', type: 'danger' });
        } finally {
            setCompletingId(null);
        }
    };

    const handleUpdateSession = async (sessionId, payload) => {
        await axios.patch(`/api/trainer/me/sessions/${sessionId}`, payload);
        await refreshSessions();
    };

    const handleOpenNoShowModal = (session) => {
        setNoShowModalSession(session);
        setNoShowNote('');
        setNoShowError('');
    };

    const handleSubmitNoShow = async () => {
        if (!noShowModalSession) return;
        setNoShowSubmitting(true);
        setNoShowError('');
        try {
            await axios.post(`/api/trainer/me/sessions/${noShowModalSession.id}/no-show`, {
                note: noShowNote
            });
            setNoShowModalSession(null);
            setRefundNotice('Session marked as NO_SHOW.');
            await refreshSessions();
        } catch (e) {
            setNoShowError(e.response?.data?.error || "Failed to mark no-show");
        } finally {
            setNoShowSubmitting(false);
        }
    };

    const handleOpenRefundExceptionModal = (session) => {
        setRefundModalSession(session);
        setRefundReason('OTHER');
        setRefundDetails('');
        setRefundError('');
    };

    const handleSubmitRefundException = async () => {
        if (!refundModalSession) return;
        setRefundSubmitting(true);
        setRefundError('');
        try {
            await axios.post(`/api/trainer/me/sessions/${refundModalSession.id}/refund-exception`, {
                reason: refundReason,
                details: refundDetails
            });
            setRefundModalSession(null);
            setRefundNotice('Refund exception request submitted for staff/admin review.');
            await refreshSessions();
        } catch (e) {
            setRefundError(e.response?.data?.error || "Failed to request refund exception");
        } finally {
            setRefundSubmitting(false);
        }
    };

    const handleOpenUnableModal = (session) => {
        setUnavailableModalSession(session);
        setUnavailableForm({ reason: '', preferredDate: '', preferredTime: '' });
        setUnavailableError('');
    };

    const handleSubmitUnableToAttend = async () => {
        if (!unavailableModalSession) return;
        if (!String(unavailableForm.reason).trim()) {
            setUnavailableError('Please provide a reason.');
            return;
        }
        setUnavailableLoading(true);
        setUnavailableError('');
        try {
            await axios.post(`/api/trainer/me/sessions/${unavailableModalSession.id}/unable-to-attend`, {
                reason: unavailableForm.reason,
                preferredDate: unavailableForm.preferredDate || undefined,
                preferredTime: unavailableForm.preferredTime || undefined
            });
            setUnavailableModalSession(null);
            setRefundNotice('Unable-to-attend request submitted to staff/admin for review.');
            await refreshSessions();
        } catch (e) {
            setUnavailableError(e.response?.data?.error || 'Failed to submit request');
        } finally {
            setUnavailableLoading(false);
        }
    };

    const handleOpenNotes = (session) => {
        setEditingSession(session);
        setNotesDraft(session.notes || '');
    };

    const handleSaveNotes = async () => {
        if (!editingSession) return;
        try {
            await handleUpdateSession(editingSession.id, { notes: notesDraft });
            setEditingSession(null);
        } catch (e) {
            await showAlert({ title: 'Error', message: e.response?.data?.error || 'Failed to update notes', type: 'danger' });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const now = new Date();
    const finalizedStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
    const visibleSessions = sessions.filter((session) => {
        const isPast = new Date(session.date) < now;
        const status = String(session.status || '').toUpperCase();
        const isFinalized = finalizedStatuses.includes(status);
        return !isPast && !isFinalized;
    });
    const needsActionSessions = [...sessions]
        .filter((session) => {
            const isPast = new Date(session.date) < now;
            const status = String(session.status || '').toUpperCase();
            return isPast && !finalizedStatuses.includes(status);
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const sortedSessions = [...visibleSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const groupKey = (dateStr) => new Date(dateStr).toDateString();
    const grouped = sortedSessions.reduce((acc, session) => {
        const key = groupKey(session.date);
        acc[key] = acc[key] || [];
        acc[key].push(session);
        return acc;
    });
    const dayKeys = Object.keys(grouped);
    const currentDay = activeDay || dayKeys[0] || '';
    const currentSessions = currentDay ? grouped[currentDay] : [];

    const monthYearLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const endOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const leadingDays = startOfMonth.getDay();
    const totalCells = leadingDays + endOfMonth.getDate();
    const rows = Math.ceil(totalCells / 7);
    const firstCellDate = new Date(startOfMonth);
    firstCellDate.setDate(firstCellDate.getDate() - leadingDays);

    const sessionsByDay = visibleSessions.reduce((acc, session) => {
        const key = new Date(session.date).toDateString();
        acc[key] = acc[key] || [];
        acc[key].push(session);
        return acc;
    });

    const getTimeString = (sessionDate) => {
        const d = new Date(sessionDate);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const handleDropOnDay = async (dateObj) => {
        if (!draggingId) return;
        const session = sessions.find((s) => s.id === draggingId);
        if (!session) return;
        const dateStr = dateObj.toISOString().split('T')[0];
        const timeStr = getTimeString(session.date);
        try {
            await handleUpdateSession(session.id, { date: dateStr, time: timeStr });
        } catch (e) {
            await showAlert({ title: 'Reschedule Failed', message: e.response?.data?.error || 'Failed to reschedule', type: 'danger' });
        } finally {
            setDraggingId(null);
        }
    };

    const getStatusBadgeClass = (status) => {
        if (status === 'COMPLETED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (status === 'SCHEDULED') return 'bg-primary/10 text-primary border-primary/20';
        if (status === 'RESCHEDULED') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
        if (status === 'RESCHEDULE_REQUESTED') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
        if (status === 'NO_SHOW') return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
        return 'bg-red-500/10 text-red-500 border-red-500/20';
    };

    const canMarkCompleted = (session) => {
        const start = new Date(session?.date);
        if (Number.isNaN(start.getTime())) return false;
        const durationMinutes = Math.max(0, Number(session?.duration) || 0);
        const end = new Date(start.getTime() + ((durationMinutes + COMPLETE_GRACE_MINUTES) * 60 * 1000));
        return new Date() >= end;
    };

    const canMarkNoShow = (session) => {
        const start = new Date(session?.date);
        if (Number.isNaN(start.getTime())) return false;
        const eligibleAt = new Date(start.getTime() + (NO_SHOW_GRACE_MINUTES * 60 * 1000));
        return new Date() >= eligibleAt;
    };

    const canTakeAttendanceAction = (session) => {
        const status = String(session?.status || '').toUpperCase();
        return status === 'SCHEDULED' || status === 'RESCHEDULED';
    };

    const sessionHistory = [...sessions]
        .filter((session) => {
            const isPast = new Date(session.date) < now;
            const status = String(session.status || '').toUpperCase();
            return isPast && finalizedStatuses.includes(status);
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">My Sessions</h1>
                    <p className="text-text-muted mt-1">Personal training bookings with members</p>
                    {refundNotice && (
                        <p className="text-emerald-300 text-xs mt-2">{refundNotice}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveView('calendar')}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'calendar'
                            ? 'bg-primary text-background'
                            : 'bg-surface text-text-muted border border-white/10 hover:text-white'
                            }`}
                    >
                        Calendar
                    </button>
                    <button
                        onClick={() => setActiveView('history')}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'history'
                            ? 'bg-primary text-background'
                            : 'bg-surface text-text-muted border border-white/10 hover:text-white'
                            }`}
                    >
                        Session History
                    </button>
                </div>
            </header>

            {activeView === 'calendar' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-surface rounded-2xl border border-white/5 p-4">
                        <button
                            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                            className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10"
                        >
                            Prev
                        </button>
                        <p className="text-white font-semibold">{monthYearLabel}</p>
                        <button
                            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                            className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10"
                        >
                            Next
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 text-xs text-text-muted font-bold uppercase tracking-wider px-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                            <div key={d} className="text-center">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: rows * 7 }).map((_, idx) => {
                            const day = new Date(firstCellDate);
                            day.setDate(firstCellDate.getDate() + idx);
                            const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                            const key = day.toDateString();
                            const daySessions = sessionsByDay[key] || [];
                            const isToday = new Date().toDateString() === key;

                            return (
                                <div
                                    key={`${key}-${idx}`}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDropOnDay(day)}
                                    className={`min-h-[110px] rounded-xl border p-2 flex flex-col gap-2 transition-colors ${isCurrentMonth ? 'bg-surface border-white/5' : 'bg-white/5 border-white/5 opacity-50'
                                        } ${isToday ? 'ring-1 ring-primary/40' : ''}`}
                                >
                                    <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
                                        <span>{day.getDate()}</span>
                                        {daySessions.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                                                {daySessions.length}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                        {daySessions.slice(0, 3).map((session) => (
                                            <div
                                                key={session.id}
                                                draggable
                                                onDragStart={() => setDraggingId(session.id)}
                                                onDragEnd={() => setDraggingId(null)}
                                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white"
                                                title="Drag to reschedule"
                                            >
                                                <p className="truncate font-semibold">
                                                    {getTimeString(session.date)} {session.member?.firstName}
                                                </p>
                                                <p className="text-[9px] text-text-muted mt-0.5">
                                                    {session.duration} min � {session.status}
                                                </p>
                                            </div>
                                        ))}
                                        {daySessions.length > 3 && (
                                            <div className="text-[10px] text-text-muted">{daySessions.length - 3} more</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {dayKeys.length === 0 && (
                            <div className="text-text-muted text-sm">No sessions scheduled.</div>
                        )}
                        {dayKeys.map((day) => (
                            <button
                                key={day}
                                onClick={() => setActiveDay(day)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${currentDay === day
                                    ? 'bg-primary/15 text-primary border-primary/30'
                                    : 'bg-surface text-text-muted border-white/10 hover:text-white'
                                    }`}
                            >
                                {new Date(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                <span className="ml-2 text-[10px] text-text-muted">({grouped[day].length})</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {currentSessions.length === 0 ? (
                            <div className="bg-surface rounded-2xl border border-white/5 p-6 text-text-muted text-sm">
                                No sessions for this day.
                            </div>
                        ) : (
                            currentSessions.map((session) => (
                                <div key={session.id} className="bg-surface rounded-2xl border border-white/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <p className="text-white font-semibold">
                                            {session.member?.firstName} {session.member?.lastName}
                                        </p>
                                        <p className="text-text-muted text-xs mt-1">
                                            {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {session.duration} min
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${session.status === 'COMPLETED'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : session.status === 'SCHEDULED'
                                                    ? 'bg-primary/10 text-primary border-primary/20'
                                                    : session.status === 'RESCHEDULED'
                                                        ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                                                        : session.status === 'NO_SHOW'
                                                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                }`}>
                                                {session.status}
                                            </span>
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${session.paymentStatus === 'PAID'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }`}>
                                                {session.paymentStatus}
                                            </span>
                                        </div>
                                    </div>
                                    {canTakeAttendanceAction(session) && (
                                        <button
                                            onClick={() => handleMarkCompleted(session.id)}
                                            disabled={completingId === session.id || !canMarkCompleted(session)}
                                            title={canMarkCompleted(session) ? 'Mark this session as completed' : 'Completion is available only after session duration ends'}
                                            className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                                        >
                                            {completingId === session.id ? 'Updating...' : 'Mark As Complete'}
                                        </button>
                                    )}
                                    {canTakeAttendanceAction(session) && (
                                        <button
                                            onClick={() => handleOpenNoShowModal(session)}
                                            disabled={!canMarkNoShow(session)}
                                            title={canMarkNoShow(session) ? 'Mark this session as no-show' : 'No-show can be marked only after grace period'}
                                            className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                        >
                                            Mark No Show
                                        </button>
                                    )}
                                    {session.paymentStatus === 'PAID' && session.status !== 'COMPLETED' && (
                                        <button
                                            onClick={() => handleOpenRefundExceptionModal(session)}
                                            className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-all"
                                        >
                                            Refund Exception
                                        </button>
                                    )}
                                    {canTakeAttendanceAction(session) && (
                                        <button
                                            onClick={() => handleOpenUnableModal(session)}
                                            className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/30 text-xs font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                                        >
                                            Unable To Attend
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleOpenNotes(session)}
                                        className="px-4 py-2 rounded-xl bg-white/5 text-white border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                                    >
                                        Notes
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">Needs Action</h2>
                            <span className="text-xs text-text-muted">
                                {needsActionSessions.length} session{needsActionSessions.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        {needsActionSessions.length === 0 ? (
                            <div className="bg-surface rounded-2xl border border-white/5 p-5 text-sm text-text-muted">
                                No unresolved past sessions.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {needsActionSessions.map((session) => (
                                    <div key={`needs-action-${session.id}`} className="bg-surface rounded-xl border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <p className="text-white font-semibold">
                                                {session.member?.firstName} {session.member?.lastName}
                                            </p>
                                            <p className="text-xs text-text-muted mt-1">
                                                {new Date(session.date).toLocaleDateString()} {' '}
                                                {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} � {session.duration} min
                                            </p>
                                            <div className="flex gap-2 mt-2">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${getStatusBadgeClass(session.status)}`}>
                                                    {session.status}
                                                </span>
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${session.paymentStatus === 'PAID'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    }`}>
                                                    {session.paymentStatus}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                onClick={() => handleMarkCompleted(session.id)}
                                                disabled={completingId === session.id || !canMarkCompleted(session)}
                                                title={canMarkCompleted(session) ? 'Mark this session as completed' : 'Completion is available only after session duration ends'}
                                                className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                                            >
                                                {completingId === session.id ? 'Updating...' : 'Mark As Complete'}
                                            </button>
                                            <button
                                                onClick={() => handleOpenNoShowModal(session)}
                                                disabled={!canMarkNoShow(session)}
                                                title={canMarkNoShow(session) ? 'Mark this session as no-show' : 'No-show can be marked only after grace period'}
                                                className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                            >
                                                Mark No Show
                                            </button>
                                            {session.paymentStatus === 'PAID' && (
                                                <button
                                                    onClick={() => handleOpenRefundExceptionModal(session)}
                                                    className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-all"
                                                >
                                                    Refund Exception
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleOpenNotes(session)}
                                                className="px-3 py-1 rounded-lg bg-white/5 text-white border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                                            >
                                                Notes
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            ) : (
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white">Session History</h2>
                        <span className="text-xs text-text-muted">
                            {sessionHistory.length} past session{sessionHistory.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    {sessionHistory.length === 0 ? (
                        <div className="bg-surface rounded-2xl border border-white/5 p-5 text-sm text-text-muted">
                            No past sessions yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sessionHistory.map((session) => (
                                <div key={`history-${session.id}`} className="bg-surface rounded-xl border border-white/5 p-4 flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-white font-semibold">
                                            {session.member?.firstName} {session.member?.lastName}
                                        </p>
                                        <p className="text-xs text-text-muted mt-1">
                                            {new Date(session.date).toLocaleDateString()} {' '}
                                            {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} � {session.duration} min
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${getStatusBadgeClass(session.status)}`}>
                                            {session.status}
                                        </span>
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${session.paymentStatus === 'PAID'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                            {session.paymentStatus}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {editingSession && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-lg">
                        <div className="p-5 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Session Notes</h2>
                                <p className="text-text-muted text-xs mt-1">
                                    {editingSession.member?.firstName} {editingSession.member?.lastName}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingSession(null)}
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"
                            >
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                        <div className="p-5">
                            <textarea
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                rows={6}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                                placeholder="Add session notes..."
                            />
                        </div>
                        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setEditingSession(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveNotes}
                                className="px-4 py-2 rounded-xl bg-primary text-background text-sm font-medium hover:brightness-110"
                            >
                                Save Notes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {refundModalSession && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-lg">
                        <div className="p-5 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Request Refund Exception</h2>
                                <p className="text-text-muted text-xs mt-1">
                                    {refundModalSession.member?.firstName} {refundModalSession.member?.lastName}
                                </p>
                            </div>
                            <button
                                onClick={() => setRefundModalSession(null)}
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"
                            >
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Reason</label>
                                <select
                                    value={refundReason}
                                    onChange={(e) => setRefundReason(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white cursor-pointer focus:outline-none focus:border-primary"
                                >
                                    <option style={{ color: '#111', backgroundColor: '#fff' }} value="OTHER">Other</option>
                                    <option style={{ color: '#111', backgroundColor: '#fff' }} value="TRAINER_ABSENT">Trainer Absent</option>
                                    <option style={{ color: '#111', backgroundColor: '#fff' }} value="GYM_CLOSURE">Gym Closure</option>
                                    <option style={{ color: '#111', backgroundColor: '#fff' }} value="SYSTEM_ERROR">System Error</option>
                                    <option style={{ color: '#111', backgroundColor: '#fff' }} value="MEDICAL_EMERGENCY">Medical Emergency</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Details (optional)</label>
                                <textarea
                                    value={refundDetails}
                                    onChange={(e) => setRefundDetails(e.target.value)}
                                    rows={4}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                                    placeholder="Provide context for staff/admin review..."
                                />
                            </div>
                            {refundError && (
                                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    {refundError}
                                </div>
                            )}
                            <p className="text-xs text-text-muted">
                                Refunds are exception-based and require staff/admin approval.
                            </p>
                        </div>
                        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setRefundModalSession(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10"
                                disabled={refundSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitRefundException}
                                disabled={refundSubmitting}
                                className="px-4 py-2 rounded-xl bg-primary text-background text-sm font-medium hover:brightness-110 disabled:opacity-60"
                            >
                                {refundSubmitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {noShowModalSession && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-lg">
                        <div className="p-5 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Mark Session No-Show</h2>
                                <p className="text-text-muted text-xs mt-1">
                                    {noShowModalSession.member?.firstName} {noShowModalSession.member?.lastName}
                                </p>
                            </div>
                            <button
                                onClick={() => setNoShowModalSession(null)}
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"
                            >
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-text-muted">
                                This marks the session as <span className="text-rose-300 font-semibold">NO_SHOW</span> under your no-refund-default policy.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Note (optional)</label>
                                <textarea
                                    value={noShowNote}
                                    onChange={(e) => setNoShowNote(e.target.value)}
                                    rows={4}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                                    placeholder="Add context for staff/admin..."
                                />
                            </div>
                            {noShowError && (
                                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    {noShowError}
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setNoShowModalSession(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10"
                                disabled={noShowSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitNoShow}
                                disabled={noShowSubmitting}
                                className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-500/30 text-sm font-medium hover:bg-rose-500/30 disabled:opacity-60"
                            >
                                {noShowSubmitting ? 'Submitting...' : 'Confirm No-Show'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {unavailableModalSession && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl border border-white/10 w-full max-w-lg">
                        <div className="p-5 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">Unable To Attend Request</h2>
                                <p className="text-text-muted text-xs mt-1">
                                    {unavailableModalSession.member?.firstName} {unavailableModalSession.member?.lastName}
                                </p>
                            </div>
                            <button
                                onClick={() => setUnavailableModalSession(null)}
                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"
                            >
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-2">Reason *</label>
                                <textarea
                                    value={unavailableForm.reason}
                                    onChange={(e) => setUnavailableForm((prev) => ({ ...prev, reason: e.target.value }))}
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                                    placeholder="Explain why you cannot attend this session..."
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">Preferred Date (optional)</label>
                                    <input
                                        type="date"
                                        value={unavailableForm.preferredDate}
                                        onChange={(e) => setUnavailableForm((prev) => ({ ...prev, preferredDate: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">Preferred Time (optional)</label>
                                    <input
                                        type="time"
                                        value={unavailableForm.preferredTime}
                                        onChange={(e) => setUnavailableForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                            {unavailableError && (
                                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    {unavailableError}
                                </div>
                            )}
                            <p className="text-xs text-text-muted">
                                Staff/Admin will review and decide move, credit, refund, or deny.
                            </p>
                        </div>
                        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setUnavailableModalSession(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10"
                                disabled={unavailableLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitUnableToAttend}
                                disabled={unavailableLoading}
                                className="px-4 py-2 rounded-xl bg-primary text-background text-sm font-medium hover:brightness-110 disabled:opacity-60"
                            >
                                {unavailableLoading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


