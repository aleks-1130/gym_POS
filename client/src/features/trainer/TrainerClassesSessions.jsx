import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';
import TrainerPageHeader from './components/TrainerPageHeader';

const HISTORY_STATUS_FILTERS = ['ALL', 'COMPLETED', 'REFUNDED', 'CANCELLED'];
const HISTORY_TABS = ['BOOKINGS', 'CLASSES'];
const SESSION_ACTION_GRACE_MINUTES = 5;

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

const startOfDay = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

const canMarkSessionAttendanceNow = (session, now = new Date()) => {
  const start = new Date(session?.date);
  if (Number.isNaN(start.getTime())) return false;
  const durationMinutes = Math.max(0, Number(session?.duration) || 0);
  const eligibleAt = new Date(start.getTime() + ((durationMinutes + SESSION_ACTION_GRACE_MINUTES) * 60 * 1000));
  return now >= eligibleAt;
};

const getSessionRefundStatus = (session) => {
  const payloadStatus = String(session?.refundException?.status || '').toUpperCase();
  if (payloadStatus === 'APPROVED' || payloadStatus === 'REJECTED' || payloadStatus === 'PENDING') {
    return payloadStatus;
  }

  const lines = String(session?.notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let hasRequest = false;
  let latestResolution = '';
  lines.forEach((line) => {
    if (line.startsWith('REFUND_EXCEPTION_REQUESTED')) hasRequest = true;
    if (line.startsWith('REFUND_EXCEPTION_APPROVED')) latestResolution = 'APPROVED';
    if (line.startsWith('REFUND_EXCEPTION_REJECTED')) latestResolution = 'REJECTED';
  });

  if (!hasRequest && !latestResolution) return 'NONE';
  if (latestResolution) return latestResolution;
  return 'PENDING';
};

const isSessionRefunded = (session) => getSessionRefundStatus(session) === 'APPROVED';

const getSessionHistoryCategory = (session) => {
  if (isSessionRefunded(session)) return 'REFUNDED';
  const status = String(session?.status || '').toUpperCase();
  if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'DECLINED') return 'CANCELLED';
  return 'COMPLETED';
};

const getClassHistoryCategory = (entry) => {
  const status = String(entry?.status || '').toUpperCase();
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'COMPLETED';
};

const getHistoryStatusLabel = (status) => {
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'REFUNDED') return 'Refunded';
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
  const [accessLogs, setAccessLogs] = useState([]);
  const [trainerProfile, setTrainerProfile] = useState(null);
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
  const [registrationDayModal, setRegistrationDayModal] = useState(null);
  const calendarWindowStart = useMemo(() => {
    const windowStart = startOfDay(new Date());
    windowStart.setDate(windowStart.getDate() - 1);
    return windowStart;
  }, []);

  const refreshData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const trainerProfilePromise = axios.get('/api/trainer/me')
        .catch(async (primaryError) => {
          const status = Number(primaryError?.response?.status || 0);
          if (status === 404 || status === 405) {
            const fallback = await axios.get('/api/trainers/me');
            return fallback;
          }
          return { data: null };
        });

      const [sessionsRes, classesRes, classHistoryRes, accessLogsRes, trainerProfileRes] = await Promise.all([
        axios.get('/api/trainer/me/sessions'),
        axios.get('/api/trainer/me/classes'),
        axios.get('/api/trainer/me/classes/history'),
        axios.get('/api/access/logs'),
        trainerProfilePromise
      ]);
      setSessions(sessionsRes.data || []);
      setClasses(classesRes.data || []);
      setClassHistory(classHistoryRes.data || []);
      setAccessLogs(Array.isArray(accessLogsRes.data) ? accessLogsRes.data : []);
      setTrainerProfile(trainerProfileRes?.data || null);
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
        return d >= calendarWindowStart;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [sessions, calendarWindowStart]);

  const classEvents = useMemo(() => {
    return [...classes]
      .filter((c) => {
        const d = new Date(c.sessionDate);
        return !Number.isNaN(d.getTime()) && d >= calendarWindowStart;
      })
      .sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));
  }, [classes, calendarWindowStart]);

  const trainerCheckInInfoByDate = useMemo(() => {
    const map = new Map();
    accessLogs.forEach((log) => {
      if (String(log?.status || '').toUpperCase() !== 'ALLOWED') return;
      const parsed = new Date(log?.checkIn);
      if (Number.isNaN(parsed.getTime())) return;
      const key = toDateKey(parsed);
      if (!key) return;
      if (!map.has(key) || parsed < map.get(key)) {
        map.set(key, parsed);
      }
    });
    return map;
  }, [accessLogs]);

  const trainerAttendedByDate = useMemo(() => new Set(trainerCheckInInfoByDate.keys()), [trainerCheckInInfoByDate]);

  const trainerStartDate = useMemo(() => {
    const profileStart = trainerProfile?.createdAt ? new Date(trainerProfile.createdAt) : null;
    if (profileStart && !Number.isNaN(profileStart.getTime())) return startOfDay(profileStart);
    return startOfDay(new Date());
  }, [trainerProfile]);
  const hasTrainerRegistrationDate = useMemo(() => {
    const profileStart = trainerProfile?.createdAt ? new Date(trainerProfile.createdAt) : null;
    return Boolean(profileStart && !Number.isNaN(profileStart.getTime()));
  }, [trainerProfile]);

  const upcomingBookingCount = useMemo(() => {
    const now = new Date();
    return sessions.filter((entry) => {
      const status = String(entry?.status || '').toUpperCase();
      const date = new Date(entry?.date);
      return !Number.isNaN(date.getTime()) && date >= now && (status === 'SCHEDULED' || status === 'RESCHEDULED');
    }).length;
  }, [sessions]);

  const upcomingClassCount = useMemo(() => {
    const now = new Date();
    return classes.filter((entry) => {
      const date = new Date(entry?.sessionDate);
      const status = String(entry?.sessionStatus || entry?.status || '').toUpperCase();
      return !Number.isNaN(date.getTime()) && date >= now && status !== 'COMPLETED';
    }).length;
  }, [classes]);

  const trainerCheckInStats = useMemo(() => {
    const today = startOfDay(new Date());
    if (trainerStartDate > today) {
      return { checkIns: 0, missed: 0 };
    }

    let checkIns = 0;
    let missed = 0;
    const cursor = new Date(trainerStartDate);
    while (cursor <= today) {
      const key = toDateKey(cursor);
      if (trainerAttendedByDate.has(key)) checkIns += 1;
      else missed += 1;
      cursor.setDate(cursor.getDate() + 1);
    }

    return { checkIns, missed };
  }, [trainerAttendedByDate, trainerStartDate]);
  const trainerStartDayKey = useMemo(() => toDateKey(trainerStartDate), [trainerStartDate]);

  const eventsByDay = useMemo(() => {
    const map = {};
    const ensureDayBucket = (key) => {
      if (!map[key]) {
        map[key] = {
          total: 0,
          sessionCount: 0,
          classCount: 0
        };
      }
      return map[key];
    };

    calendarSessions.forEach((s) => {
      const key = toDateKey(s.date);
      if (!key) return;
      const bucket = ensureDayBucket(key);
      bucket.total += 1;
      bucket.sessionCount += 1;
    });
    classEvents.forEach((c) => {
      const key = toDateKey(c.sessionDate);
      if (!key) return;
      const bucket = ensureDayBucket(key);
      bucket.total += 1;
      bucket.classCount += 1;
    });
    return map;
  }, [calendarSessions, classEvents]);

  const nextUpTask = useMemo(() => {
    const now = new Date();
    const allUpcoming = [
      ...calendarSessions.map(s => ({ ...s, __type: 'SESSION', __time: new Date(s.date) })),
      ...classEvents.map(c => ({ ...c, __type: 'CLASS', __time: new Date(c.sessionDate) }))
    ].filter(t => t.__time > now)
     .sort((a, b) => a.__time - b.__time);
    
    return allUpcoming.length > 0 ? allUpcoming[0] : null;
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
    const now = new Date();
    return [...sessions]
      .filter((s) => {
        const d = new Date(s.date);
        if (Number.isNaN(d.getTime())) return false;
        return d < now;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sessions]);

  const classHistoryEntries = useMemo(() => {
    const now = new Date();
    return [...classHistory]
      .filter((entry) => {
        const d = new Date(entry.date);
        return !Number.isNaN(d.getTime()) && d < now;
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
      const refundStatus = getSessionRefundStatus(entry);
      const searchable = [
        memberName,
        entry.memberId,
        formatDate(entry.date),
        formatTime(entry.date),
        entry.status,
        refundStatus === 'APPROVED' ? 'REFUNDED' : '',
        refundStatus,
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
    if (activeHistoryTab === 'CLASSES') {
      const completedClassEntries = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'COMPLETED');
      const completedClasses = completedClassEntries.length;
      const totalAttendance = completedClassEntries.reduce((sum, entry) => sum + Number(entry.attendeeCount || 0), 0);
      const averageAttendance = completedClasses > 0 ? (totalAttendance / completedClasses) : 0;
      const noShowCount = activeTabBaseHistory.reduce((sum, entry) => {
        const participants = Array.isArray(entry?.participants) ? entry.participants : [];
        if (participants.length > 0) {
          return sum + participants.filter((participant) => String(participant?.status || '').toUpperCase().startsWith('NO_SHOW')).length;
        }
        const fallbackParticipants = Number(entry?.participantsCount || 0);
        const attended = Number(entry?.attendeeCount || 0);
        return sum + Math.max(0, fallbackParticipants - attended);
      }, 0);
      return {
        completedClasses,
        averageAttendance,
        noShowCount
      };
    }

    const completed = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'COMPLETED').length;
    const refunded = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'REFUNDED').length;
    const cancelled = activeTabBaseHistory.filter((entry) => entry.__historyCategory === 'CANCELLED').length;
    return { completed, refunded, cancelled };
  }, [activeHistoryTab, activeTabBaseHistory]);

  const monthYearLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const calendarCells = useMemo(() => {
    const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const leading = start.getDay();
    const cells = [];
    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let day = 1; day <= end.getDate(); day += 1) {
      cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor]);
  const todayStart = startOfDay(new Date());
  const todayKey = todayStart.toDateString();

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

  const handleCompleteClass = async (cls) => {
    if (!cls?.sessionCanComplete) {
      await showAlert({
        title: 'Cannot complete class',
        message: cls?.sessionControlReason || 'Class can be completed only after class end (+5 min grace) on the same day.',
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
    if (status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
    if (status === 'REFUNDED') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35';
    if (status === 'CANCELLED') return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
    return 'bg-white/10 text-text-muted border-white/20';
  };

  const getParticipantStatusBadgeClasses = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'ATTENDED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
    if (normalized.startsWith('NO_SHOW')) return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
    if (normalized === 'CANCELLED') return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
    return 'bg-white/10 text-text-muted border-white/20';
  };

  const renderBookingHistoryCard = (session) => {
    const memberName = `${session.member?.firstName || ''} ${session.member?.lastName || ''}`.trim() || `Member #${session.memberId}`;
    const status = session.__historyCategory;
    const rawStatus = String(session.status || 'SCHEDULED').replace(/_/g, ' ');
    const commissionAmount = Number(session.commissionAmount ?? session.price ?? 0);
    const refunded = isSessionRefunded(session);
    const normalizedStatus = String(session.status || '').toUpperCase();
    const hasRating = session.memberRating !== null && session.memberRating !== undefined && Number(session.memberRating) > 0;
    const ratingNode = hasRating ? renderRatingStars(session.memberRating) : null;

    let ratingLabel = 'No rating';
    if (refunded) {
      ratingLabel = 'Refund approved';
    } else if (normalizedStatus === 'COMPLETED') {
      ratingLabel = hasRating ? `Rated ${Number(session.memberRating).toFixed(1)}/5` : 'Rating pending';
    }

    return (
      <article key={`history-session-${session.id}`} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 transition-all hover:bg-white/10 shadow-lg group">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">{memberName}</p>
            <p className="text-[10px] text-text-muted mt-0.5 font-medium uppercase tracking-wider">
              {formatDate(session.date)} • {formatTime(session.date)}
            </p>
          </div>
          <span className={`rounded-xl border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${getHistoryBadgeClasses(status)}`}>
            {getHistoryStatusLabel(status)}
          </span>
        </div>
        
        {refunded && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-300">
            <span className="material-icons-round text-[10px]">refresh</span>
            Refunded
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
              <span className="material-icons-round text-sm text-text-muted">schedule</span>
            </div>
            <p className="text-[10px] font-bold text-white/70">{Number(session.duration || 0)} min</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
              <span className="material-icons-round text-sm text-text-muted">payments</span>
            </div>
            <p className="text-[10px] font-bold text-primary">{formatMoney(commissionAmount)}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
              <span className="material-icons-round text-[12px] text-text-muted">star</span>
            </div>
            <p className="text-[10px] font-bold text-text-muted/80">{ratingLabel}</p>
          </div>
          {ratingNode}
        </div>
      </article>
    );
  };

  const renderClassHistoryCard = (entry) => {
    const status = entry.__historyCategory;
    const rawStatus = String(entry.status || '').replace(/_/g, ' ');
    const commissionAmount = Number(entry.commissionAmount || 0);

    return (
      <article key={`history-class-${entry.id}`} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 transition-all hover:bg-white/10 shadow-lg group">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors truncate">{entry.class?.name || `Class #${entry.classId}`}</p>
            <p className="text-[10px] text-text-muted mt-0.5 font-medium uppercase tracking-wider">
              {formatDate(entry.date)} • {formatTime(entry.date)}
            </p>
          </div>
          <span className={`rounded-xl border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${getHistoryBadgeClasses(status)}`}>
            {getHistoryStatusLabel(status)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
              <span className="material-icons-round text-sm text-text-muted">groups</span>
            </div>
            <p className="text-[10px] font-bold text-white/70">{Number(entry.attendeeCount || 0)}/{Number(entry.class?.capacity || 0)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
              <span className="material-icons-round text-sm text-text-muted">payments</span>
            </div>
            <p className="text-[10px] font-bold text-cyan-300">{formatMoney(commissionAmount)}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={() => setSelectedHistoryParticipantsEntry(entry)}
            className="w-full py-2 rounded-xl bg-white/5 text-white border border-white/10 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-icons-round text-base">groups</span>
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <TrainerPageHeader
        title="Your Training Schedule"
        subtitle={activeView === 'history'
          ? 'Review your past training sessions and earnings'
          : 'Plan and manage your upcoming 1-on-1 and class sessions'}
        icon="calendar_month"
        className="px-4"
      />
      <section className="px-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl p-1 bg-white/5 backdrop-blur-md border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={`py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeView === 'calendar'
              ? 'bg-primary text-background shadow-lg scale-[1.02]'
              : 'text-text-muted hover:text-white hover:bg-white/5'
              }`}
          >
            <span className="material-icons-round text-base">auto_awesome_motion</span>
            <span>My Schedule</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${activeView === 'history'
              ? 'bg-primary text-background shadow-lg scale-[1.02]'
              : 'text-text-muted hover:text-white hover:bg-white/5'
              }`}
          >
            <span className="material-icons-round text-base">history_edu</span>
            <span>Past Records</span>
          </button>
        </div>
      </section>

      {activeView === 'calendar' ? (
        <>
          {nextUpTask && (
            <section className="px-4 mb-2">
              <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent backdrop-blur-xl p-5 shadow-[0_0_30px_rgba(99,102,241,0.1)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                       <span className="text-[10px] uppercase font-black tracking-widest text-primary">Next Up</span>
                    </div>
                    
                    <h2 className="text-xl font-black text-white leading-tight">
                      {nextUpTask.__type === 'SESSION' ? `${nextUpTask.member?.firstName || ''} ${nextUpTask.member?.lastName || ''}`.trim() || `Member #${nextUpTask.memberId}` : nextUpTask.name}
                    </h2>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <div className="flex items-center gap-1.5 text-white/70 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                        <span className="material-icons-round text-[12px]">schedule</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{formatTime(nextUpTask.__time)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/70 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                        <span className="material-icons-round text-[12px]">{nextUpTask.__type === 'SESSION' ? 'person' : 'groups'}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{nextUpTask.__type === 'SESSION' ? '1-on-1 Session' : 'Group Class'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-white shadow-lg">
                    <span className="material-icons-round text-xl">{nextUpTask.__type === 'SESSION' ? 'fitness_center' : 'self_improvement'}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="px-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-center transition-all hover:bg-white/10 shadow-lg">
              <p className="text-[10px] uppercase tracking-widest text-primary font-black">Next Sessions</p>
              <p className="text-[9px] text-text-muted mt-0.5 font-medium">1-on-1 Sessions</p>
              <p className="text-2xl font-black text-white mt-1.5 leading-none">{upcomingBookingCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-center transition-all hover:bg-white/10 shadow-lg">
              <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-black">Next Classes</p>
              <p className="text-[9px] text-text-muted mt-0.5 font-medium">Assigned Classes</p>
              <p className="text-2xl font-black text-white mt-1.5 leading-none">{upcomingClassCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-center transition-all hover:bg-white/10 shadow-lg">
              <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">Active Days</p>
              <p className="text-[9px] text-text-muted mt-0.5 font-medium">Logged Check-ins</p>
              <p className="text-2xl font-black text-white mt-1.5 leading-none">{trainerCheckInStats.checkIns}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-center transition-all hover:bg-white/10 shadow-lg">
              <p className="text-[10px] uppercase tracking-widest text-rose-400 font-black">Missed Logs</p>
              <p className="text-[9px] text-text-muted mt-0.5 font-medium">Missed Check-ins</p>
              <p className="text-2xl font-black text-white mt-1.5 leading-none">{trainerCheckInStats.missed}</p>
            </div>
          </section>

          <section className="px-4 space-y-4">
            <div className="member-card-subtle bg-[#233248]/85 backdrop-blur-md p-4 sm:p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 border border-white/5"
                >
                  <span className="material-icons-round">chevron_left</span>
                </button>
                <div className="text-center">
                  <p className="text-base sm:text-lg font-black text-white px-3">{monthYearLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95 border border-white/5"
                >
                  <span className="material-icons-round">chevron_right</span>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 mb-3 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <div key={`${day}-${index}`} className="text-xs font-black text-white/40 uppercase tracking-widest">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((day, index) => {
                  if (!day) return <div key={`blank-${index}`} className="aspect-square" />;

                  const dayKey = day.toDateString();
                  const dayEvents = eventsByDay[dayKey] || { total: 0, sessionCount: 0, classCount: 0 };
                  const bookingCount = Number(dayEvents.sessionCount || 0);
                  const classCount = Number(dayEvents.classCount || 0);
                  const dayEventsTotal = bookingCount + classCount;
                  const isToday = todayKey === dayKey;
                  const isSelected = selectedDay === dayKey;
                  const hasCheckIn = trainerAttendedByDate.has(dayKey);
                  const isFuture = day > todayStart;
                  const isTrainerStartDay = hasTrainerRegistrationDate && Boolean(trainerStartDayKey) && dayKey === trainerStartDayKey;
                  const beforeTrainerStart = day < trainerStartDate;
                  const isMissedCheckIn = !isFuture && !hasCheckIn && !beforeTrainerStart;

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => {
                        setSelectedDay(dayKey);
                        if (isTrainerStartDay) {
                          setRegistrationDayModal({
                            title: 'Trainer Registration Date',
                            message: `You were registered as trainer on ${formatDate(day)}.`
                          });
                        }
                      }}
                      className={`aspect-square rounded-xl text-sm sm:text-base font-bold transition-all duration-300 relative group border ${
                        isSelected
                          ? 'bg-white text-background border-white shadow-lg shadow-white/20 scale-105 z-10'
                          : isToday
                            ? 'bg-white/10 text-white border-white/30'
                            : beforeTrainerStart
                              ? 'text-white/20 cursor-not-allowed opacity-60 bg-white/[0.02] border-white/5'
                              : 'bg-white/5 text-white hover:bg-white/10 hover:border-white/20 border-white/10 shadow-sm'
                      }`}
                    >
                      <span className="absolute top-2 left-2">{day.getDate()}</span>
                      {dayEventsTotal > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/15 flex items-center justify-center text-[9px] font-black text-white/60 border border-white/10">
                          {dayEventsTotal}
                        </span>
                      )}
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                        {hasCheckIn && !beforeTrainerStart && !isFuture ? (
                          <span className="material-icons-round text-[12px] leading-none text-emerald-400">check_circle</span>
                        ) : null}
                        {isMissedCheckIn ? (
                          <span className="material-icons-round text-[12px] leading-none text-rose-400">cancel</span>
                        ) : null}
                        {bookingCount > 0 ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_4px_rgba(var(--primary-rgb),0.5)]" />
                        ) : null}
                        {classCount > 0 ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_4px_rgba(147,197,253,0.5)]" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="material-icons-round text-[16px] leading-none text-emerald-400">check_circle</span>
                  <span>Check-in</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-icons-round text-[16px] leading-none text-rose-400">cancel</span>
                  <span>No Check-in</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-icons-round text-[16px] leading-none text-primary">fitness_center</span>
                  <span>Bookings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-icons-round text-[16px] leading-none text-cyan-300">groups</span>
                  <span>Classes</span>
                </div>
              </div>
            </div>
          </section>

          <section className="px-4 space-y-4">
            <div className="flex items-end justify-between gap-4 mb-2">
              <div>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-none mb-1.5">Agenda Timeline</p>
                <h2 className="text-2xl font-black text-white leading-tight">{formatSelectedDay(selectedDay)}</h2>
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="text-[9px] uppercase tracking-wider text-primary/70 font-black">1-on-1</span>
                  <span className="text-sm font-black text-primary">{selectedSessions.length}</span>
                </div>
                <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20">
                  <span className="text-[9px] uppercase tracking-wider text-cyan-400/70 font-black">Class</span>
                  <span className="text-sm font-black text-cyan-400">{selectedClasses.length}</span>
                </div>
              </div>
            </div>

            {!(selectedSessions.length > 0 || selectedClasses.length > 0) ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center shadow-xl">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <span className="material-icons-round text-3xl text-text-muted/40">event_busy</span>
                </div>
                <p className="text-sm text-text-muted font-medium">No sessions or classes scheduled for this day.</p>
                <p className="text-[11px] text-text-muted/50 mt-1">Enjoy your time off or choose another date!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedSessions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-primary/80">1-on-1 Sessions</h3>
                      <span className="text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded-full border border-white/10">{selectedSessions.length}</span>
                    </div>
                    <div className="grid gap-3">
                      {selectedSessions.map((s) => {
                        const canTakeAction = canTakeSessionAttendanceAction(s.status);
                        const canFinalizeNow = canMarkSessionAttendanceNow(s);
                        const refunded = isSessionRefunded(s);
                        const normalizedStatus = String(s.status || 'SCHEDULED').replace(/_/g, ' ');
                        return (
                          <div key={s.id} className="relative pl-6 pb-6 last:pb-0 group">
                            <div className="absolute left-[11px] top-2 bottom-0 w-px bg-white/10 group-last:bg-transparent"></div>
                            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-primary/20 border-2 border-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] z-10"></div>
                            
                            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 transition-all hover:bg-white/10 shadow-lg ml-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-lg font-black text-primary leading-none">{formatTime(s.date)}</p>
                                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-text-muted">
                                    {Number(s.duration || 0)} min
                                  </span>
                                </div>
                                {refunded ? (
                                  <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-cyan-300">
                                    Refunded
                                  </span>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${normalizedStatus === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-primary/10 border-primary/30 text-primary'}`}>
                                    {normalizedStatus}
                                  </span>
                                )}
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-text-muted shrink-0">
                                  <span className="material-icons-round text-lg">person</span>
                                </div>
                                <div>
                                  <p className="text-base font-black text-white leading-tight">{`${s.member?.firstName || ''} ${s.member?.lastName || ''}`.trim() || `Member #${s.memberId}`}</p>
                                  <p className="text-[10px] text-text-muted font-medium mt-0.5 uppercase tracking-wider">Member ID: {s.memberId}</p>
                                </div>
                              </div>
                            {canTakeAction && canFinalizeNow && (
                              <div className="mt-4 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCompleteSession(s.id)}
                                  disabled={updatingSessionId === s.id}
                                  className="flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  Mark Attended
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleNoShowSession(s.id)}
                                  disabled={updatingSessionId === s.id}
                                  className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-text-muted hover:text-rose-300 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  No Show
                                </button>
                              </div>
                            )}
                            {canTakeAction && !canFinalizeNow && (
                              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] font-bold text-amber-200/70 flex items-center gap-2">
                                <span className="material-icons-round text-sm">schedule</span>
                                <span>Session active. Finalize in 5m grace.</span>
                              </div>
                            )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedClasses.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-cyan-400/80">Classes</h3>
                      <span className="text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded-full border border-white/10">{selectedClasses.length}</span>
                    </div>
                    <div className="grid gap-3">
                      {selectedClasses.map((cls) => {
                        const classBookings = (Array.isArray(cls.bookings) ? cls.bookings : [])
                          .filter((booking) => {
                            const status = String(booking?.status || '').toUpperCase();
                            return status === 'CONFIRMED' || status === 'ATTENDED';
                          });
                        const attendedBookings = classBookings.filter((booking) => String(booking?.status || '').toUpperCase() === 'ATTENDED');
                        const pendingBookings = classBookings.filter((booking) => String(booking?.status || '').toUpperCase() !== 'ATTENDED');
                        const sessionStatus = String(cls.sessionStatus || 'SCHEDULED').toUpperCase();
                        const lifecycleBusy = updatingClassLifecycleId === cls.id;
                        return (
                          <div key={cls.id} className="relative pl-6 pb-6 last:pb-0 group">
                            <div className="absolute left-[11px] top-2 bottom-0 w-px bg-white/10 group-last:bg-transparent"></div>
                            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-cyan-400/20 border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] z-10"></div>
                            
                            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 transition-all hover:bg-white/10 shadow-lg ml-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-lg font-black text-cyan-400 leading-none">{formatTime(cls.sessionDate)}</p>
                                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-text-muted">
                                    {Number(cls.enrolled || 0)}/{Number(cls.capacity || 0)} Slots
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${sessionStatus === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400'}`}>
                                  {getClassSessionStatusLabel(sessionStatus)}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center text-text-muted shrink-0">
                                  <span className="material-icons-round text-lg">groups</span>
                                </div>
                                <div>
                                  <p className="text-base font-black text-white leading-tight">{cls.name}</p>
                                  <p className="text-[10px] text-text-muted font-medium mt-0.5 uppercase tracking-wider">Class ID: {cls.id}</p>
                                </div>
                              </div>

                            {sessionStatus !== 'COMPLETED' && cls.sessionCanComplete && (
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={() => handleCompleteClass(cls)}
                                  disabled={lifecycleBusy}
                                  className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-cyan-400 text-background hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
                                >
                                  Complete Class Session
                                </button>
                              </div>
                            )}
                            {sessionStatus !== 'COMPLETED' && !cls.sessionCanComplete && (
                              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] font-bold text-amber-200/70 flex items-center gap-2">
                                <span className="material-icons-round text-sm">schedule</span>
                                <span>Waiting for end-of-class grace period.</span>
                              </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Participants</p>
                                <span className="text-[10px] font-bold text-text-muted">{classBookings.length}</span>
                              </div>
                              {classBookings.length > 0 ? (
                                <div className="space-y-4">
                                  {pendingBookings.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted/60">Waiting to mark</p>
                                      <div className="grid gap-2">
                                        {pendingBookings.map((b) => (
                                          <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="text-xs text-white font-bold truncate">{b.member?.firstName || ''} {b.member?.lastName || ''}</p>
                                              <p className="text-[9px] text-text-muted font-medium mt-0.5">Member #{String(b.memberId).slice(-4)}</p>
                                            </div>
                                            <div className="flex gap-1.5">
                                              <button type="button" onClick={() => handleClassBookingStatusUpdate(cls.id, b.id, 'ATTENDED')} disabled={updatingClassBookingId === b.id} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/20 active:scale-90 transition-all">
                                                <span className="material-icons-round text-sm">check</span>
                                              </button>
                                              <button type="button" onClick={() => handleClassBookingStatusUpdate(cls.id, b.id, 'NO_SHOW')} disabled={updatingClassBookingId === b.id} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500/20 active:scale-90 transition-all">
                                                <span className="material-icons-round text-sm">close</span>
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {attendedBookings.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60">Marked attending</p>
                                      <div className="flex flex-wrap gap-2">
                                        {attendedBookings.map((b) => (
                                          <div key={b.id} className="px-2 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                                            <span className="text-[10px] text-emerald-300 font-bold">{b.member?.firstName} {b.member?.lastName?.charAt(0)}.</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[11px] text-text-muted italic py-2">No participants yet for this session.</p>
                              )}
                            </div>
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

        </>
      ) : (
        <section className="px-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {activeHistoryTab === 'BOOKINGS' ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-3 py-4 text-center shadow-lg transition-all hover:bg-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black">Completed</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{historySummary.completed}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-3 py-4 text-center shadow-lg transition-all hover:bg-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black">Refunded</p>
                  <p className="text-xl font-black text-cyan-400 mt-1">{historySummary.refunded}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-4 text-center shadow-lg transition-all hover:bg-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black">Cancelled</p>
                  <p className="text-xl font-black text-rose-400 mt-1">{historySummary.cancelled}</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-3 py-4 text-center shadow-lg transition-all hover:bg-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black">Classes</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{historySummary.completedClasses}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-3 py-4 text-center shadow-lg transition-all hover:bg-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black">Avg Attendees</p>
                  <p className="text-xl font-black text-primary mt-1">
                    {Number(historySummary.averageAttendance || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-3 py-4 text-center shadow-lg transition-all hover:bg-white/10">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted font-black">No-Shows</p>
                  <p className="text-xl font-black text-amber-400 mt-1">{historySummary.noShowCount}</p>
                </div>
              </>
            )}
          </div>

          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
              {HISTORY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHistoryViewScope(tab)}
                  className={`h-10 px-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeHistoryTab === tab
                    ? 'bg-white text-background shadow-lg scale-[1.02]'
                    : 'text-text-muted hover:text-white hover:bg-white/5'
                    }`}
                >
                  {tab === 'BOOKINGS' ? '1-on-1' : 'Classes'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="relative flex-1 group">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted group-focus-within:text-primary transition-colors">search</span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder={activeHistoryTab === 'CLASSES' ? 'Search classes...' : 'Search members...'}
                  className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 text-xs font-bold text-white placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowHistoryFilters((prev) => !prev)}
                className={`h-10 w-10 shrink-0 rounded-2xl border transition-all flex items-center justify-center ${showHistoryFilters || historyStatusFilter !== 'ALL'
                  ? 'bg-primary text-background border-primary shadow-lg scale-105'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}
              >
                <span className="material-icons-round text-lg">tune</span>
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

          <div className="px-1 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white leading-none">Session Logs</h2>
                <p className="text-[11px] text-text-muted mt-1.5 font-medium">Recorded activity and earnings history</p>
              </div>
              <button
                type="button"
                onClick={() => refreshData()}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95 shadow-lg"
              >
                <span className="material-icons-round text-lg">sync</span>
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

      {registrationDayModal && (
        <div className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl p-8 shadow-2xl scale-in-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20">
              <span className="material-icons-round text-3xl text-primary">event_available</span>
            </div>
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-xl font-black text-white leading-tight">{registrationDayModal.title}</h3>
              <p className="text-sm text-text-muted font-medium px-2">{registrationDayModal.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setRegistrationDayModal(null)}
              className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-primary text-background shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Understand
            </button>
          </div>
        </div>
      )}

      {selectedHistoryParticipantsEntry && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center p-0 sm:p-6 animate-in fade-in duration-300">
          <button
            type="button"
            onClick={() => setSelectedHistoryParticipantsEntry(null)}
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
            aria-label="Close participants modal"
          />
          <div className="relative w-full sm:max-w-lg bg-white/5 backdrop-blur-2xl rounded-t-[32px] sm:rounded-[32px] border-t sm:border border-white/10 overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
              <div>
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest leading-none mb-1.5">Class Roster</p>
                <h3 className="text-lg font-black text-white leading-tight">
                  {selectedHistoryParticipantsEntry.class?.name || `Class #${selectedHistoryParticipantsEntry.classId}`}
                </h3>
                <p className="text-[11px] text-text-muted mt-1 font-medium">
                  {formatDate(selectedHistoryParticipantsEntry.date)} • {formatTime(selectedHistoryParticipantsEntry.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryParticipantsEntry(null)}
                className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-90"
                aria-label="Close participants modal"
              >
                <span className="material-icons-round text-lg">close</span>
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
              {(Array.isArray(selectedHistoryParticipantsEntry.participants) && selectedHistoryParticipantsEntry.participants.length > 0) ? (
                selectedHistoryParticipantsEntry.participants.map((participant) => {
                  const fullName = `${participant.member?.firstName || ''} ${participant.member?.lastName || ''}`.trim() || `Member #${participant.memberId}`;
                  const rawStatus = String(participant.status || 'N/A').replace(/_/g, ' ');
                  return (
                    <article key={`history-participant-${participant.id}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 group">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">{fullName}</p>
                          <p className="text-[10px] text-text-muted font-medium mt-0.5 uppercase tracking-wider">Member #{participant.memberId}</p>
                        </div>
                        <span className={`rounded-xl border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shrink-0 ${getParticipantStatusBadgeClasses(participant.status)}`}>
                          {rawStatus}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center shadow-inner">
                  <span className="material-icons-round text-4xl text-text-muted/20 mb-3">person_off</span>
                  <p className="text-sm text-text-muted font-medium">No participants recorded for this session.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-white/[0.02] border-t border-white/5">
              <button
                type="button"
                onClick={() => setSelectedHistoryParticipantsEntry(null)}
                className="w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
