import { useConfirm } from '../../context/ConfirmContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Users, Clock, X, User, CheckCircle2, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

const minutesTo24Hour = (minutes) => {
    const normalized = ((Number(minutes) % 1440) + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
            label: String(time || 'TBA'),
            start: String(time || 'TBA'),
            end: '',
            durationLabel: durationMinutes > 0 ? `${durationMinutes} min` : 'N/A'
        };
    }

    const endMinutes = startMinutes + durationMinutes;
    return {
        label: `${minutesTo12Hour(startMinutes)} - ${minutesTo12Hour(endMinutes)}`,
        start: minutesTo12Hour(startMinutes),
        end: minutesTo12Hour(endMinutes),
        durationLabel: `${durationMinutes} min`
    };
};

const toDateInputValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatDateLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

export default function Classes() {
    const { alert: showAlert, confirm: showConfirm } = useConfirm();
    const { user } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeDay, setActiveDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [trainers, setTrainers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState('create');
    const [saving, setSaving] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        trainerId: '',
        scheduleType: 'RECURRING',
        dayOfWeek: activeDay,
        oneTimeDate: '',
        startTime: '',
        endTime: '',
        capacity: '',
        basePay: ''
    });
    const totalClasses = classes.length;
    const totalBookings = classes.reduce((sum, cls) => sum + (cls.bookings?.length || 0), 0);
    const totalCapacity = classes.reduce((sum, cls) => sum + (cls.capacity || 0), 0);

    useEffect(() => {
        fetchClasses();
        fetchTrainers();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await axios.get('/api/classes');
            setClasses(res.data);
            setLoading(false);
        } catch {
            console.error("Failed to fetch classes");
            setLoading(false);
        }
    };

    const fetchTrainers = async () => {
        try {
            const res = await axios.get('/api/trainers');
            setTrainers(res.data);
        } catch {
            console.error("Failed to fetch trainers");
        }
    };

    const fetchParticipants = async (classId, sessionDate) => {
        setParticipantsLoading(true);
        try {
            const res = await axios.get(`/api/classes/${classId}/participants`, {
                params: sessionDate ? { sessionDate } : undefined
            });
            setParticipants(res.data);
            setParticipantsLoading(false);
        } catch {
            console.error("Failed to fetch participants");
            setParticipantsLoading(false);
        }
    };

    const handleViewParticipants = (cls) => {
        setSelectedClass(cls);
        fetchParticipants(cls.id, cls.sessionDate);
    };

    const openCreateForm = () => {
        setFormMode('create');
        setEditingClass(null);
        setFormData({
            name: '',
            trainerId: trainers[0]?.id || '',
            scheduleType: 'RECURRING',
            dayOfWeek: activeDay,
            oneTimeDate: '',
            startTime: '',
            endTime: '',
            capacity: '',
            basePay: ''
        });
        setShowForm(true);
    };

    const openEditForm = (cls) => {
        setFormMode('edit');
        const startMinutes = parseTimeToMinutes(cls.time || '');
        const durationMinutes = Number(cls.duration || 0);
        const endMinutes = startMinutes !== null && durationMinutes > 0 ? startMinutes + durationMinutes : null;

        setFormData({
            name: cls.name || '',
            trainerId: cls.trainerId || cls.trainer?.id || '',
            scheduleType: cls.scheduleType || 'RECURRING',
            dayOfWeek: cls.dayOfWeek || activeDay,
            oneTimeDate: cls.oneTimeDate ? toDateInputValue(cls.oneTimeDate) : '',
            startTime: startMinutes !== null ? minutesTo24Hour(startMinutes) : '',
            endTime: endMinutes !== null ? minutesTo24Hour(endMinutes) : '',
            capacity: cls.capacity ?? '',
            basePay: cls.basePay ?? ''
        });
        setEditingClass(cls);
        setShowForm(true);
    };

    const handleFormChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveClass = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) { await showAlert({ title: 'Validation', message: 'Class name is required.', type: 'warning' }); return; }
        if (!formData.trainerId) { await showAlert({ title: 'Validation', message: 'Trainer is required.', type: 'warning' }); return; }
        if (formData.scheduleType === 'RECURRING' && !formData.dayOfWeek) {
            await showAlert({ title: 'Validation', message: 'Day is required for recurring classes.', type: 'warning' });
            return;
        }
        if (formData.scheduleType === 'ONE_TIME' && !formData.oneTimeDate) {
            await showAlert({ title: 'Validation', message: 'Class date is required for one-time classes.', type: 'warning' });
            return;
        }
        if (!formData.startTime || !formData.endTime) { await showAlert({ title: 'Validation', message: 'Start time and end time are required.', type: 'warning' }); return; }

        const startMinutes = parseTimeToMinutes(formData.startTime);
        const endMinutes = parseTimeToMinutes(formData.endTime);
        if (startMinutes === null || endMinutes === null) {
            await showAlert({ title: 'Validation', message: 'Invalid start or end time.', type: 'warning' });
            return;
        }
        if (endMinutes <= startMinutes) {
            await showAlert({ title: 'Validation', message: 'End time must be later than start time.', type: 'warning' });
            return;
        }

        const payload = {
            name: formData.name,
            trainerId: formData.trainerId,
            scheduleType: formData.scheduleType,
            dayOfWeek: formData.dayOfWeek,
            oneTimeDate: formData.scheduleType === 'ONE_TIME' ? formData.oneTimeDate : null,
            startTime: formData.startTime,
            endTime: formData.endTime,
            time: minutesTo12Hour(startMinutes),
            duration: endMinutes - startMinutes,
            capacity: formData.capacity,
            basePay: formData.basePay
        };

        setSaving(true);
        try {
            if (formMode === 'create') {
                await axios.post('/api/classes', payload);
            } else if (editingClass) {
                await axios.put(`/api/classes/${editingClass.id}`, payload);
            }
            setShowForm(false);
            setEditingClass(null);
            await fetchClasses();
        } catch (error) {
            showAlert({ title: 'Save Failed', message: error?.response?.data?.error || 'Failed to save class.', type: 'danger' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClass = async (cls) => {
        const confirmed = await showConfirm({
            title: 'Delete Class?',
            message: `Delete class ${cls.name}?`,
            confirmLabel: 'Delete',
            type: 'danger'
        });
        if (!confirmed) return;
        try {
            await axios.delete(`/api/classes/${cls.id}`);
            await fetchClasses();
        } catch (error) {
            showAlert({ title: 'Delete Failed', message: error?.response?.data?.error || 'Failed to delete class.', type: 'danger' });
        }
    };

    const handleCompleteClass = async (cls) => {
        const confirmed = await showConfirm({
            title: 'Complete Class?',
            message: `Mark "${cls.name}" as completed for today? This will record attendance and calculate trainer commission.`,
            confirmLabel: 'Complete',
            type: 'info'
        });
        if (!confirmed) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`/api/classes/${cls.id}/complete`, {
                sessionDate: cls.sessionDate || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showAlert({ title: "Class Completed!", message: `Class completed! ${res.data.attendeeCount} attendees.`, type: "success" });
            await fetchClasses();
        } catch (error) {
            showAlert({ title: 'Complete Failed', message: error?.response?.data?.error || 'Failed to complete class.', type: 'danger' });
        }
    };

    const filteredClasses = classes.filter(cls => cls.dayOfWeek === activeDay);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Class Management</h1>
                    <p className="text-text-muted mt-1">Create weekly classes, assign trainers, and manage capacity</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-sm text-text-secondary">
                        <span className="text-white font-semibold">{totalClasses}</span> Classes
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-sm text-text-secondary">
                        <span className="text-white font-semibold">{totalBookings}</span> Bookings
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-sm text-text-secondary">
                        <span className="text-white font-semibold">{totalCapacity}</span> Capacity
                    </div>
                    {isAdmin && (
                        <button
                            onClick={openCreateForm}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Add Class
                        </button>
                    )}
                </div>
            </header>

            {/* Day Navigation */}
            <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                    <button
                        key={day}
                        onClick={() => setActiveDay(day)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeDay === day
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-surface text-text-muted border border-white/5 hover:text-white hover:border-white/10'
                            }`}
                    >
                        {day}
                    </button>
                ))}
            </div>

            {/* Classes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredClasses.length > 0 ? (
                    filteredClasses.map(cls => {
                        const currentEnrolled = Number(cls.enrolled || 0);
                        const isFull = currentEnrolled >= cls.capacity;
                        const schedule = getClassTimeRange(cls.time, cls.duration);
                        const scheduleType = String(cls.scheduleType || 'RECURRING').toUpperCase();
                        return (
                            <div key={cls.id} className="bg-surface rounded-2xl border border-white/5 p-5 relative overflow-hidden transition-all hover:shadow-lg hover:border-white/10">
                                <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>

                                <div className="absolute top-4 right-4 flex gap-2 z-10">
                                    {isAdmin && (
                                        <>
                                            <button
                                                onClick={() => openEditForm(cls)}
                                                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-text-muted hover:text-white transition-all"
                                                title="Edit class"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClass(cls)}
                                                className="w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 transition-all"
                                                title="Delete class"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-semibold text-text-muted">Duration</span>
                                    <div className="flex items-center gap-2 text-text-secondary text-xs">
                                        <Clock size={14} className="text-primary" />
                                        {schedule.durationLabel}
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary transition-colors">
                                    {cls.name}
                                </h3>
                                <p className="text-text-muted text-sm mb-5">
                                    Led by <span className="text-white font-bold">{cls.trainer?.name}</span>
                                </p>

                                <div className="mb-4 flex items-center gap-2 text-xs">
                                    <span className="material-icons-round text-primary text-[15px]">repeat</span>
                                    {scheduleType === 'ONE_TIME' ? (
                                        <span className="text-text-muted">One-time class on <span className="text-white font-semibold">{formatDateLabel(cls.oneTimeDate || cls.sessionDate)}</span></span>
                                    ) : (
                                        <span className="text-text-muted">Recurring every <span className="text-white font-semibold">{cls.dayOfWeek}</span></span>
                                    )}
                                </div>

                                {cls.basePay > 0 && (
                                    <div className="mb-4 flex items-center gap-2 text-xs">
                                        <span className="material-icons-round text-emerald-400 text-[15px]">payments</span>
                                        <span className="text-text-muted">Trainer pay per completion:</span>
                                        <span className="font-bold text-emerald-400">₱{Number(cls.basePay).toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 mb-5 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                        <Calendar className="text-primary" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-muted mb-1">Class Time</p>
                                        <p className="text-white font-semibold">{schedule.label}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-5">
                                    <div className="flex justify-between items-center text-xs text-text-muted">
                                        <span>Capacity</span>
                                        <span className={isFull ? 'text-red-400' : 'text-primary'}>
                                            {currentEnrolled} / {cls.capacity}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-primary'}`}
                                            style={{ width: `${Math.min(100, (currentEnrolled / cls.capacity) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleViewParticipants(cls)}
                                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    <Users size={16} className="text-primary" />
                                    View Participants
                                </button>
                                {isAdmin && (
                                    cls.completedToday ? (
                                        <div className="w-full py-2.5 mt-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-2 text-sm font-medium">
                                            <CheckCircle2 size={16} />
                                            Completed Today — {cls.todayCompletion?.attendeeCount || 0} attendees · ₱{cls.todayCompletion?.commissionAmount?.toFixed(2) || '0.00'}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleCompleteClass(cls)}
                                            className="w-full py-2.5 mt-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                                        >
                                            <CheckCircle2 size={16} />
                                            Complete Class
                                        </button>
                                    )
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-24 text-center bg-white/[0.01] rounded-2xl border border-white/5 border-dashed">
                        <Calendar size={48} className="text-text-muted/20 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-white/30">No Classes Scheduled</h4>
                        <p className="text-text-muted/20 text-sm font-bold uppercase tracking-widest mt-2">{activeDay} is currently open for free training</p>
                    </div>
                )}
            </div>

            {/* Participants Modal */}
            {selectedClass && (
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setSelectedClass(null)}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <div className="bg-surface w-full max-w-2xl max-h-[88vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="sticky top-0 z-10 p-6 border-b border-white/10 bg-surface/95 backdrop-blur flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                        <Users className="text-primary" size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white leading-none">{selectedClass.name}</h3>
                                        <p className="text-text-muted text-sm mt-1">
                                            Participants - {selectedClass.sessionDate ? formatDateLabel(selectedClass.sessionDate) : activeDay}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedClass(null)}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                                {participantsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <p className="text-text-muted text-xs font-semibold">Syncing attendance...</p>
                                    </div>
                                ) : participants.length > 0 ? (
                                    <div className="space-y-4">
                                        {participants.map((booking) => (
                                            <div key={booking.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl group hover:border-primary/30 transition-all hover:bg-primary/5">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-10 h-10 rounded-xl bg-surfaceHighlight flex items-center justify-center border border-white/10 group-hover:border-primary/20">
                                                        {booking.member?.imageUrl ? (
                                                            <img src={booking.member.imageUrl} className="w-full h-full object-cover rounded-xl" alt="" />
                                                        ) : (
                                                            <User size={20} className="text-text-muted" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-semibold text-sm">{booking.member?.firstName} {booking.member?.lastName}</p>
                                                        <p className="text-xs text-text-muted">Member ID: #{booking.memberId}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {booking.status === 'ATTENDED' ? (
                                                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                            <CheckCircle2 size={12} />
                                                            Attended
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-primary text-xs font-semibold px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg">
                                                            <Clock size={12} />
                                                            Booked
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 bg-white/[0.01] rounded-2xl border border-white/5 border-dashed">
                                        <AlertCircle size={40} className="text-text-muted/20 mx-auto mb-4" />
                                        <h4 className="text-lg font-bold text-white/30">No Participants Yet</h4>
                                        <p className="text-text-muted/20 text-xs font-semibold mt-2">Registration for this session is currently open</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Statistics */}
                            <div className="sticky bottom-0 p-6 border-t border-white/10 bg-surface/95 backdrop-blur flex items-center justify-between">
                                <div className="flex gap-6">
                                    <div>
                                        <p className="text-xs text-text-muted mb-1">Booked</p>
                                        <p className="text-white font-semibold text-lg">{participants.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-muted mb-1">Capacity Left</p>
                                        <p className="text-white font-semibold text-lg">{selectedClass.capacity - participants.length}</p>
                                    </div>
                                </div>
                                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-sm font-medium transition-all">
                                    Export List
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 z-[110] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => { setShowForm(false); setEditingClass(null); }}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <form
                            onSubmit={handleSaveClass}
                            className="bg-surface w-full max-w-5xl h-[calc(100vh-3rem)] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="sticky top-0 z-10 p-6 border-b border-white/10 bg-surface/95 backdrop-blur flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {formMode === 'create' ? 'Add Class' : 'Edit Class'}
                                    </h2>
                                    <p className="text-text-muted text-sm mt-1">
                                        Manage weekly training sessions
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); setEditingClass(null); }}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Class Name</label>
                                        <input
                                            value={formData.name}
                                            onChange={(e) => handleFormChange('name', e.target.value)}
                                            className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                            placeholder="Morning HIIT"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Trainer</label>
                                        <select
                                            value={formData.trainerId}
                                            onChange={(e) => handleFormChange('trainerId', e.target.value)}
                                            className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                        >
                                            <option value="">Select trainer</option>
                                            {trainers.map((trainer) => (
                                                <option key={trainer.id} value={trainer.id} className="text-black">
                                                    {trainer.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Schedule Type</label>
                                        <select
                                            value={formData.scheduleType}
                                            onChange={(e) => handleFormChange('scheduleType', e.target.value)}
                                            className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                        >
                                            <option value="RECURRING" className="text-black">Recurring</option>
                                            <option value="ONE_TIME" className="text-black">One-time</option>
                                        </select>
                                    </div>
                                    <div>
                                        {formData.scheduleType === 'ONE_TIME' ? (
                                            <>
                                                <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Class Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.oneTimeDate}
                                                    onChange={(e) => handleFormChange('oneTimeDate', e.target.value)}
                                                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Day</label>
                                                <select
                                                    value={formData.dayOfWeek}
                                                    onChange={(e) => handleFormChange('dayOfWeek', e.target.value)}
                                                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                                >
                                                    {DAYS.map((day) => (
                                                        <option key={day} value={day} className="text-black">
                                                            {day}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Start Time</label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => handleFormChange('startTime', e.target.value)}
                                            className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-muted uppercase tracking-widest font-bold">End Time</label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => handleFormChange('endTime', e.target.value)}
                                            className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Capacity</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.capacity}
                                            onChange={(e) => handleFormChange('capacity', e.target.value)}
                                            className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs text-text-muted uppercase tracking-widest font-bold">Trainer Base Pay per Completion (?)</label>
                                        <p className="text-text-muted text-xs mt-1 mb-2">When this class is completed, this amount is added to the trainer's unpaid commission.</p>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formData.basePay}
                                            onChange={(e) => handleFormChange('basePay', e.target.value)}
                                            className="mt-2 w-full bg-white/5 border border-emerald-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-400"
                                            placeholder="e.g. 300"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="sticky bottom-0 p-6 border-t border-white/10 bg-surface/95 backdrop-blur flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); setEditingClass(null); }}
                                    className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 rounded-xl bg-primary hover:bg-orange-600 text-white text-sm font-medium shadow-lg shadow-primary/20 disabled:opacity-70 transition-colors"
                                >
                                    {saving ? 'Saving...' : 'Save Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}



