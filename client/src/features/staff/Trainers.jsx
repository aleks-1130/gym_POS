import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, User } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getAvailabilityRows = (trainer) => {
    const byDay = trainer?.availabilityByDay;
    if (!byDay || typeof byDay !== 'object') return [];

    const dayMap = new Map();
    Object.entries(byDay).forEach(([rawDay, rawConfig]) => {
        let normalizedDay = Number(rawDay);
        if (normalizedDay === 7) normalizedDay = 0;
        if (!Number.isInteger(normalizedDay) || normalizedDay < 0 || normalizedDay > 6) return;

        if (!dayMap.has(normalizedDay)) {
            dayMap.set(normalizedDay, {
                day: normalizedDay,
                label: WEEKDAY_LABELS[normalizedDay],
                start: rawConfig?.start || '--:--',
                end: rawConfig?.end || '--:--'
            });
        }
    });

    return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
};

const getDurations = (trainer) => {
    const raw = trainer?.sessionDurations;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
    return String(raw)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
};

const formatMoney = (value) => {
    const num = Number(value || 0);
    return `P${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const getStatusClass = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'COMPLETED') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (normalized === 'SCHEDULED') return 'border-primary/30 bg-primary/10 text-primary';
    return 'border-red-500/30 bg-red-500/10 text-red-300';
};

export default function StaffTrainers() {
    const queryClient = useQueryClient();
    const { alert: showAlert } = useConfirm();
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('NAME_ASC');
    const [activeTab, setActiveTab] = useState('TRAINERS'); // TRAINERS | RESCHEDULE
    const [selectedTrainerId, setSelectedTrainerId] = useState(null);
    const [modalTrainer, setModalTrainer] = useState(null);
    const [detailTab, setDetailTab] = useState('PROFILE');
    const [resolveModalSession, setResolveModalSession] = useState(null);
    const [resolveForm, setResolveForm] = useState({ action: 'MOVE', date: '', time: '', note: '' });

    const { data: trainers = [], isLoading, isError } = useQuery({
        queryKey: ['trainers'],
        queryFn: async () => {
            const res = await axios.get('/api/trainers');
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    const filteredTrainers = useMemo(() => {
        const query = String(search || '').trim().toLowerCase();
        let list = trainers.filter((trainer) => {
            const type = String(trainer?.type || '').toUpperCase();
            if (typeFilter === 'FULLTIME' && type !== 'FULLTIME') return false;
            if (typeFilter === 'FREELANCER' && type !== 'FREELANCER') return false;
            if (!query) return true;

            const fields = [
                trainer?.name,
                trainer?.specialty,
                trainer?.specialties,
                trainer?.email,
                trainer?.phone
            ];
            return fields.some((field) => String(field || '').toLowerCase().includes(query));
        });

        list = [...list].sort((a, b) => {
            if (sortBy === 'RATING_DESC') return Number(b?.rating || 0) - Number(a?.rating || 0);
            if (sortBy === 'PRICE_ASC') return Number(a?.sessionPrice || 0) - Number(b?.sessionPrice || 0);
            if (sortBy === 'PRICE_DESC') return Number(b?.sessionPrice || 0) - Number(a?.sessionPrice || 0);
            return String(a?.name || '').localeCompare(String(b?.name || ''));
        });

        return list;
    }, [trainers, search, typeFilter, sortBy]);

    const resolvedSelectedTrainerId = useMemo(() => {
        if (!filteredTrainers.length) return null;
        const stillExists = filteredTrainers.some((trainer) => Number(trainer.id) === Number(selectedTrainerId));
        return stillExists ? selectedTrainerId : filteredTrainers[0].id;
    }, [filteredTrainers, selectedTrainerId]);

    const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
        queryKey: ['staff-trainer-sessions', modalTrainer?.id],
        queryFn: async () => {
            if (!modalTrainer?.id) return [];
            const res = await axios.get(`/api/trainers/${modalTrainer.id}/sessions`);
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: Boolean(modalTrainer?.id && detailTab === 'SESSIONS')
    });
    const { data: trainerChangeRequests = [], isLoading: requestsLoading } = useQuery({
        queryKey: ['staff-trainer-change-requests'],
        queryFn: async () => {
            const res = await axios.get('/api/staff/training-sessions/trainer-change-requests', {
                params: { status: 'PENDING' }
            });
            return Array.isArray(res.data) ? res.data : [];
        }
    });

    const resolveRequestMutation = useMutation({
        mutationFn: async (payload) => {
            if (!resolveModalSession?.id) throw new Error('No request selected');
            return axios.post(`/api/staff/training-sessions/${resolveModalSession.id}/trainer-change-request/resolve`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-trainer-change-requests'] });
            setResolveModalSession(null);
            showAlert({ title: 'Resolved', message: 'Session change request resolved.', type: 'success' });
        },
        onError: (error) => {
            showAlert({ title: 'Resolve Failed', message: error?.response?.data?.error || 'Failed to resolve request.', type: 'danger' });
        }
    });

    const avgRating = useMemo(() => {
        if (!trainers.length) return '0.0';
        const total = trainers.reduce((sum, trainer) => sum + Number(trainer?.rating || 0), 0);
        return (total / trainers.length).toFixed(1);
    }, [trainers]);

    const avgSessionPrice = useMemo(() => {
        if (!trainers.length) return 0;
        const total = trainers.reduce((sum, trainer) => sum + Number(trainer?.sessionPrice || 0), 0);
        return total / trainers.length;
    }, [trainers]);
    const modalAvailabilityRows = useMemo(
        () => (modalTrainer ? getAvailabilityRows(modalTrainer) : []),
        [modalTrainer]
    );
    const modalDurations = useMemo(
        () => (modalTrainer ? getDurations(modalTrainer) : []),
        [modalTrainer]
    );
    const showAvailabilitySingleRow = useMemo(() => {
        if (modalAvailabilityRows.length !== 7) return false;
        const uniqueDays = new Set(modalAvailabilityRows.map((row) => Number(row.day)));
        return [0, 1, 2, 3, 4, 5, 6].every((day) => uniqueDays.has(day));
    }, [modalAvailabilityRows]);
    const isClassBookingRequest = String(resolveModalSession?.requestEntity || '').toUpperCase() === 'CLASS_BOOKING';

    const handleSubmitResolution = async () => {
        if (!resolveModalSession) return;
        const payload = { action: resolveForm.action, note: resolveForm.note };
        if (isClassBookingRequest && payload.action === 'MOVE') {
            await showAlert({
                title: 'Unsupported Action',
                message: 'Move action is not available for class no-show requests. Choose Cancel & Credit, Cancel & Refund, or Deny.',
                type: 'warning'
            });
            return;
        }
        if (payload.action === 'MOVE') {
            if (!resolveForm.date || !resolveForm.time) {
                await showAlert({ title: 'Validation', message: 'Date and time are required for MOVE action.', type: 'warning' });
                return;
            }
            payload.date = resolveForm.date;
            payload.time = resolveForm.time;
        }
        resolveRequestMutation.mutate(payload);
    };

    return (
        <div className="space-y-5 pb-8 animate-fade-in">
            <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trainer Directory</h1>
                    <p className="mt-1 text-sm text-text-muted">Cleaner front-desk layout for trainer lookup and session checks.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setActiveTab('TRAINERS')}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${activeTab === 'TRAINERS'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-white/10 bg-surfaceHighlight text-white hover:border-white/20'
                            }`}
                    >
                        Trainers
                    </button>
                    <button
                        onClick={() => setActiveTab('RESCHEDULE')}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${activeTab === 'RESCHEDULE'
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-white/10 bg-surfaceHighlight text-white hover:border-white/20'
                            }`}
                    >
                        Reschedules {trainerChangeRequests.length > 0 && <span className="ml-1 text-xs font-black text-red-400">({trainerChangeRequests.length})</span>}
                    </button>
                    <p className="text-xs text-text-muted ml-1">Staff View</p>
                </div>
            </header>

            {activeTab === 'TRAINERS' ? (
                <>
                    <section>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                            <article className="rounded-xl border border-white/10 bg-surface p-3">
                                <p className="text-[10px] uppercase tracking-widest text-text-muted">Total Trainers</p>
                                <p className="mt-1.5 text-xl font-bold text-white">{trainers.length}</p>
                            </article>
                            <article className="rounded-xl border border-white/10 bg-surface p-3">
                                <p className="text-[10px] uppercase tracking-widest text-text-muted">Average Rating</p>
                                <p className="mt-1.5 text-xl font-bold text-white">{avgRating}</p>
                            </article>
                            <article className="rounded-xl border border-white/10 bg-surface p-3">
                                <p className="text-[10px] uppercase tracking-widest text-text-muted">Average Session Price</p>
                                <p className="mt-1.5 text-xl font-bold text-white">{formatMoney(avgSessionPrice)}</p>
                            </article>
                            <article className="rounded-xl border border-white/10 bg-surface p-3">
                                <p className="text-[10px] uppercase tracking-widest text-text-muted">Results</p>
                                <p className="mt-1.5 text-xl font-bold text-white">{filteredTrainers.length}</p>
                            </article>
                        </div>
                    </section>

                    <section className="pb-1">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),180px,200px]">
                            <label className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-base text-text-muted">search</span>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search trainer, specialty, email, phone"
                                    className="w-full rounded-xl border border-white/10 bg-surfaceHighlight py-2.5 pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-primary"
                                />
                            </label>
                            <select
                                value={typeFilter}
                                onChange={(event) => setTypeFilter(event.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary"
                            >
                                <option value="ALL">All Types</option>
                                <option value="FULLTIME">Full-time</option>
                                <option value="FREELANCER">Freelancer</option>
                            </select>
                            <select
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-surfaceHighlight px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary"
                            >
                                <option value="NAME_ASC">Sort: Name</option>
                                <option value="RATING_DESC">Sort: Rating</option>
                                <option value="PRICE_ASC">Sort: Price (Low to High)</option>
                                <option value="PRICE_DESC">Sort: Price (High to Low)</option>
                            </select>
                        </div>
                    </section>

                    <section>
                        {isLoading && (
                            <div className="flex items-center justify-center py-16">
                                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                            </div>
                        )}

                        {!isLoading && isError && (
                            <div className="p-4 text-sm text-red-300">Failed to load trainers.</div>
                        )}

                        {!isLoading && !isError && filteredTrainers.length === 0 && (
                            <div className="p-8 text-center text-sm text-text-muted">No trainers match your filters.</div>
                        )}

                        {!isLoading && !isError && (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {filteredTrainers.map((trainer) => {
                                    const isSelected = Number(trainer.id) === Number(resolvedSelectedTrainerId);
                                    const availabilityRows = getAvailabilityRows(trainer);
                                    const availabilitySummary = availabilityRows.length
                                        ? availabilityRows.map((row) => row.label).join(', ')
                                        : 'No schedule';
                                    const type = String(trainer.type || 'FULLTIME').toUpperCase();

                                    return (
                                        <article
                                            key={trainer.id}
                                            onClick={() => setSelectedTrainerId(trainer.id)}
                                            className={`group flex min-h-[325px] flex-col rounded-3xl border p-3 transition-all duration-300 ${isSelected ? 'border-primary/40 bg-primary/5 shadow-primary/10' : 'border-white/5 bg-surface hover:border-primary/20 hover:bg-primary/5 hover:shadow-primary/10'} shadow-sm`}
                                        >
                                            <div className="relative mb-3 aspect-[5/4] overflow-hidden rounded-2xl bg-white/5">
                                                {trainer.imageUrl ? (
                                                    <img src={trainer.imageUrl} alt={trainer.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-text-muted group-hover:text-primary/50 transition-colors">
                                                        <User size={32} />
                                                    </div>
                                                )}
                                                <span className={`absolute right-2 top-2 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${type === 'FREELANCER' ? 'border border-orange-500/40 bg-orange-500/20 text-orange-200' : 'border border-blue-500/40 bg-blue-500/20 text-blue-200'}`}>
                                                    {type === 'FREELANCER' ? 'Freelance' : 'Full-time'}
                                                </span>
                                                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-surface/80 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                                                    <Star size={10} className="text-amber-400 fill-amber-400" />
                                                    {Number(trainer.rating || 0).toFixed(1)}
                                                </span>
                                            </div>

                                            <div className="flex min-h-0 flex-1 flex-col px-1">
                                                <p className="truncate text-base font-bold text-white">{trainer.name}</p>
                                                <p className="truncate text-xs text-text-secondary">{trainer.specialty || 'Trainer'}</p>
                                                <p className="mt-1 truncate text-xs text-text-muted">{availabilitySummary}</p>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="text-primary font-bold">{formatMoney(trainer.sessionPrice || 0)}</span>
                                                    <span className="text-[10px] text-text-muted uppercase tracking-wide">{availabilityRows.length ? `${availabilityRows.length} day(s)` : 'No schedule'}</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelectedTrainerId(trainer.id);
                                                        setDetailTab('PROFILE');
                                                        setModalTrainer(trainer);
                                                    }}
                                                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                                                >
                                                    Profile
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelectedTrainerId(trainer.id);
                                                        setDetailTab('SESSIONS');
                                                        setModalTrainer(trainer);
                                                    }}
                                                    className="flex-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                                                >
                                                    Sessions
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <section className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-white/10">
                        <h3 className="text-white font-bold">Session Change Requests</h3>
                        <p className="text-xs text-text-muted mt-1">Requests submitted by trainers or members for session review.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Session</th>
                                    <th className="px-6 py-4">Member</th>
                                    <th className="px-6 py-4">Trainer</th>
                                    <th className="px-6 py-4">Reason</th>
                                    <th className="px-6 py-4">Preferred</th>
                                    <th className="px-6 py-4">Requested</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {requestsLoading && (
                                    <tr><td colSpan="7" className="p-6 text-center text-text-muted">Loading requests...</td></tr>
                                )}
                                {!requestsLoading && trainerChangeRequests.length === 0 && (
                                    <tr><td colSpan="7" className="p-6 text-center text-text-muted">No pending session change requests.</td></tr>
                                )}
                                {trainerChangeRequests.map((session) => (
                                    <tr key={session.id} className="hover:bg-white/5 transition-colors align-top">
                                        <td className="px-6 py-4 text-white font-medium whitespace-nowrap">
                                            {new Date(session.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(session.date).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {session.member ? `${session.member.firstName} ${session.member.lastName}` : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-white">{session.trainer?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-white">
                                            <p className="text-xs max-w-[280px] whitespace-normal break-words leading-5">
                                                {session.trainerChangeRequest?.request?.reason || 'No reason provided'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-white whitespace-nowrap">
                                            {session.trainerChangeRequest?.request?.preferred
                                                ? formatDateTime(session.trainerChangeRequest.request.preferred)
                                                : <span className="text-text-muted">None</span>}
                                        </td>
                                        <td className="px-6 py-4 text-white whitespace-nowrap">
                                            {session.trainerChangeRequest?.request?.requestedAt
                                                ? formatDateTime(session.trainerChangeRequest.request.requestedAt)
                                                : 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => {
                                                    setResolveModalSession(session);
                                                    const isClassRequest = String(session?.requestEntity || '').toUpperCase() === 'CLASS_BOOKING';
                                                    setResolveForm({ action: isClassRequest ? 'CANCEL_CREDIT' : 'MOVE', date: '', time: '', note: '' });
                                                }}
                                                className="text-xs font-bold px-3 py-1 rounded-lg border border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                                                disabled={resolveRequestMutation.isPending}
                                            >
                                                Resolve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {modalTrainer && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Close modal"
                        onClick={() => setModalTrainer(null)}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
                        <div className="border-b border-white/10 bg-gradient-to-r from-surface to-surfaceHighlight px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                        {modalTrainer.imageUrl ? (
                                            <img src={modalTrainer.imageUrl} alt={modalTrainer.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                <User size={18} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="truncate text-lg font-bold text-white">{modalTrainer.name}</h2>
                                        <p className="truncate text-sm text-text-secondary">{modalTrainer.specialty || 'Trainer'}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-text-secondary">
                                                {String(modalTrainer.type || 'FULLTIME').toUpperCase() === 'FREELANCER' ? 'Freelance' : 'Full-time'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-text-secondary">
                                                <Star size={10} className="text-amber-400 fill-amber-400" />
                                                {Number(modalTrainer.rating || 0).toFixed(1)}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-text-secondary">
                                                {formatMoney(modalTrainer.sessionPrice || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalTrainer(null)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-secondary transition-colors hover:text-white"
                                >
                                    <span className="material-icons-round text-base">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="border-b border-white/10 px-5 py-3">
                            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                                <button
                                    type="button"
                                    onClick={() => setDetailTab('PROFILE')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${detailTab === 'PROFILE' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                                >
                                    Profile
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDetailTab('SESSIONS')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${detailTab === 'SESSIONS' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                                >
                                    Sessions
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto p-5">
                            {detailTab === 'PROFILE' ? (
                                <div className="space-y-5 text-sm">
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Contact</p>
                                            <p className="text-text-secondary">Phone: {modalTrainer.phone || 'N/A'}</p>
                                            <p className="text-text-secondary">Email: {modalTrainer.email || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Session Details</p>
                                            <p className="text-text-secondary">Price: <span className="font-semibold text-white">{formatMoney(modalTrainer.sessionPrice || 0)}</span></p>
                                            <p className="text-text-secondary">Rating: <span className="font-semibold text-white">{Number(modalTrainer.rating || 0).toFixed(1)}</span></p>
                                            <p className="text-text-secondary">Interval: <span className="font-semibold text-white">{Number(modalTrainer.availabilityIntervalMinutes || 30)} minutes</span></p>
                                            <p className="text-text-secondary">Durations: <span className="font-semibold text-white">{modalDurations.join(', ') || 'N/A'}</span></p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Bio</p>
                                        <p className="mt-2 leading-relaxed text-text-secondary">
                                            {modalTrainer.bio || 'No biography provided.'}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Weekly Availability</p>
                                        <div className={`mt-2 ${showAvailabilitySingleRow ? 'flex flex-nowrap gap-1.5 overflow-x-auto pb-1' : 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3'}`}>
                                            {modalAvailabilityRows.length === 0 && (
                                                <p className="text-sm text-text-muted">No availability configured.</p>
                                            )}
                                            {modalAvailabilityRows.map((row) => (
                                                <div key={row.day} className={`rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs ${showAvailabilitySingleRow ? 'min-w-[96px] shrink-0' : ''}`}>
                                                    <p className="font-semibold text-white">{row.label}</p>
                                                    <p className="mt-0.5 text-text-secondary">{row.start} - {row.end}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <section>
                                    {sessionsLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="h-7 w-7 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                        </div>
                                    ) : sessions.length === 0 ? (
                                        <div className="p-4 text-sm text-text-muted">No session history for this trainer.</div>
                                    ) : (
                                        <div className="grid gap-2">
                                            {sessions.map((session) => (
                                                <div key={session.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-white">{session.member ? `${session.member.firstName || ''} ${session.member.lastName || ''}`.trim() : 'N/A'}</p>
                                                            <p className="text-xs text-text-secondary">{formatDateTime(session.date)}</p>
                                                            <p className="mt-1 text-xs text-text-muted">Duration: {Number(session.duration || 0)} min</p>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getStatusClass(session.status)}`}>
                                                            {session.status || 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {resolveModalSession && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Resolve Session Change Request</h2>
                            <p className="text-text-muted text-sm mt-1">
                                {resolveModalSession.member?.firstName} {resolveModalSession.member?.lastName} - {resolveModalSession.trainer?.name}
                            </p>
                        </div>

                        <div className="bg-white/5 rounded-xl p-3 text-xs text-text-muted space-y-1">
                            <p><span className="text-white font-semibold">Current session:</span> {formatDateTime(resolveModalSession.date)}</p>
                            <p><span className="text-white font-semibold">Reason:</span> {resolveModalSession.trainerChangeRequest?.request?.reason || 'N/A'}</p>
                            <p><span className="text-white font-semibold">Preferred:</span> {resolveModalSession.trainerChangeRequest?.request?.preferred ? formatDateTime(resolveModalSession.trainerChangeRequest.request.preferred) : 'None'}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Action</label>
                            <select
                                value={resolveForm.action}
                                onChange={(e) => setResolveForm((prev) => ({ ...prev, action: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                            >
                                {!isClassBookingRequest && <option style={{ color: '#111', backgroundColor: '#fff' }} value="MOVE">Move Session</option>}
                                <option style={{ color: '#111', backgroundColor: '#fff' }} value="CANCEL_CREDIT">Cancel & Credit</option>
                                <option style={{ color: '#111', backgroundColor: '#fff' }} value="CANCEL_REFUND">Cancel & Refund</option>
                                <option style={{ color: '#111', backgroundColor: '#fff' }} value="DENY">Deny Request</option>
                            </select>
                        </div>

                        {resolveForm.action === 'MOVE' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">New Date</label>
                                    <input
                                        type="date"
                                        value={resolveForm.date}
                                        onChange={(e) => setResolveForm((prev) => ({ ...prev, date: e.target.value }))}
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">New Time</label>
                                    <input
                                        type="time"
                                        value={resolveForm.time}
                                        onChange={(e) => setResolveForm((prev) => ({ ...prev, time: e.target.value }))}
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Note (optional)</label>
                            <textarea
                                rows={3}
                                value={resolveForm.note}
                                onChange={(e) => setResolveForm((prev) => ({ ...prev, note: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                placeholder="Add resolution note..."
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                onClick={() => setResolveModalSession(null)}
                                className="px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-white"
                                disabled={resolveRequestMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitResolution}
                                className="px-4 py-2 rounded-xl bg-primary text-background font-semibold hover:brightness-110 disabled:opacity-60"
                                disabled={resolveRequestMutation.isPending}
                            >
                                {resolveRequestMutation.isPending ? 'Saving...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
