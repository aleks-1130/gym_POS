import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';

const FINALIZED_SESSION_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'DECLINED'];
const HISTORY_STATUS_FILTERS = ['ALL', 'UPCOMING', 'COMPLETED', 'CANCELLED'];
const HISTORY_TABS = ['BOOKINGS', 'CLASSES'];
const HISTORY_VISIBLE_LIMIT = 8;

const toDateKey = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toDateString();
};

const formatTime = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatSelectedDay = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'Selected Date';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatMoney = (value) =>
  `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const renderRatingStars = (rating) => {
  const numeric = Number(rating);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(numeric)));
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={`rating-star-${index}`}
            className={`text-[12px] leading-none ${index < rounded ? 'text-amber-300' : 'text-white/20'}`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-[11px] font-semibold text-white">{numeric.toFixed(1)}</span>
    </div>
  );
};

const canTakeSessionAttendanceAction = (status) => {
  const s = String(status || '').toUpperCase();
  return s === 'SCHEDULED' || s === 'RESCHEDULED';
};

const getSessionHistoryCategory = (session) => {
  const status = String(session?.status || '').toUpperCase();
  if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'DECLINED') return 'CANCELLED';
  if (status === 'COMPLETED') return 'COMPLETED';
  const d = new Date(session?.date);
  if (!Number.isNaN(d.getTime()) && d >= new Date()) return 'UPCOMING';
  return 'COMPLETED';
};

const getClassHistoryCategory = (entry) => {
  const status = String(entry?.status || '').toUpperCase();
  if (status === 'CANCELLED') return 'CANCELLED';
  const d = new Date(entry?.date);
  if (!Number.isNaN(d.getTime()) && d >= new Date()) return 'UPCOMING';
  return 'COMPLETED';
};

const getHistoryStatusLabel = (status) => {
  if (status === 'UPCOMING') return 'Upcoming';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Unknown';
};

const getClassSessionStatusLabel = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'IN_PROGRESS') return 'In Progress';
  if (normalized === 'COMPLETED') return 'Completed';
  return 'Scheduled';
};

const getClassSessionStatusClasses = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'IN_PROGRESS') return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
  if (normalized === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
  return 'bg-white/10 text-text-muted border-white/20';
};

export default function TrainerClassesSessions() {
  const { alert: showAlert } = useConfirm();
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classHistory, setClassHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingSessionId, setUpdatingSessionId] = useState(null);
  const [updatingClassBookingId, setUpdatingClassBookingId] = useState(null);
  const [updatingClassLifecycleId, setUpdatingClassLifecycleId] = useState(null);
  const [activeView, setActiveView] = useState('calendar');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date().toDateString());
  const [initializedSelection, setInitializedSelection] = useState(false);
  const [historyViewScope, setHistoryViewScope] = useState('BOOKINGS');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

  const refreshData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [sessionsRes, classesRes, classHistoryRes] = await Promise.all([
        axios.get('/api/trainer/me/sessions'),
        axios.get('/api/trainer/me/classes'),
        axios.get('/api/trainer/me/classes/history')
      ]);
      setSessions(sessionsRes.data || []);
      setClasses(classesRes.data || []);
      setClassHistory(classHistoryRes.data || []);
    } catch (e) {
      console.error('Failed to load trainer classes/sessions', e);
      if (!silent) await showAlert({ title: 'Error', message: 'Failed to load trainer schedule data.', type: 'danger' });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const calendarSessions = useMemo(() => {
    return [...sessions]
      .filter((s) => {
        const d = new Date(s.date);
        if (Number.isNaN(d.getTime())) return false;
        return !FINALIZED_SESSION_STATUSES.includes(String(s.status || '').toUpperCase());
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [sessions]);

  const classEvents = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return [...classes]
      .filter((c) => {
        const d = new Date(c.sessionDate);
        return !Number.isNaN(d.getTime()) && d >= startOfToday;
      })
      .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));
  }, [classes]);

  const eventsByDay = useMemo(() => {
    const map = {};
    calendarSessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (!key) return;
      map[key] = map[key] || [];
      map[key].push({ type: 'SESSION' });
    });
    classEvents.forEach((c) => {
      const key = toDateKey(c.sessionDate);
      if (!key) return;
      map[key] = map[key] || [];
      map[key].push({ type: 'CLASS' });
    });
    return map;
  }, [calendarSessions, classEvents]);

  const eventDayKeys = useMemo(() => Object.keys(eventsByDay).sort((a, b) => new Date(a) - new Date(b)), [eventsByDay]);

  useEffect(() => {
    if (initializedSelection) return;
    const todayKey = new Date().toDateString();
    if (eventDayKeys.includes(todayKey)) setSelectedDay(todayKey);
    else if (eventDayKeys.length > 0) setSelectedDay(eventDayKeys[0]);
    setInitializedSelection(true);
  }, [eventDayKeys, initializedSelection]);

  const selectedSessions = useMemo(() => calendarSessions.filter((s) => toDateKey(s.date) === selectedDay), [calendarSessions, selectedDay]);
  const selectedClasses = useMemo(() => classEvents.filter((c) => toDateKey(c.sessionDate) === selectedDay), [classEvents, selectedDay]);

  const bookingHistory = useMemo(() => {
    return [...sessions]
      .filter((s) => {
        const d = new Date(s.date);
        if (Number.isNaN(d.getTime())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sessions]);

  const classHistoryEntries = useMemo(() => {
    return [...classHistory]
      .filter((entry) => {
        const d = new Date(entry.date);
        return !Number.isNaN(d.getTime());
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [classHistory]);

  const filteredBookingHistory = bookingHistory;
  const filteredClassHistory = classHistoryEntries;

  const filteredBookingHistoryWithCategory = useMemo(() => {
    return filteredBookingHistory.map((session) => ({
      ...session,
      __historyCategory: getSessionHistoryCategory(session)
    }));
  }, [filteredBookingHistory]);

  const filteredClassHistoryWithCategory = useMemo(() => {
    return filteredClassHistory.map((entry) => ({
      ...entry,
      __historyCategory: getClassHistoryCategory(entry)
    }));
  }, [filteredClassHistory]);

  const activeHistoryTab = historyViewScope === 'CLASSES' ? 'CLASSES' : 'BOOKINGS';

  const activeTabBaseHistory = useMemo(() => {
    return activeHistoryTab === 'CLASSES' ? filteredClassHistoryWithCategory : filteredBookingHistoryWithCategory;
  }, [activeHistoryTab, filteredBookingHistoryWithCategory, filteredClassHistoryWithCategory]);

  const statusChipCounts = useMemo(() => {
    const counts = { ALL: activeTabBaseHistory.length, UPCOMING: 0, COMPLETED: 0, CANCELLED: 0 };
    activeTabBaseHistory.forEach((entry) => {
      const key = entry.__historyCategory;
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [activeTabBaseHistory]);

  const visibleHistoryItems = useMemo(() => {
    if (historyStatusFilter === 'ALL') return activeTabBaseHistory;
    return activeTabBaseHistory.filter((entry) => entry.__historyCategory === historyStatusFilter);
  }, [activeTabBaseHistory, historyStatusFilter]);

  const displayedHistoryItems = useMemo(() => visibleHistoryItems.slice(0, HISTORY_VISIBLE_LIMIT), [visibleHistoryItems]);
  const hiddenHistoryCount = Math.max(0, visibleHistoryItems.length - displayedHistoryItems.length);

  const historyTabCounts = useMemo(() => ({
    BOOKINGS: filteredBookingHistoryWithCategory.length,
    CLASSES: filteredClassHistoryWithCategory.length
  }), [filteredBookingHistoryWithCategory.length, filteredClassHistoryWithCategory.length]);

  const historySummary = useMemo(() => {
    const total = activeTabBaseHistory.length;
    const upcoming = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'UPCOMING').length;
    const spent = activeHistoryTab === 'BOOKINGS'
      ? activeTabBaseHistory.reduce((sum, entry) => sum + Number(entry.price || 0), 0)
      : activeTabBaseHistory.reduce((sum, entry) => sum + Number(entry.commissionAmount || 0), 0);
    return { total, upcoming, spent };
  }, [activeHistoryTab, activeTabBaseHistory]);

  const activeFilterCount = Number(historyStatusFilter !== 'ALL');

  const monthYearLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const endOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
  const leadingDays = startOfMonth.getDay();
  const rows = Math.ceil((leadingDays + endOfMonth.getDate()) / 7);
  const firstCellDate = new Date(startOfMonth);
  firstCellDate.setDate(firstCellDate.getDate() - leadingDays);

  const handleCompleteSession = async (sessionId) => {
    setUpdatingSessionId(sessionId);
    try {
      await axios.post(`/api/trainer/me/sessions/${sessionId}/complete`);
      await refreshData({ silent: true });
    } catch (e) {
      await showAlert({ title: 'Unable to complete session', message: e.response?.data?.error || 'Failed to mark session as completed.', type: 'danger' });
    } finally {
      setUpdatingSessionId(null);
    }
  };

  const handleNoShowSession = async (sessionId) => {
    setUpdatingSessionId(sessionId);
    try {
      await axios.post(`/api/trainer/me/sessions/${sessionId}/no-show`, { note: '' });
      await refreshData({ silent: true });
    } catch (e) {
      await showAlert({ title: 'Unable to mark no-show', message: e.response?.data?.error || 'Failed to mark session as no-show.', type: 'danger' });
    } finally {
      setUpdatingSessionId(null);
    }
  };

  const handleClassBookingStatusUpdate = async (classId, bookingId, status) => {
    setUpdatingClassBookingId(bookingId);
    try {
      await axios.patch(`/api/trainer/me/classes/${classId}/attendees/${bookingId}`, { status });
      await refreshData({ silent: true });
    } catch (e) {
      await showAlert({ title: 'Unable to update attendee', message: e.response?.data?.error || 'Failed to update attendee status.', type: 'danger' });
    } finally {
      setUpdatingClassBookingId(null);
    }
  };

  const handleStartClass = async (cls) => {
    if (!cls?.sessionCanStart) {
      await showAlert({
        title: 'Cannot start class',
        message: cls?.sessionControlReason || 'Class can only be started near its scheduled time.',
        type: 'warning'
      });
      return;
    }

    setUpdatingClassLifecycleId(cls.id);
    try {
      await axios.post(`/api/trainer/me/classes/${cls.id}/start`, {
        sessionDate: cls.sessionDate || undefined
      });
      await refreshData({ silent: true });
    } catch (e) {
      await showAlert({ title: 'Unable to start class', message: e.response?.data?.error || 'Failed to start class session.', type: 'danger' });
    } finally {
      setUpdatingClassLifecycleId(null);
    }
  };

  const handleCompleteClass = async (cls) => {
    if (!cls?.sessionCanComplete) {
      await showAlert({
        title: 'Cannot complete class',
        message: cls?.sessionControlReason || 'Class must be started first, then completed on the session day.',
        type: 'warning'
      });
      return;
    }

    setUpdatingClassLifecycleId(cls.id);
    try {
      await axios.post(`/api/trainer/me/classes/${cls.id}/complete`, {
        sessionDate: cls.sessionDate || undefined
      });
      await refreshData({ silent: true });
    } catch (e) {
      await showAlert({ title: 'Unable to complete class', message: e.response?.data?.error || 'Failed to complete class.', type: 'danger' });
    } finally {
      setUpdatingClassLifecycleId(null);
    }
  };

  const getHistoryBadgeClasses = (status) => {
    if (status === 'UPCOMING') return 'bg-primary/15 text-primary border-primary/35';
    if (status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
    if (status === 'CANCELLED') return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
    return 'bg-white/10 text-text-muted border-white/20';
  };

  const renderBookingHistoryCard = (session) => {
    const memberName = `${session.member?.firstName || ''} ${session.member?.lastName || ''}`.trim() || `Member #${session.memberId}`;
    const status = session.__historyCategory;
    const rawStatus = String(session.status || 'SCHEDULED').replace(/_/g, ' ');
    const costAmount = Number(session.price || 0);
    const normalizedStatus = String(session.status || '').toUpperCase();
    const hasRating = session.memberRating !== null && session.memberRating !== undefined && Number(session.memberRating) > 0;
    const ratingNode = hasRating ? renderRatingStars(session.memberRating) : null;

    let ratingLabel = 'Rating: N/A';
    if (normalizedStatus === 'COMPLETED') {
      ratingLabel = hasRating ? 'Member Rating' : 'Rating: Pending';
    } else if (status === 'UPCOMING') {
      ratingLabel = 'Rating: Not yet';
    }

    return (
      <article key={`history-session-${session.id}`} className="rounded-2xl border border-white/10 bg-surface overflow-hidden transition-all hover:border-white/20 hover:shadow-md hover:shadow-black/20">
        <div className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white truncate">{memberName}</p>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getHistoryBadgeClasses(status)}`}>{getHistoryStatusLabel(status)}</span>
          </div>
        </div>
        <div className="h-px bg-white/10" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Date</p>
            <p className="text-xs text-white mt-0.5">{formatDate(session.date)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Time</p>
            <p className="text-xs text-white mt-0.5">{formatTime(session.date)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Duration</p>
            <p className="text-xs text-white mt-0.5">{Number(session.duration || 0)} min</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Status</p>
            <p className="text-xs text-white mt-0.5">{rawStatus}</p>
          </div>
        </div>
        <div className="h-px bg-white/10" />
        <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-text-muted">{ratingLabel}</p>
            {ratingNode}
          </div>
          <p className="text-sm font-semibold text-white">{formatMoney(costAmount)}</p>
        </div>
      </article>
    );
  };

  const renderClassHistoryCard = (entry) => {
    const status = entry.__historyCategory;
    const costAmount = Number(entry.commissionAmount || 0);

    return (
      <article key={`history-class-${entry.id}`} className="rounded-2xl border border-white/10 bg-surface overflow-hidden transition-all hover:border-white/20 hover:shadow-md hover:shadow-black/20">
        <div className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white truncate">{entry.class?.name || `Class #${entry.classId}`}</p>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getHistoryBadgeClasses(status)}`}>{getHistoryStatusLabel(status)}</span>
          </div>
        </div>
        <div className="h-px bg-white/10" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Date</p>
            <p className="text-xs text-white mt-0.5">{formatDate(entry.date)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Time</p>
            <p className="text-xs text-white mt-0.5">{formatTime(entry.date)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Duration</p>
            <p className="text-xs text-white mt-0.5">{Number(entry.class?.duration || 0)} min</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Attendees</p>
            <p className="text-xs text-white mt-0.5">{Number(entry.attendeeCount || 0)} / {Number(entry.class?.capacity || 0)}</p>
          </div>
        </div>
        <div className="h-px bg-white/10" />
        <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-text-muted">Rating: N/A</p>
          <p className="text-sm font-semibold text-white">{formatMoney(costAmount)}</p>
        </div>
      </article>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Classes & Sessions</h1>
          <p className="text-text-muted mt-1">Calendar controls for today plus full booking/class history</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setActiveView('calendar')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'calendar' ? 'bg-primary text-black shadow-lg shadow-primary/30' : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10'}`}>Calendar</button>
          <button type="button" onClick={() => setActiveView('history')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeView === 'history' ? 'bg-primary text-black shadow-lg shadow-primary/30' : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10'}`}>History</button>
        </div>
      </header>

      {activeView === 'calendar' ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between bg-surface rounded-2xl border border-white/5 p-4">
              <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10">Prev</button>
              <p className="text-white font-semibold">{monthYearLabel}</p>
              <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="px-3 py-2 rounded-lg bg-white/5 text-white text-xs font-bold hover:bg-white/10">Next</button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-text-muted">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary"></span><span>1-on-1 Session</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span><span>Class</span></div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-xs text-text-muted font-bold uppercase tracking-wider px-1">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="text-center">{d}</div>)}</div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: rows * 7 }).map((_, idx) => {
                const day = new Date(firstCellDate);
                day.setDate(firstCellDate.getDate() + idx);
                const dayKey = day.toDateString();
                const dayEvents = eventsByDay[dayKey] || [];
                const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                const isToday = new Date().toDateString() === dayKey;
                const isSelected = selectedDay === dayKey;
                const sessionCount = dayEvents.filter((e) => e.type === 'SESSION').length;
                const classCount = dayEvents.filter((e) => e.type === 'CLASS').length;
                return (
                  <button key={`${dayKey}-${idx}`} type="button" onClick={() => setSelectedDay(dayKey)} className={`min-h-[62px] sm:min-h-[72px] rounded-lg border p-1.5 sm:p-2 flex flex-col text-left transition-colors ${isCurrentMonth ? 'bg-surface border-white/5' : 'bg-white/5 border-white/5 opacity-50'} ${isToday ? 'ring-1 ring-primary/30' : ''} ${isSelected ? 'border-primary/30 bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between text-[10px] font-bold text-text-muted"><span>{day.getDate()}</span>{dayEvents.length > 0 && <span className="px-1 py-0.5 rounded-full bg-white/10 text-[9px] text-white/80">{dayEvents.length}</span>}</div>
                    <div className="mt-auto flex items-center gap-1.5">{sessionCount > 0 && <span className="w-2 h-2 rounded-full bg-primary"></span>}{classCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-surface p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-text-muted uppercase tracking-wide">Action Panel</p><h2 className="text-sm sm:text-base font-bold text-white">{formatSelectedDay(selectedDay)}</h2></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-center"><p className="text-[10px] uppercase tracking-wide text-primary font-bold">Bookings</p><p className="text-sm text-white font-semibold">{selectedSessions.length}</p></div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center"><p className="text-[10px] uppercase tracking-wide text-emerald-300 font-bold">Classes</p><p className="text-sm text-white font-semibold">{selectedClasses.length}</p></div>
                </div>
              </div>
            </div>

            {!(selectedSessions.length > 0 || selectedClasses.length > 0) ? (
              <div className="rounded-2xl border border-white/10 bg-surface p-4"><p className="text-sm text-text-muted">No bookings or classes on this date.</p></div>
            ) : (
              <>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Bookings (1-on-1)</h3><span className="text-xs text-text-muted">{selectedSessions.length}</span></div>
                  {selectedSessions.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSessions.map((s) => {
                        const canTakeAction = canTakeSessionAttendanceAction(s.status);
                        return (
                          <div key={s.id} className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                            <p className="text-sm font-semibold text-primary">{formatTime(s.date)}</p>
                            <p className="text-sm text-white mt-1">{`${s.member?.firstName || ''} ${s.member?.lastName || ''}`.trim() || `Member #${s.memberId}`}</p>
                            <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wide">{Number(s.duration || 0)} min - {s.status || 'SCHEDULED'}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <button type="button" onClick={() => handleCompleteSession(s.id)} disabled={!canTakeAction || updatingSessionId === s.id} className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50">Complete</button>
                              <button type="button" onClick={() => handleNoShowSession(s.id)} disabled={!canTakeAction || updatingSessionId === s.id} className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50">No Show</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-text-muted">No 1-on-1 sessions.</p>}
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Classes</h3><span className="text-xs text-text-muted">{selectedClasses.length}</span></div>
                  {selectedClasses.length > 0 ? (
                    <div className="space-y-3">
                      {selectedClasses.map((cls) => {
                        const classBookings = Array.isArray(cls.bookings) ? cls.bookings : [];
                        const sessionStatus = String(cls.sessionStatus || 'SCHEDULED').toUpperCase();
                        const lifecycleBusy = updatingClassLifecycleId === cls.id;
                        return (
                          <div key={cls.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-emerald-300">{formatTime(cls.sessionDate)}</p>
                                <p className="text-sm text-white mt-1">{cls.name}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getClassSessionStatusClasses(sessionStatus)}`}>
                                {getClassSessionStatusLabel(sessionStatus)}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-1">{Number(cls.enrolled || 0)} / {Number(cls.capacity || 0)} enrolled</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartClass(cls)}
                                disabled={sessionStatus !== 'SCHEDULED' || !cls.sessionCanStart || lifecycleBusy}
                                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border border-sky-500/30 text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-40"
                              >
                                Start Class
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCompleteClass(cls)}
                                disabled={sessionStatus === 'COMPLETED' || !cls.sessionCanComplete || lifecycleBusy}
                                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40"
                              >
                                Complete Class
                              </button>
                            </div>
                            {cls.sessionControlReason && sessionStatus !== 'COMPLETED' && (
                              <p className="mt-2 text-[10px] text-text-muted">{cls.sessionControlReason}</p>
                            )}
                            <div className="mt-3 border-t border-white/10 pt-2 space-y-2">
                              <p className="text-[11px] text-text-muted uppercase tracking-wide">Participants ({classBookings.length})</p>
                              {classBookings.length > 0 ? (
                                <div className="space-y-2">
                                  {classBookings.map((b) => (
                                    <div key={b.id} className="rounded-lg border border-white/10 bg-black/15 p-2">
                                      <p className="text-xs text-white font-semibold">{b.member?.firstName || ''} {b.member?.lastName || ''}</p>
                                      <p className="text-[10px] text-text-muted mt-0.5">Member #{b.memberId} - {b.status}</p>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <button type="button" onClick={() => handleClassBookingStatusUpdate(cls.id, b.id, 'ATTENDED')} disabled={updatingClassBookingId === b.id} className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50">Attended</button>
                                        <button type="button" onClick={() => handleClassBookingStatusUpdate(cls.id, b.id, 'NO_SHOW')} disabled={updatingClassBookingId === b.id} className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50">No Show</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-[11px] text-text-muted">No participants yet.</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-text-muted">No classes.</p>}
                </div>
              </>
            )}
          </section>
        </>
      ) : (
        <section className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-surface p-3 sm:p-4 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-white">History</h2>
              <p className="text-xs text-text-muted mt-1">
                Showing {displayedHistoryItems.length} of {visibleHistoryItems.length} records ({activeFilterCount} active filters).
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-text-muted">Total</p>
                <p className="text-base font-bold text-white mt-0.5">{historySummary.total}</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-primary">Upcoming</p>
                <p className="text-base font-bold text-white mt-0.5">{historySummary.upcoming}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-emerald-300">Spent</p>
                <p className="text-sm font-bold text-white mt-0.5">{formatMoney(historySummary.spent)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {HISTORY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHistoryViewScope(tab)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${activeHistoryTab === tab ? 'border-primary/40 bg-primary/15 text-white' : 'border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10'}`}
                >
                  {tab === 'BOOKINGS' ? '1-on-1' : 'Classes'} ({historyTabCounts[tab]})
                </button>
              ))}
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {HISTORY_STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setHistoryStatusFilter(status)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${historyStatusFilter === status ? 'bg-white text-background border-white' : 'bg-white/5 border-white/10 text-text-muted hover:text-white hover:bg-white/10'}`}
                >
                  {status === 'ALL' ? 'All' : getHistoryStatusLabel(status)} - {statusChipCounts[status]}
                </button>
              ))}
            </div>
          </div>

          {!displayedHistoryItems.length ? (
            <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
              <p className="text-base font-semibold text-white">No records found</p>
              <p className="mt-1 text-sm text-text-muted">Try a different status filter.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedHistoryItems.map((entry) => (activeHistoryTab === 'CLASSES' ? renderClassHistoryCard(entry) : renderBookingHistoryCard(entry)))}
            </div>
          )}

          {hiddenHistoryCount > 0 && (
            <p className="text-xs text-text-muted px-1">
              Showing latest {displayedHistoryItems.length}. {hiddenHistoryCount} more records are hidden to keep this view clean.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
