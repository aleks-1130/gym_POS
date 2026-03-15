import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';

const FINALIZED_SESSION_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'DECLINED'];
const HISTORY_STATUS_FILTERS = ['ALL', 'UPCOMING', 'COMPLETED', 'CANCELLED'];
const HISTORY_TABS = ['BOOKINGS', 'CLASSES'];

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
  const [historySearch, setHistorySearch] = useState('');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [selectedHistoryParticipantsEntry, setSelectedHistoryParticipantsEntry] = useState(null);

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

  const searchedHistoryItems = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return activeTabBaseHistory;

    return activeTabBaseHistory.filter((entry) => {
      if (activeHistoryTab === 'CLASSES') {
        const searchable = [
          entry.class?.name,
          entry.classId,
          formatDate(entry.date),
          formatTime(entry.date),
          entry.status,
          getHistoryStatusLabel(entry.__historyCategory),
          Number(entry.attendeeCount || 0),
          Number(entry.class?.capacity || 0),
          Number(entry.class?.duration || 0),
          formatMoney(entry.commissionAmount)
        ].join(' ').toLowerCase();
        return searchable.includes(query);
      }

      const memberName = `${entry.member?.firstName || ''} ${entry.member?.lastName || ''}`.trim();
      const searchable = [
        memberName,
        entry.memberId,
        formatDate(entry.date),
        formatTime(entry.date),
        entry.status,
        getHistoryStatusLabel(entry.__historyCategory),
        Number(entry.duration || 0),
        formatMoney(entry.price)
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [activeHistoryTab, activeTabBaseHistory, historySearch]);

  const visibleHistoryItems = useMemo(() => {
    if (historyStatusFilter === 'ALL') return searchedHistoryItems;
    return searchedHistoryItems.filter((entry) => entry.__historyCategory === historyStatusFilter);
  }, [searchedHistoryItems, historyStatusFilter]);

  const historyTabCounts = useMemo(() => ({
    BOOKINGS: filteredBookingHistoryWithCategory.length,
    CLASSES: filteredClassHistoryWithCategory.length
  }), [filteredBookingHistoryWithCategory.length, filteredClassHistoryWithCategory.length]);

  const historySummary = useMemo(() => {
    const total = activeTabBaseHistory.length;
    const upcoming = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'UPCOMING').length;
    const commission = activeHistoryTab === 'BOOKINGS'
      ? activeTabBaseHistory.reduce((sum, entry) => sum + Number(entry.commissionAmount ?? entry.price ?? 0), 0)
      : activeTabBaseHistory.reduce((sum, entry) => sum + Number(entry.commissionAmount || 0), 0);
    const completed = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'COMPLETED').length;
    const cancelled = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'CANCELLED').length;
    return { total, upcoming, completed, cancelled, commission };
  }, [activeHistoryTab, activeTabBaseHistory]);

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

  const getParticipantStatusBadgeClasses = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'ATTENDED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
    if (normalized === 'NO_SHOW') return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
    if (normalized === 'CANCELLED') return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
    return 'bg-white/10 text-text-muted border-white/20';
  };

  const renderBookingHistoryCard = (session) => {
    const memberName = `${session.member?.firstName || ''} ${session.member?.lastName || ''}`.trim() || `Member #${session.memberId}`;
    const status = session.__historyCategory;
    const rawStatus = String(session.status || 'SCHEDULED').replace(/_/g, ' ');
    const commissionAmount = Number(session.commissionAmount ?? session.price ?? 0);
    const normalizedStatus = String(session.status || '').toUpperCase();
    const hasRating = session.memberRating !== null && session.memberRating !== undefined && Number(session.memberRating) > 0;
    const ratingNode = hasRating ? renderRatingStars(session.memberRating) : null;

    let ratingLabel = 'No rating recorded';
    if (normalizedStatus === 'COMPLETED') {
      ratingLabel = hasRating ? `Member rated ${Number(session.memberRating).toFixed(1)}/5` : 'Rating pending';
    } else if (status === 'UPCOMING') {
      ratingLabel = 'Rating unavailable until completed';
    }

    return (
      <article key={`history-session-${session.id}`} className="rounded-xl border border-white/10 bg-white/5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">{memberName}</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {formatDate(session.date)} at {formatTime(session.date)}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getHistoryBadgeClasses(status)}`}>
            {getHistoryStatusLabel(status)}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="material-icons-round text-sm">schedule</span>
            {Number(session.duration || 0)} min
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-icons-round text-sm">payments</span>
            {formatMoney(commissionAmount)}
          </span>
          <span className="inline-flex items-center gap-1 col-span-2">
            <span className="material-icons-round text-sm">event</span>
            {rawStatus || 'N/A'}
          </span>
          <span className="inline-flex items-center gap-1 col-span-2">
            <span className="material-icons-round text-sm">star</span>
            {ratingLabel}
          </span>
          {ratingNode && (
            <div className="col-span-2">
              {ratingNode}
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderClassHistoryCard = (entry) => {
    const status = entry.__historyCategory;
    const rawStatus = String(entry.status || '').replace(/_/g, ' ');
    const commissionAmount = Number(entry.commissionAmount || 0);

    return (
      <article key={`history-class-${entry.id}`} className="rounded-xl border border-white/10 bg-white/5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">{entry.class?.name || `Class #${entry.classId}`}</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {formatDate(entry.date)} at {formatTime(entry.date)}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getHistoryBadgeClasses(status)}`}>
            {getHistoryStatusLabel(status)}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="material-icons-round text-sm">schedule</span>
            {Number(entry.class?.duration || 0)} min
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-icons-round text-sm">groups</span>
            {Number(entry.attendeeCount || 0)} / {Number(entry.class?.capacity || 0)}
          </span>
          <span className="inline-flex items-center gap-1 col-span-2">
            <span className="material-icons-round text-sm">payments</span>
            {formatMoney(commissionAmount)}
          </span>
          <span className="inline-flex items-center gap-1 col-span-2">
            <span className="material-icons-round text-sm">event</span>
            {rawStatus || 'N/A'}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setSelectedHistoryParticipantsEntry(entry)}
            className="w-full py-2 rounded-lg bg-primary/10 text-primary border border-primary/25 font-semibold text-xs hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-icons-round text-sm">groups</span>
            View Participants ({Number(entry.participantsCount ?? entry.attendeeCount ?? 0)})
          </button>
        </div>
      </article>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Classes & Sessions</h1>
          <p className="text-text-muted mt-1">
            {activeView === 'history'
              ? 'Review your 1-on-1 and class history with commission details'
              : 'Calendar controls for today plus class/session action panels'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl p-1 bg-surface/80 border border-white/10 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeView === 'calendar'
              ? 'bg-primary text-background shadow-md'
              : 'text-text-muted hover:text-white hover:bg-white/5'
              }`}
          >
            <span className="material-icons-round text-base">calendar_month</span>
            <span>Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeView === 'history'
              ? 'bg-primary text-background shadow-md'
              : 'text-text-muted hover:text-white hover:bg-white/5'
              }`}
          >
            <span className="material-icons-round text-base">history</span>
            <span>History</span>
          </button>
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

            <div className="flex items-center justify-center gap-4 text-[11px] text-text-muted">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary"></span><span>1-on-1 Session</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span><span>Class</span></div>
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
        <section className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Completed</p>
              <p className="text-base font-bold text-emerald-300 mt-1">{historySummary.completed}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Upcoming</p>
              <p className="text-base font-bold text-primary mt-1">{historySummary.upcoming}</p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Commission</p>
              <p className="text-sm font-bold text-amber-300 mt-1">{formatMoney(historySummary.commission)}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-surface p-3">
            <div className="grid grid-cols-2 gap-2">
              {HISTORY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHistoryViewScope(tab)}
                  className={`h-9 px-2 rounded-lg text-[11px] font-semibold border transition-all ${activeHistoryTab === tab
                    ? 'bg-white text-black border-white shadow-sm'
                    : 'bg-surface border-white/10 text-text-muted hover:text-white'
                    }`}
                >
                  {tab === 'BOOKINGS' ? '1-on-1' : 'Classes'} ({historyTabCounts[tab]})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="relative flex-1">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 material-icons-round text-sm text-text-muted">search</span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder={activeHistoryTab === 'CLASSES' ? 'Search class, status, date...' : 'Search member, status, date...'}
                  className="h-8 w-full rounded-lg border border-white/10 bg-background/40 pl-8 pr-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowHistoryFilters((prev) => !prev)}
                className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${showHistoryFilters || historyStatusFilter !== 'ALL'
                  ? 'bg-white text-black border-white'
                  : 'bg-surface border-white/10 text-text-muted hover:text-white'
                  }`}
              >
                <span className="material-icons-round text-sm">tune</span>
                Filters
              </button>
            </div>
            <p className="text-[11px] text-text-muted">
              {historyStatusFilter === 'ALL'
                ? 'Showing all history statuses.'
                : `Filter: ${historyStatusFilter === 'COMPLETED' ? 'Done' : getHistoryStatusLabel(historyStatusFilter)}`}
            </p>

            {showHistoryFilters && (
              <div className="grid grid-cols-4 gap-2">
                {HISTORY_STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setHistoryStatusFilter(status);
                      setShowHistoryFilters(false);
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-semibold border transition-all ${historyStatusFilter === status
                      ? 'bg-white text-black border-white shadow-sm'
                      : 'bg-surface border-white/10 text-text-muted hover:text-white'
                      }`}
                  >
                    {(status === 'ALL' ? 'All' : status === 'COMPLETED' ? 'Done' : getHistoryStatusLabel(status))}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-white font-bold text-base">Classes & Sessions History</h2>
                <p className="text-text-muted text-xs mt-0.5">Review your 1-on-1 and class records with commission details</p>
              </div>
              <button
                type="button"
                onClick={() => refreshData()}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-text-muted hover:text-white"
              >
                Refresh
              </button>
            </div>

            {!visibleHistoryItems.length ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-muted">No records found for this filter.</div>
            ) : (
              <div className="space-y-2.5">
                {visibleHistoryItems.map((entry) => (activeHistoryTab === 'CLASSES' ? renderClassHistoryCard(entry) : renderBookingHistoryCard(entry)))}
              </div>
            )}
          </div>
        </section>
      )}

      {selectedHistoryParticipantsEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <button
            type="button"
            onClick={() => setSelectedHistoryParticipantsEntry(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close participants modal"
          />
          <div className="relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Class Participants</h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {selectedHistoryParticipantsEntry.class?.name || `Class #${selectedHistoryParticipantsEntry.classId}`} - {formatDate(selectedHistoryParticipantsEntry.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryParticipantsEntry(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"
                aria-label="Close participants modal"
              >
                <span className="material-icons-round text-base">close</span>
              </button>
            </div>

            <div className="p-4 max-h-[65vh] overflow-y-auto space-y-2.5">
              {(Array.isArray(selectedHistoryParticipantsEntry.participants) && selectedHistoryParticipantsEntry.participants.length > 0) ? (
                selectedHistoryParticipantsEntry.participants.map((participant) => {
                  const fullName = `${participant.member?.firstName || ''} ${participant.member?.lastName || ''}`.trim() || `Member #${participant.memberId}`;
                  const rawStatus = String(participant.status || 'N/A').replace(/_/g, ' ');
                  return (
                    <article key={`history-participant-${participant.id}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{fullName}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">Member #{participant.memberId}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getParticipantStatusBadgeClasses(participant.status)}`}>
                          {rawStatus}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-muted">
                  No participants found for this class session.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
