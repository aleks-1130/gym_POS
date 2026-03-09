import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useConfirm } from '../../context/ConfirmContext';

const FINALIZED_SESSION_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'DECLINED'];

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

const formatDateTime = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatSelectedDay = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'Selected Date';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const toInputDateValue = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateFilterStart = (v) => {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const parseDateFilterEnd = (v) => {
  if (!v) return null;
  const d = new Date(`${v}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const isWithinDateRange = (value, fromDate, toDate) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
};

const canTakeSessionAttendanceAction = (status) => {
  const s = String(status || '').toUpperCase();
  return s === 'SCHEDULED' || s === 'RESCHEDULED';
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export default function TrainerClassesSessions() {
  const { alert: showAlert } = useConfirm();
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classHistory, setClassHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingSessionId, setUpdatingSessionId] = useState(null);
  const [updatingClassBookingId, setUpdatingClassBookingId] = useState(null);
  const [activeView, setActiveView] = useState('calendar');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date().toDateString());
  const [initializedSelection, setInitializedSelection] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyViewScope, setHistoryViewScope] = useState('BOTH');
  const [historyExportScope, setHistoryExportScope] = useState('BOTH');

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

  const parsedHistoryDateFrom = useMemo(() => parseDateFilterStart(historyDateFrom), [historyDateFrom]);
  const parsedHistoryDateTo = useMemo(() => parseDateFilterEnd(historyDateTo), [historyDateTo]);
  const hasInvalidHistoryRange = Boolean(parsedHistoryDateFrom && parsedHistoryDateTo && parsedHistoryDateFrom > parsedHistoryDateTo);

  const filteredBookingHistory = useMemo(() => {
    if (hasInvalidHistoryRange) return [];
    return bookingHistory.filter((s) => isWithinDateRange(s.date, parsedHistoryDateFrom, parsedHistoryDateTo));
  }, [bookingHistory, hasInvalidHistoryRange, parsedHistoryDateFrom, parsedHistoryDateTo]);

  const filteredClassHistory = useMemo(() => {
    if (hasInvalidHistoryRange) return [];
    return classHistoryEntries.filter((entry) => isWithinDateRange(entry.date, parsedHistoryDateFrom, parsedHistoryDateTo));
  }, [classHistoryEntries, hasInvalidHistoryRange, parsedHistoryDateFrom, parsedHistoryDateTo]);

  const shouldShowBookingHistory = historyViewScope === 'BOTH' || historyViewScope === 'BOOKINGS';
  const shouldShowClassHistory = historyViewScope === 'BOTH' || historyViewScope === 'CLASSES';
  const filteredHistoryTotal = filteredBookingHistory.length + filteredClassHistory.length;
  const activeFilterCount = Number(Boolean(historyDateFrom)) + Number(Boolean(historyDateTo)) + Number(historyViewScope !== 'BOTH');

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

  const handleExportHistoryPdf = async () => {
    const popup = window.open('', '_blank', 'width=1080,height=900');
    if (!popup) {
      await showAlert({ title: 'Blocked', message: 'Please allow popups to export PDF.', type: 'warning' });
      return;
    }

    const includeBookings = historyExportScope === 'BOTH' || historyExportScope === 'BOOKINGS';
    const includeClasses = historyExportScope === 'BOTH' || historyExportScope === 'CLASSES';
    const exportBookings = includeBookings ? filteredBookingHistory : [];
    const exportClasses = includeClasses ? filteredClassHistory : [];
    const exportRangeLabel = historyDateFrom || historyDateTo
      ? `${historyDateFrom || 'Any start'} to ${historyDateTo || 'Any end'}`
      : 'All dates';

    const bookingRows = exportBookings.map((s) => {
      const memberName = `${s.member?.firstName || ''} ${s.member?.lastName || ''}`.trim() || `Member #${s.memberId}`;
      return `<tr><td>${escapeHtml(formatDateTime(s.date))}</td><td>${escapeHtml(memberName)}</td><td>${escapeHtml(Number(s.duration || 0))} min</td><td>${escapeHtml(s.status || 'SCHEDULED')}</td></tr>`;
    }).join('');

    const classBlocks = exportClasses.map((entry) => {
      const participants = Array.isArray(entry.participants) ? entry.participants : [];
      const rowsHtml = participants.length > 0
        ? participants.map((p) => {
          const n = `${p.member?.firstName || ''} ${p.member?.lastName || ''}`.trim() || `Member #${p.memberId}`;
          return `<tr><td>${escapeHtml(n)}</td><td>${escapeHtml(p.status || 'CONFIRMED')}</td></tr>`;
        }).join('')
        : '<tr><td colspan="2">No participants recorded.</td></tr>';
      return `<section class="class-card"><h3>${escapeHtml(entry.class?.name || `Class #${entry.classId}`)}</h3><p>Date: ${escapeHtml(formatDateTime(entry.date))}</p><p>Attendee Count: ${escapeHtml(entry.attendeeCount)}</p><table><thead><tr><th>Participant</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table></section>`;
    }).join('');

    const bookingSection = includeBookings
      ? `<h2>1-on-1 Booking History</h2><table><thead><tr><th>Date/Time</th><th>Member</th><th>Duration</th><th>Status</th></tr></thead><tbody>${bookingRows || '<tr><td colspan="4">No booking history found.</td></tr>'}</tbody></table>`
      : '';
    const classSection = includeClasses
      ? `<h2 style="margin-top:20px">Class History with Participants</h2>${classBlocks || '<p>No class history found.</p>'}`
      : '';

    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Trainer History</title><style>body{font-family:Arial,sans-serif;color:#111;margin:24px}h1,h2,h3{margin:0 0 8px}.meta{margin:0 0 18px;color:#444;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:8px;font-size:12px;text-align:left}th{background:#f3f3f3}.class-card{margin-top:18px;padding-top:6px;border-top:2px solid #ddd}@page{size:A4;margin:12mm}</style></head><body><h1>Trainer History Report</h1><p class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</p><p class="meta">Date Range: ${escapeHtml(exportRangeLabel)}</p>${bookingSection}${classSection}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.onload = () => popup.print();
  };

  const applyHistoryPreset = (days) => {
    if (!days) {
      setHistoryDateFrom('');
      setHistoryDateTo('');
      return;
    }
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1));
    setHistoryDateFrom(toInputDateValue(startDate));
    setHistoryDateTo(toInputDateValue(endDate));
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
                        return (
                          <div key={cls.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                            <p className="text-sm font-semibold text-emerald-300">{formatTime(cls.sessionDate)}</p>
                            <p className="text-sm text-white mt-1">{cls.name}</p>
                            <p className="text-[11px] text-text-muted mt-1">{Number(cls.enrolled || 0)} / {Number(cls.capacity || 0)} enrolled</p>
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
                                        <button type="button" onClick={() => handleClassBookingStatusUpdate(cls.id, b.id, 'CONFIRMED')} disabled={updatingClassBookingId === b.id} className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50">Confirmed</button>
                                        <button type="button" onClick={() => handleClassBookingStatusUpdate(cls.id, b.id, 'CANCELLED')} disabled={updatingClassBookingId === b.id} className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border border-rose-500/30 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50">Cancelled</button>
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
        <section className="space-y-3 sm:space-y-4">
          <div className="rounded-2xl border border-white/10 bg-surface p-3 sm:p-5 space-y-3 sm:space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white">History Workspace</h2>
                <p className="text-xs text-text-muted mt-1">Filter records, switch views, then export by selected scope.</p>
                <p className="text-[11px] text-text-muted mt-2">
                  Range: {historyDateFrom || historyDateTo ? `${historyDateFrom || 'Any start'} to ${historyDateTo || 'Any end'}` : 'All dates'} | Active Filters: {activeFilterCount}
                </p>
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
                <button type="button" onClick={() => applyHistoryPreset(7)} className="shrink-0 snap-start px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10">Last 7 Days</button>
                <button type="button" onClick={() => applyHistoryPreset(30)} className="shrink-0 snap-start px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10">Last 30 Days</button>
                <button type="button" onClick={() => applyHistoryPreset(90)} className="shrink-0 snap-start px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/10 bg-white/5 text-text-muted hover:text-white hover:bg-white/10">Last 90 Days</button>
                <button type="button" onClick={() => applyHistoryPreset(0)} className="shrink-0 snap-start px-3 py-1.5 rounded-lg text-[11px] font-bold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15">All Time</button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-text-muted">From Date</span>
                  <input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-text-muted">To Date</span>
                  <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-text-muted">View Scope</span>
                  <select value={historyViewScope} onChange={(e) => setHistoryViewScope(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary">
                    <option value="BOTH" style={{ color: '#111', backgroundColor: '#fff' }}>Bookings + Classes</option>
                    <option value="BOOKINGS" style={{ color: '#111', backgroundColor: '#fff' }}>Bookings Only</option>
                    <option value="CLASSES" style={{ color: '#111', backgroundColor: '#fff' }}>Classes Only</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-text-muted">Export Scope</span>
                  <select value={historyExportScope} onChange={(e) => setHistoryExportScope(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary">
                    <option value="BOTH" style={{ color: '#111', backgroundColor: '#fff' }}>Bookings + Classes</option>
                    <option value="BOOKINGS" style={{ color: '#111', backgroundColor: '#fff' }}>Bookings Only</option>
                    <option value="CLASSES" style={{ color: '#111', backgroundColor: '#fff' }}>Classes Only</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryViewScope('BOTH'); }} className="w-full px-3 py-2.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10">Reset</button>
                <button type="button" onClick={handleExportHistoryPdf} disabled={hasInvalidHistoryRange} className="w-full px-3 py-2.5 rounded-lg text-xs font-bold bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50">Export PDF</button>
              </div>
            </div>

            {hasInvalidHistoryRange
              ? <p className="text-xs text-rose-300">Invalid range: From Date must be on or before To Date.</p>
              : <p className="text-xs text-text-muted">Default view shows all history records. Use filters for focused reporting.</p>}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-[10px] uppercase tracking-wide text-text-muted font-bold">Visible Records</p>
              <p className="text-lg sm:text-xl text-white font-bold mt-1">{filteredHistoryTotal}</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-[10px] uppercase tracking-wide text-primary font-bold">Booking History</p>
              <p className="text-lg sm:text-xl text-white font-bold mt-1">{filteredBookingHistory.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-[10px] uppercase tracking-wide text-emerald-300 font-bold">Class History</p>
              <p className="text-lg sm:text-xl text-white font-bold mt-1">{filteredClassHistory.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 sm:px-4 py-2.5 sm:py-3">
              <p className="text-[10px] uppercase tracking-wide text-amber-300 font-bold">Active Filters</p>
              <p className="text-lg sm:text-xl text-white font-bold mt-1">{activeFilterCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {shouldShowBookingHistory && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">1-on-1 Booking History</h3>
                  <span className="text-xs text-text-muted">{filteredBookingHistory.length}</span>
                </div>
                {filteredBookingHistory.length === 0 ? <p className="text-xs text-text-muted">No booking history yet.</p> : (
                  <div className="space-y-2 xl:max-h-[540px] xl:overflow-y-auto xl:pr-1">
                    {filteredBookingHistory.map((s) => (
                      <div key={`history-session-${s.id}`} className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 sm:p-3">
                        <p className="text-sm text-primary font-semibold">{formatDateTime(s.date)}</p>
                        <p className="text-sm text-white mt-1">{`${s.member?.firstName || ''} ${s.member?.lastName || ''}`.trim() || `Member #${s.memberId}`}</p>
                        <p className="text-[11px] text-text-muted mt-1 uppercase tracking-wide">{Number(s.duration || 0)} min - {s.status || 'SCHEDULED'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {shouldShowClassHistory && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Class History with Participants</h3>
                  <span className="text-xs text-text-muted">{filteredClassHistory.length}</span>
                </div>
                {filteredClassHistory.length === 0 ? <p className="text-xs text-text-muted">No class history yet.</p> : (
                  <div className="space-y-3 xl:max-h-[540px] xl:overflow-y-auto xl:pr-1">
                    {filteredClassHistory.map((entry) => {
                      const participants = Array.isArray(entry.participants) ? entry.participants : [];
                      return (
                        <div key={`history-class-${entry.id}`} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 sm:p-3">
                          <p className="text-sm font-semibold text-emerald-300">{entry.class?.name || `Class #${entry.classId}`}</p>
                          <p className="text-[11px] text-text-muted mt-1">{formatDate(entry.date)} - Attendees: {Number(entry.attendeeCount || 0)}</p>
                          <div className="mt-3 border-t border-white/10 pt-2 space-y-2">
                            <p className="text-[11px] text-text-muted uppercase tracking-wide">Participants ({participants.length})</p>
                            {participants.length > 0 ? (
                              <div className="space-y-2">
                                {participants.map((p) => (
                                  <div key={p.id} className="rounded-lg border border-white/10 bg-black/15 p-2">
                                    <p className="text-xs text-white font-semibold">{p.member?.firstName || ''} {p.member?.lastName || ''}</p>
                                    <p className="text-[10px] text-text-muted mt-0.5">Member #{p.memberId} - {p.status}</p>
                                  </div>
                                ))}
                              </div>
                            ) : <p className="text-[11px] text-text-muted">No participants recorded.</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
