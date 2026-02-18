import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function TrainerSessions() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('calendar'); // calendar | list
    const [activeDay, setActiveDay] = useState('');
    const [completingId, setCompletingId] = useState(null);
    const [editingSession, setEditingSession] = useState(null);
    const [notesDraft, setNotesDraft] = useState('');
    const [monthCursor, setMonthCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [draggingId, setDraggingId] = useState(null);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/trainer/me/sessions');
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
        const res = await axios.get('http://localhost:5000/api/trainer/me/sessions');
        setSessions(res.data || []);
    };

    const handleMarkCompleted = async (sessionId) => {
        setCompletingId(sessionId);
        try {
            await axios.post(`http://localhost:5000/api/trainer/me/sessions/${sessionId}/complete`);
            await refreshSessions();
        } catch (e) {
            alert(e.response?.data?.error || "Failed to mark session completed");
        } finally {
            setCompletingId(null);
        }
    };

    const handleUpdateSession = async (sessionId, payload) => {
        await axios.patch(`http://localhost:5000/api/trainer/me/sessions/${sessionId}`, payload);
        await refreshSessions();
    };

    const handleCancelSession = async (sessionId) => {
        if (!confirm("Are you sure you want to cancel this session?")) return;
        try {
            await axios.post(`http://localhost:5000/api/trainer/me/sessions/${sessionId}/cancel`);
            refreshSessions();
        } catch (e) {
            alert(e.response?.data?.error || "Failed to cancel session");
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
            alert(e.response?.data?.error || "Failed to update notes");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const groupKey = (dateStr) => new Date(dateStr).toDateString();
    const grouped = sortedSessions.reduce((acc, session) => {
        const key = groupKey(session.date);
        acc[key] = acc[key] || [];
        acc[key].push(session);
        return acc;
    }, {});
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

    const sessionsByDay = sessions.reduce((acc, session) => {
        const key = new Date(session.date).toDateString();
        acc[key] = acc[key] || [];
        acc[key].push(session);
        return acc;
    }, {});

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
            alert(e.response?.data?.error || "Failed to reschedule");
        } finally {
            setDraggingId(null);
        }
    };

    const adjustDuration = async (session, delta) => {
        const next = Math.max(15, Math.min(480, (session.duration || 0) + delta));
        try {
            await handleUpdateSession(session.id, { duration: next });
        } catch (e) {
            alert(e.response?.data?.error || "Failed to update duration");
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">My Sessions</h1>
                    <p className="text-text-muted mt-1">Personal training bookings with members</p>
                </div>
                <div className="flex gap-2">
                    {[
                        { value: 'calendar', label: 'Calendar' },
                        { value: 'list', label: 'List' }
                    ].map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => setActiveView(tab.value)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeView === tab.value
                                ? 'bg-primary text-background'
                                : 'bg-surface text-text-muted border border-white/5'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
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
                                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white flex items-center justify-between gap-2"
                                                title="Drag to reschedule"
                                            >
                                                <span className="truncate">
                                                    {getTimeString(session.date)} {session.member?.firstName}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustDuration(session, -15)}
                                                        className="px-1 rounded bg-white/10 text-text-muted hover:text-white"
                                                        title="Shorter"
                                                    >
                                                        −
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => adjustDuration(session, 15)}
                                                        className="px-1 rounded bg-white/10 text-text-muted hover:text-white"
                                                        title="Longer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {daySessions.length > 3 && (
                                            <div className="text-[10px] text-text-muted">+{daySessions.length - 3} more</div>
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
                                    {session.status !== 'COMPLETED' && (
                                        <button
                                            onClick={() => handleMarkCompleted(session.id)}
                                            disabled={completingId === session.id}
                                            className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                                        >
                                            {completingId === session.id ? 'Updating...' : 'Mark Completed'}
                                        </button>
                                    )}
                                    {session.status !== 'CANCELLED' && session.status !== 'COMPLETED' && (
                                        <button
                                            onClick={() => handleCancelSession(session.id)}
                                            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                                        >
                                            Cancel
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
                </div>
            ) : (
                <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Member</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Payment</th>
                                <th className="px-6 py-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sessions.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-6 text-center text-text-muted">No sessions yet.</td>
                                </tr>
                            )}
                            {sessions.map((session) => (
                                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-white font-medium">
                                        {session.member?.firstName} {session.member?.lastName}
                                    </td>
                                    <td className="px-6 py-4 text-white">
                                        {new Date(session.date).toLocaleDateString()} <span className="text-text-muted text-xs">{new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </td>
                                    <td className="px-6 py-4 text-white">{session.duration} min</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${session.status === 'COMPLETED'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : session.status === 'SCHEDULED'
                                                ? 'bg-primary/10 text-primary border-primary/20'
                                                : 'bg-red-500/10 text-red-500 border-red-500/20'
                                            }`}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${session.paymentStatus === 'PAID'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                            {session.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {session.status !== 'COMPLETED' ? (
                                            <button
                                                onClick={() => handleMarkCompleted(session.id)}
                                                disabled={completingId === session.id}
                                                className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                                            >
                                                {completingId === session.id ? 'Updating...' : 'Mark Completed'}
                                            </button>
                                        ) : (
                                            <span className="text-text-muted text-xs">Done</span>
                                        )}
                                        <button
                                            onClick={() => handleOpenNotes(session)}
                                            className="ml-2 px-3 py-1 rounded-lg bg-white/5 text-white border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                                        >
                                            Notes
                                        </button>
                                        {session.status !== 'CANCELLED' && session.status !== 'COMPLETED' && (
                                            <button
                                                onClick={() => handleCancelSession(session.id)}
                                                className="ml-2 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
        </div>
    );
}
