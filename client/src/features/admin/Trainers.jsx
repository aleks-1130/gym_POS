import { useConfirm } from '../../context/ConfirmContext';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Star, X, Pencil, Trash2, Plus, QrCode, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import QRCode from 'react-qr-code';

const WEEKDAY_OPTIONS = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 }
];

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
                label: WEEKDAY_OPTIONS.find((item) => item.value === normalizedDay)?.label || String(normalizedDay),
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
    return String(raw).split(',').map((value) => value.trim()).filter(Boolean);
};

const formatMoney = (value) => {
    const amount = Number(value || 0);
    return `P${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const getProfileRequestStatusClass = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PENDING_ADMIN' || normalized === 'PENDING_OWNER') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    if (normalized === 'APPLIED') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    return 'border-red-500/30 bg-red-500/10 text-red-300';
};

const formatProfileRequestStatus = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PENDING_ADMIN' || normalized === 'PENDING_OWNER') return 'Pending Admin Review';
    if (normalized === 'APPLIED') return 'Applied';
    if (normalized === 'REJECTED') return 'Rejected';
    return normalized || 'Unknown';
};

const formatProfileFieldValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

export default function Trainers() {
    const { user } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const queryClient = useQueryClient();
    const { alert: showAlert, confirm: showConfirm } = useConfirm();

    // -- State --
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [viewMode, setViewMode] = useState(null); // 'profile' or 'sessions'
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState('create'); // create | edit
    const [activeTab, setActiveTab] = useState('TRAINERS'); // TRAINERS | RESCHEDULE | PROFILE_UPDATES
    const [resolveModalSession, setResolveModalSession] = useState(null);
    const [resolveForm, setResolveForm] = useState({ action: 'MOVE', date: '', time: '', note: '' });
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginTrainer, setLoginTrainer] = useState(null);
    const [qrTrainer, setQrTrainer] = useState(null);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('NAME_ASC');
    const [selectedTrainerId, setSelectedTrainerId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        type: 'FULLTIME',
        specialty: '',
        specialties: '',
        email: '',
        phone: '',
        experience: '',
        sessionPrice: '',
        sessionDurations: ['60'],
        availabilityByDay: {},
        availabilityIntervalMinutes: 30,
        bio: '',
        imageUrl: '',
        cardImageUrl: '',
        commissionRate: '',
        baseSalary: '',
        createLogin: false,
        loginEmail: '',
        loginPassword: ''
    });

    // -- Queries --
    const { data: trainers = [], isLoading: trainersLoading } = useQuery({
        queryKey: ['trainers'],
        queryFn: async () => {
            const res = await axios.get('/api/trainers');
            return res.data;
        }
    });

    const { data: trainerChangeRequests = [], isLoading: requestsLoading } = useQuery({
        queryKey: ['trainer-change-requests'],
        queryFn: async () => {
            const res = await axios.get('/api/staff/training-sessions/trainer-change-requests', {
                params: { status: 'PENDING' }
            });
            return res.data || [];
        },
        enabled: isAdmin // fetch always so we can show the badge
    });

    const { data: profileChangeRequests = [], isLoading: profileRequestsLoading } = useQuery({
        queryKey: ['trainer-profile-change-requests'],
        queryFn: async () => {
            const res = await axios.get('/api/trainers/change-requests');
            return res.data || [];
        },
        enabled: isAdmin
    });

    const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
        queryKey: ['trainer-sessions', selectedTrainer?.id],
        queryFn: async () => {
            if (!selectedTrainer?.id) return [];
            const res = await axios.get(`/api/trainers/${selectedTrainer.id}/sessions`);
            return res.data;
        },
        enabled: !!selectedTrainer?.id && viewMode === 'sessions'
    });

    // -- Mutations --
    const createTrainerMutation = useMutation({
        mutationFn: async (newTrainer) => {
            return axios.post('/api/trainers', newTrainer);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['trainers']);
            setShowForm(false);
        },
        onError: (error) => {
            showAlert({ title: 'Create Failed', message: error?.response?.data?.error || 'Failed to create trainer.', type: 'danger' });
        }
    });

    const updateTrainerMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            return axios.put(`/api/trainers/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['trainers']);
            setShowForm(false);
        },
        onError: (error) => {
            showAlert({ title: 'Update Failed', message: error?.response?.data?.error || 'Failed to update trainer.', type: 'danger' });
        }
    });

    const deleteTrainerMutation = useMutation({
        mutationFn: async (id) => {
            return axios.delete(`/api/trainers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['trainers']);
        },
        onError: (error) => {
            showAlert({ title: 'Delete Failed', message: error?.response?.data?.error || 'Failed to delete trainer.', type: 'danger' });
        }
    });

    const resolveRequestMutation = useMutation({
        mutationFn: async (payload) => {
            return axios.post(`/api/staff/training-sessions/${resolveModalSession.id}/trainer-change-request/resolve`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['trainer-change-requests']);
            setResolveModalSession(null);
            showAlert({ title: 'Resolved', message: 'Trainer change request resolved.', type: 'success' });
        },
        onError: (error) => {
            showAlert({ title: 'Resolve Failed', message: error?.response?.data?.error || 'Failed to resolve request.', type: 'danger' });
        }
    });

    const createLoginMutation = useMutation({
        mutationFn: async ({ id, creds }) => {
            return axios.post(`/api/trainers/${id}/create-login`, creds);
        },
        onSuccess: () => {
            setShowLoginModal(false);
            setLoginTrainer(null);
            showAlert({ title: 'Login Created', message: 'Trainer login created successfully.', type: 'success' });
        },
        onError: (error) => {
            showAlert({ title: 'Login Failed', message: error?.response?.data?.error || 'Failed to create trainer login.', type: 'danger' });
        }
    });

    const adminReviewProfileRequestMutation = useMutation({
        mutationFn: async ({ id, action }) => {
            return axios.post(`/api/trainers/change-requests/${id}/admin-review`, { action });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['trainer-profile-change-requests']);
            queryClient.invalidateQueries(['trainers']);
            showAlert({ title: 'Updated', message: 'Admin decision saved.', type: 'success' });
        },
        onError: (error) => {
            showAlert({ title: 'Action Failed', message: error?.response?.data?.error || 'Failed to review request.', type: 'danger' });
        }
    });

    // -- Derived Data --
    const totalTrainers = trainers.length;
    const avgRating = totalTrainers
        ? (trainers.reduce((sum, t) => sum + (Number(t.rating) || 0), 0) / totalTrainers).toFixed(1)
        : '0.0';
    const avgSessionPrice = totalTrainers
        ? trainers.reduce((sum, t) => sum + Number(t.sessionPrice || 0), 0) / totalTrainers
        : 0;
    const filteredTrainers = useMemo(() => {
        const query = String(search || '').trim().toLowerCase();
        let list = trainers.filter((trainer) => {
            const type = String(trainer?.type || '').toUpperCase();
            if (typeFilter === 'FULLTIME' && type !== 'FULLTIME') return false;
            if (typeFilter === 'FREELANCER' && type !== 'FREELANCER') return false;
            if (!query) return true;

            const fields = [trainer?.name, trainer?.specialty, trainer?.specialties, trainer?.email, trainer?.phone];
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
    const modalAvailabilityRows = useMemo(
        () => (selectedTrainer ? getAvailabilityRows(selectedTrainer) : []),
        [selectedTrainer]
    );
    const modalDurations = useMemo(
        () => (selectedTrainer ? getDurations(selectedTrainer) : []),
        [selectedTrainer]
    );
    const showAvailabilitySingleRow = useMemo(() => {
        if (modalAvailabilityRows.length !== 7) return false;
        const uniqueDays = new Set(modalAvailabilityRows.map((row) => Number(row.day)));
        return [0, 1, 2, 3, 4, 5, 6].every((day) => uniqueDays.has(day));
    }, [modalAvailabilityRows]);
    const profileRequestBadgeCount = useMemo(
        () => profileChangeRequests.filter((request) => ['PENDING_ADMIN', 'PENDING_OWNER'].includes(String(request?.status || '').toUpperCase())).length,
        [profileChangeRequests]
    );
    const saving = createTrainerMutation.isPending || updateTrainerMutation.isPending;
    const loginSaving = createLoginMutation.isPending;

    // -- Handlers --
    const handleViewProfile = (trainer) => {
        setSelectedTrainerId(trainer.id);
        setSelectedTrainer(trainer);
        setViewMode('profile');
    };

    const handleViewSessions = (trainer) => {
        setSelectedTrainerId(trainer.id);
        setSelectedTrainer(trainer);
        setViewMode('sessions');
    };

    const openCreateForm = () => {
        setFormMode('create');
        setFormData({
            name: '',
            type: 'FULLTIME',
            specialty: '',
            specialties: '',
            email: '',
            phone: '',
            experience: '',
            sessionPrice: '',
            sessionDurations: ['60'],
            availabilityByDay: {},
            availabilityIntervalMinutes: 30,
            bio: '',
            imageUrl: '',
            cardImageUrl: '',
            commissionRate: '',
            baseSalary: '',
            createLogin: false,
            loginEmail: '',
            loginPassword: ''
        });
        setShowForm(true);
        setTimeout(() => {
            const modalContent = document.querySelector('.modal-scroll-container');
            if (modalContent) modalContent.scrollTop = 0;
        }, 0);
    };

    const openEditForm = (trainer) => {
        setFormMode('edit');
        setFormData({
            name: trainer.name || '',
            type: trainer.type || 'FULLTIME',
            specialty: trainer.specialty || '',
            specialties: trainer.specialties || '',
            email: trainer.email || '',
            phone: trainer.phone || '',
            experience: trainer.experience ?? '',
            sessionPrice: trainer.sessionPrice ?? '',
            sessionDurations: trainer.sessionDurations
                ? trainer.sessionDurations.split(',').map((value) => value.trim()).filter(Boolean)
                : ['60'],
            availabilityByDay: trainer.availabilityByDay && typeof trainer.availabilityByDay === 'object'
                ? trainer.availabilityByDay
                : (Array.isArray(trainer.availabilityDays)
                    ? trainer.availabilityDays.reduce((acc, day) => {
                        acc[String(day)] = {
                            start: trainer.availabilityStart || '09:00',
                            end: trainer.availabilityEnd || '18:00'
                        };
                        return acc;
                    })
                    : {}),
            availabilityIntervalMinutes: trainer.availabilityIntervalMinutes || 30,
            bio: trainer.bio || '',
            imageUrl: trainer.imageUrl || '',
            cardImageUrl: trainer.cardImageUrl || '',
            commissionRate: trainer.commissionRate != null ? (trainer.commissionRate * 100).toFixed(0) : '',
            baseSalary: trainer.baseSalary ?? '',
            createLogin: false,
            loginEmail: '',
            loginPassword: ''
        });
        setSelectedTrainer(trainer);
        setShowForm(true);
        setTimeout(() => {
            const modalContent = document.querySelector('.modal-scroll-container');
            if (modalContent) modalContent.scrollTop = 0;
        }, 0);
    };

    const handleFormChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveTrainer = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) { await showAlert({ title: 'Validation', message: 'Trainer name is required.', type: 'warning' }); return; }
        if (formMode === 'create' && formData.createLogin) {
            if (!formData.email) {
                await showAlert({ title: 'Validation', message: 'Trainer email is required to create trainer access.', type: 'warning' }); return;
            }
        }

        const payload = {
            ...formData,
            sessionDurations: formData.sessionDurations.join(','),
            commissionRate: formData.commissionRate ? Number(formData.commissionRate) / 100 : 0,
            commissionRateRaw: formData.commissionRate // Keep raw for UI if needed, but usually we just transform back
        };

        // Cleanup raw field if not needed by backend, strict mode might complain? 
        // Backend usually ignores extra fields.

        if (formMode === 'create') {
            createTrainerMutation.mutate(payload);
        } else if (selectedTrainer) {
            updateTrainerMutation.mutate({ id: selectedTrainer.id, data: payload });
        }
    };

    const handleDeleteTrainer = async (trainer) => {
        if (await showConfirm({ title: "Delete Trainer?", message: `Delete trainer ${trainer.name}?`, confirmLabel: "Delete", type: "danger" })) {
            deleteTrainerMutation.mutate(trainer.id);
        }
    };

    const openLoginModal = (trainer) => {
        setLoginTrainer(trainer);
        setShowLoginModal(true);
    };

    const handleCreateLogin = async (e) => {
        e.preventDefault();
        if (!loginTrainer) return;
        if (!loginTrainer.email) {
            await showAlert({ title: 'No Email', message: 'Trainer does not have an email address set. Please edit the trainer first.', type: 'warning' }); return;
        }
        createLoginMutation.mutate({
            id: loginTrainer.id,
            creds: { loginEmail: loginTrainer.email }
        });
    };

    const handleSubmitResolution = async () => {
        if (!resolveModalSession) return;
        const payload = { action: resolveForm.action, note: resolveForm.note };
        if (payload.action === 'MOVE') {
            if (!resolveForm.date || !resolveForm.time) {
                await showAlert({ title: 'Validation', message: 'Date and time are required for MOVE action.', type: 'warning' }); return;
            }
            payload.date = resolveForm.date;
            payload.time = resolveForm.time;
        }
        resolveRequestMutation.mutate(payload);
    };

    const handleAdminReviewProfileRequest = async (request, action) => {
        const approved = await showConfirm({
            title: action === 'APPROVE' ? 'Approve & Apply Request?' : 'Reject Request?',
            message: action === 'APPROVE'
                ? 'This will apply requested changes to trainer profile/status now.'
                : 'This will reject the trainer update request.',
            confirmLabel: action === 'APPROVE' ? 'Approve & Apply' : 'Reject',
            type: action === 'APPROVE' ? 'info' : 'danger'
        });
        if (!approved) return;
        adminReviewProfileRequestMutation.mutate({ id: request.id, action });
    };

    if (trainersLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trainer Directory</h1>
                    <p className="mt-1 text-sm text-text-muted">Admin view aligned with staff layout and management actions.</p>
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
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('PROFILE_UPDATES')}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${activeTab === 'PROFILE_UPDATES'
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-white/10 bg-surfaceHighlight text-white hover:border-white/20'
                                }`}
                        >
                            Profile Updates {profileRequestBadgeCount > 0 && <span className="ml-1 text-xs font-black text-red-400">({profileRequestBadgeCount})</span>}
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            onClick={openCreateForm}
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-background transition-colors hover:bg-orange-600 flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Add Trainer
                        </button>
                    )}
                </div>
            </header>

            <section>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <article className="rounded-xl border border-white/10 bg-surface p-3">
                        <p className="text-[10px] uppercase tracking-widest text-text-muted">Total Trainers</p>
                        <p className="mt-1.5 text-xl font-bold text-white">{totalTrainers}</p>
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

            {activeTab === 'TRAINERS' && (
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
            )}

            {activeTab === 'PROFILE_UPDATES' ? (
                <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                        <h3 className="text-white font-bold">Trainer Profile/Status Update Requests</h3>
                        <span className="text-xs text-text-muted">{profileChangeRequests.length} request(s)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1080px] table-fixed text-left text-sm text-text-secondary">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 w-[170px]">Requested</th>
                                    <th className="px-6 py-4 w-[190px]">Trainer</th>
                                    <th className="px-6 py-4">Changes</th>
                                    <th className="px-6 py-4 w-[130px]">Status</th>
                                    <th className="px-6 py-4 w-[160px]">Reviewed By</th>
                                    <th className="px-6 py-4 w-[210px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {profileRequestsLoading && (
                                    <tr><td colSpan="6" className="p-6 text-center text-text-muted">Loading requests...</td></tr>
                                )}
                                {!profileRequestsLoading && profileChangeRequests.length === 0 && (
                                    <tr><td colSpan="6" className="p-6 text-center text-text-muted">No trainer profile update requests yet.</td></tr>
                                )}
                                {profileChangeRequests.map((request) => {
                                    const requestStatus = String(request?.status || '').toUpperCase();
                                    const canAdminReview = isAdmin && ['PENDING_ADMIN', 'PENDING_OWNER'].includes(requestStatus);

                                    return (
                                        <tr key={request.id} className="hover:bg-white/5 transition-colors align-top">
                                            <td className="px-6 py-4 text-white whitespace-nowrap">
                                                {new Date(request.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-white">
                                                <p className="font-semibold">{request.trainer?.name || 'Unknown Trainer'}</p>
                                                <p className="text-xs text-text-muted break-all">{request.trainer?.email || 'No email'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-white">
                                                <div className="space-y-1 max-w-[420px]">
                                                    {Object.entries(request.payload || {}).map(([key, value]) => (
                                                        <p key={`${request.id}-${key}`} className="text-xs whitespace-normal break-words [overflow-wrap:anywhere] leading-5">
                                                            <span className="text-text-muted">{key}:</span>{' '}
                                                            <span className="text-red-300 break-all">{formatProfileFieldValue(request.currentData?.[key])}</span>
                                                            {' -> '}
                                                            <span className="text-emerald-300 break-all">{formatProfileFieldValue(value)}</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${getProfileRequestStatusClass(request.status)}`}>
                                                    {formatProfileRequestStatus(request.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-text-muted break-words [overflow-wrap:anywhere]">
                                                {request.adminReviewer?.name ? `${request.adminReviewer.name}` : 'Pending'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {canAdminReview && (
                                                        <>
                                                            <button
                                                                onClick={() => handleAdminReviewProfileRequest(request, 'APPROVE')}
                                                                className="text-xs font-bold px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                                                disabled={adminReviewProfileRequestMutation.isPending}
                                                            >
                                                                Approve & Apply
                                                            </button>
                                                            <button
                                                                onClick={() => handleAdminReviewProfileRequest(request, 'REJECT')}
                                                                className="text-xs font-bold px-3 py-1 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                                                                disabled={adminReviewProfileRequestMutation.isPending}
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {!canAdminReview && (
                                                        <span className="text-xs text-text-muted">No action required</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'RESCHEDULE' ? (
                <div className="bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-white/10">
                        <h3 className="text-white font-bold">Trainer Change Requests</h3>
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
                                    <tr><td colSpan="7" className="p-6 text-center text-text-muted">No pending trainer change requests.</td></tr>
                                )}
                                {trainerChangeRequests.map((session) => (
                                    <tr key={session.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">
                                            {new Date(session.date).toLocaleDateString()} <span className="text-text-muted font-normal text-xs">{new Date(session.date).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {session.member ? `${session.member.firstName} ${session.member.lastName}` : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-white">{session.trainer?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-white">
                                            <p className="text-xs max-w-[280px] whitespace-normal break-words leading-5" title={session.trainerChangeRequest?.request?.reason || ''}>
                                                {session.trainerChangeRequest?.request?.reason || 'No reason provided'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {session.trainerChangeRequest?.request?.preferred
                                                ? new Date(session.trainerChangeRequest.request.preferred).toLocaleString()
                                                : <span className="text-text-muted">None</span>}
                                        </td>
                                        <td className="px-6 py-4 text-white">
                                            {session.trainerChangeRequest?.request?.requestedAt
                                                ? new Date(session.trainerChangeRequest.request.requestedAt).toLocaleString()
                                                : 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => {
                                                    setResolveModalSession(session);
                                                    setResolveForm({ action: 'MOVE', date: '', time: '', note: '' });
                                                }}
                                                className="text-xs font-bold px-3 py-1 rounded-lg border border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                                            >
                                                Resolve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <section>
                    {filteredTrainers.length === 0 ? (
                        <div className="p-8 text-center text-sm text-text-muted">No trainers match your filters.</div>
                    ) : (
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
                                        className={`group relative flex min-h-[325px] flex-col rounded-3xl border p-3 transition-all duration-300 ${isSelected ? 'border-primary/40 bg-primary/5 shadow-primary/10' : 'border-white/5 bg-surface hover:border-primary/20 hover:bg-primary/5 hover:shadow-primary/10'} shadow-sm`}
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
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-base font-bold text-white">{trainer.name}</p>
                                                    <p className="truncate text-xs text-text-secondary">{trainer.specialty || 'Trainer'}</p>
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                                        <button
                                                            onClick={(event) => { event.stopPropagation(); setQrTrainer(trainer); }}
                                                            className="h-7 w-7 rounded-lg border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-300 transition-colors hover:bg-blue-500/20"
                                                            title="View trainer QR"
                                                        >
                                                            <QrCode size={13} />
                                                        </button>
                                                        <button
                                                            onClick={(event) => { event.stopPropagation(); openEditForm(trainer); }}
                                                            className="h-7 w-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-text-muted transition-colors hover:bg-white/10 hover:text-white"
                                                            title="Edit trainer"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            onClick={(event) => { event.stopPropagation(); openLoginModal(trainer); }}
                                                            className="h-7 w-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center text-emerald-400 transition-colors hover:bg-emerald-500/20"
                                                            title="Create trainer login"
                                                        >
                                                            <User size={13} />
                                                        </button>
                                                        <button
                                                            onClick={(event) => { event.stopPropagation(); handleDeleteTrainer(trainer); }}
                                                            className="h-7 w-7 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center justify-center text-red-400 transition-colors hover:bg-red-500/20"
                                                            title="Delete trainer"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-1 truncate text-xs text-text-muted">{availabilitySummary}</p>
                                            <div className="mt-2 flex items-center justify-between">
                                                <span className="font-bold text-primary">{formatMoney(trainer.sessionPrice || 0)}</span>
                                                <span className="text-[10px] text-text-muted uppercase tracking-wide">{availabilityRows.length ? `${availabilityRows.length} day(s)` : 'No schedule'}</span>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleViewProfile(trainer);
                                                }}
                                                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                                            >
                                                Profile
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleViewSessions(trainer);
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
            )}

            {/* Modal for Profile / Sessions */}
            {viewMode && selectedTrainer && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Close modal"
                        onClick={() => setViewMode(null)}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
                        <div className="border-b border-white/10 bg-gradient-to-r from-surface to-surfaceHighlight px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                        {selectedTrainer.imageUrl ? (
                                            <img src={selectedTrainer.imageUrl} alt={selectedTrainer.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-text-muted">
                                                <User size={18} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="truncate text-lg font-bold text-white">{selectedTrainer.name}</h2>
                                        <p className="truncate text-sm text-text-secondary">{selectedTrainer.specialty || 'Trainer'}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-text-secondary">
                                                {String(selectedTrainer.type || 'FULLTIME').toUpperCase() === 'FREELANCER' ? 'Freelance' : 'Full-time'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-text-secondary">
                                                <Star size={10} className="text-amber-400 fill-amber-400" />
                                                {Number(selectedTrainer.rating || 0).toFixed(1)}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-text-secondary">
                                                {formatMoney(selectedTrainer.sessionPrice || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setViewMode(null)}
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
                                    onClick={() => setViewMode('profile')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'profile' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                                >
                                    Profile
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('sessions')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'sessions' ? 'bg-primary text-background' : 'text-text-secondary hover:text-white'}`}
                                >
                                    Sessions
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto p-5">
                            {viewMode === 'profile' ? (
                                <div className="space-y-5 text-sm">
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Contact</p>
                                            <p className="text-text-secondary">Phone: {selectedTrainer.phone || 'N/A'}</p>
                                            <p className="text-text-secondary">Email: {selectedTrainer.email || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Session Details</p>
                                            <p className="text-text-secondary">Price: <span className="font-semibold text-white">{formatMoney(selectedTrainer.sessionPrice || 0)}</span></p>
                                            <p className="text-text-secondary">Rating: <span className="font-semibold text-white">{Number(selectedTrainer.rating || 0).toFixed(1)}</span></p>
                                            <p className="text-text-secondary">Interval: <span className="font-semibold text-white">{Number(selectedTrainer.availabilityIntervalMinutes || 30)} minutes</span></p>
                                            <p className="text-text-secondary">Durations: <span className="font-semibold text-white">{modalDurations.join(', ') || 'N/A'}</span></p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Bio</p>
                                        <p className="mt-2 leading-relaxed text-text-secondary">
                                            {selectedTrainer.bio || 'No biography provided.'}
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

            {/* Trainer Change Resolution Modal */}
            {resolveModalSession && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Resolve Trainer Change Request</h2>
                            <p className="text-text-muted text-sm mt-1">
                                {resolveModalSession.member?.firstName} {resolveModalSession.member?.lastName} • {resolveModalSession.trainer?.name}
                            </p>
                        </div>

                        <div className="bg-white/5 rounded-xl p-3 text-xs text-text-muted space-y-1">
                            <p><span className="text-white font-semibold">Current session:</span> {new Date(resolveModalSession.date).toLocaleString()}</p>
                            <p><span className="text-white font-semibold">Reason:</span> {resolveModalSession.trainerChangeRequest?.request?.reason || 'N/A'}</p>
                            <p><span className="text-white font-semibold">Preferred:</span> {resolveModalSession.trainerChangeRequest?.request?.preferred ? new Date(resolveModalSession.trainerChangeRequest.request.preferred).toLocaleString() : 'None'}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Action</label>
                            <select
                                value={resolveForm.action}
                                onChange={(e) => setResolveForm(p => ({ ...p, action: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                            >
                                <option style={{ color: '#111', backgroundColor: '#fff' }} value="MOVE">Move Session</option>
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
                                        onChange={(e) => setResolveForm(p => ({ ...p, date: e.target.value }))}
                                        className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">New Time</label>
                                    <input
                                        type="time"
                                        value={resolveForm.time}
                                        onChange={(e) => setResolveForm(p => ({ ...p, time: e.target.value }))}
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
                                onChange={(e) => setResolveForm(p => ({ ...p, note: e.target.value }))}
                                className="w-full bg-surfaceHighlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                                placeholder="Add resolution note..."
                            />
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setResolveModalSession(null)}
                                disabled={resolveRequestMutation.isPending}
                                className="flex-1 py-3 text-white font-bold bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitResolution}
                                disabled={resolveRequestMutation.isPending}
                                className="flex-1 py-3 bg-primary hover:brightness-110 disabled:opacity-50 text-background font-bold rounded-xl"
                            >
                                {resolveRequestMutation.isPending ? 'Submitting...' : 'Submit Resolution'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Form Modal */}
            {showForm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[110] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setShowForm(false)}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <form
                            onSubmit={handleSaveTrainer}
                            className="bg-[#1a1d24] w-full max-w-5xl h-[calc(100vh-3rem)] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Form Header */}
                            <div className="sticky top-0 z-10 p-5 sm:p-6 border-b border-white/10 bg-[#1a1d24] flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {formMode === 'create' ? 'Add Trainer' : 'Edit Trainer'}
                                    </h2>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Manage core trainer details
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Form Content */}
                            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#13151a] modal-scroll-container">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Full Name</label>
                                        <input
                                            value={formData.name}
                                            onChange={(e) => handleFormChange('name', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="Trainer name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Trainer Type</label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                handleFormChange('type', val);
                                                if (val === 'FREELANCER') {
                                                    handleFormChange('baseSalary', '0');
                                                    if (!formData.commissionRate || Number(formData.commissionRate) < 40) {
                                                        handleFormChange('commissionRate', '50');
                                                    }
                                                }
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                        >
                                            <option value="FULLTIME" className="bg-[#1a1d24]">Full-time</option>
                                            <option value="FREELANCER" className="bg-[#1a1d24]">Freelancer</option>
                                        </select>
                                        <p className="text-[10px] text-text-muted mt-1">
                                            {formData.type === 'FREELANCER' ? 'Commission 40-100% · No base salary' : 'Commission 0-40% · Has base salary'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Primary Specialty</label>
                                        <input
                                            value={formData.specialty}
                                            onChange={(e) => handleFormChange('specialty', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="Strength, Yoga, HIIT"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Specialties (comma)</label>
                                        <input
                                            value={formData.specialties}
                                            onChange={(e) => handleFormChange('specialties', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="Strength, Mobility, Nutrition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Experience (years)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.experience}
                                            onChange={(e) => handleFormChange('experience', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Session Price</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.sessionPrice}
                                            onChange={(e) => handleFormChange('sessionPrice', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="300"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">
                                            Commission Rate (%) — <span className="text-text-muted">1-on-1 sessions only</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={formData.type === 'FREELANCER' ? 40 : 0}
                                            max={formData.type === 'FREELANCER' ? 100 : 40}
                                            value={formData.commissionRate}
                                            onChange={(e) => handleFormChange('commissionRate', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder={formData.type === 'FREELANCER' ? '50' : '20'}
                                        />
                                        <p className="text-[10px] text-text-muted mt-1">
                                            {formData.type === 'FREELANCER' ? 'Range: 40-100%' : 'Range: 0-40%'}
                                        </p>
                                    </div>
                                    {formData.type !== 'FREELANCER' && (
                                        <div>
                                            <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Base Salary</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.baseSalary}
                                                onChange={(e) => handleFormChange('baseSalary', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                placeholder="20000"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Session Durations</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {['60', '120', '180'].map((value) => {
                                                const isActive = formData.sessionDurations.includes(value);
                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData((prev) => {
                                                                const exists = prev.sessionDurations.includes(value);
                                                                const next = exists
                                                                    ? prev.sessionDurations.filter((item) => item !== value)
                                                                    : [...prev.sessionDurations, value];
                                                                return { ...prev, sessionDurations: next.length ? next : ['60'] };
                                                            });
                                                        }}
                                                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${isActive
                                                            ? 'bg-orange-500/15 text-orange-500 border-orange-500/40'
                                                            : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                                                            }`}
                                                    >
                                                        {value} min
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                                        <p className="text-sm font-semibold text-white mb-3">Trainer Availability</p>
                                        <p className="text-xs text-text-muted mb-3">Members can only book slots inside this schedule.</p>
                                        <div className="mb-4">
                                            <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Available Days</label>
                                            <div className="grid grid-cols-7 gap-2">
                                                {WEEKDAY_OPTIONS.map((day) => {
                                                    const active = Boolean(formData.availabilityByDay?.[String(day.value)]);
                                                    return (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData((prev) => {
                                                                    const key = String(day.value);
                                                                    const nextByDay = { ...(prev.availabilityByDay || {}) };
                                                                    if (nextByDay[key]) {
                                                                        delete nextByDay[key];
                                                                    } else {
                                                                        nextByDay[key] = { start: '09:00', end: '18:00' };
                                                                    }
                                                                    return { ...prev, availabilityByDay: nextByDay };
                                                                });
                                                            }}
                                                            className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-all ${active
                                                                ? 'bg-orange-500/15 text-orange-500 border-orange-500/40'
                                                                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                                                                }`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        {Object.keys(formData.availabilityByDay || {}).length > 0 ? (
                                            <div className="space-y-3">
                                                {Object.keys(formData.availabilityByDay)
                                                    .map(Number)
                                                    .sort((a, b) => a - b)
                                                    .map((dayValue) => {
                                                        const key = String(dayValue);
                                                        const dayConfig = formData.availabilityByDay[key] || { start: '09:00', end: '18:00' };
                                                        const label = WEEKDAY_OPTIONS.find((d) => d.value === dayValue)?.label || key;
                                                        return (
                                                            <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-white/5 rounded-xl p-3 border border-white/10">
                                                                <p className="text-sm font-semibold text-white">{label}</p>
                                                                <div>
                                                                    <label className="block text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">Start Time</label>
                                                                    <input
                                                                        type="time"
                                                                        value={dayConfig.start || '09:00'}
                                                                        onChange={(e) => {
                                                                            const next = { ...(formData.availabilityByDay || {}) };
                                                                            next[key] = { ...next[key], start: e.target.value };
                                                                            setFormData((prev) => ({ ...prev, availabilityByDay: next }));
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">End Time</label>
                                                                    <input
                                                                        type="time"
                                                                        value={dayConfig.end || '18:00'}
                                                                        onChange={(e) => {
                                                                            const next = { ...(formData.availabilityByDay || {}) };
                                                                            next[key] = { ...next[key], end: e.target.value };
                                                                            setFormData((prev) => ({ ...prev, availabilityByDay: next }));
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-text-muted">Select one or more days to configure schedule.</p>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                            <div>
                                                <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Slot Interval</label>
                                                <select
                                                    value={formData.availabilityIntervalMinutes}
                                                    onChange={(e) => handleFormChange('availabilityIntervalMinutes', Number(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                >
                                                    {[15, 30, 45, 60].map((v) => (
                                                        <option key={v} value={v} className="bg-[#1a1d24]">{v} minutes</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleFormChange('email', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="trainer@email.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Phone</label>
                                        <input
                                            value={formData.phone}
                                            onChange={(e) => handleFormChange('phone', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="(000) 000-0000"
                                        />
                                    </div>
                                    {formMode === 'create' && (
                                        <div className="md:col-span-2 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">Create Trainer Login</p>
                                                    <p className="text-xs text-text-muted">Allows trainer to access their own dashboard</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.createLogin}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            createLogin: checked
                                                        }));
                                                    }}
                                                    className="accent-orange-500 w-4 h-4"
                                                />
                                            </div>

                                            {formData.createLogin && (
                                                <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                        <Mail size={20} className="text-orange-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-orange-400 font-medium w-full">
                                                            {formData.email ? (
                                                                <>An activation email will be sent to <strong>{formData.email}</strong>.</>
                                                            ) : (
                                                                <>Please enter an email address above first.</>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-orange-500/70 mt-0.5">They will use this to set their password and log in.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Profile Image URL</label>
                                        <input
                                            value={formData.imageUrl}
                                            onChange={(e) => handleFormChange('imageUrl', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Member Card Image URL</label>
                                        <input
                                            value={formData.cardImageUrl}
                                            onChange={(e) => handleFormChange('cardImageUrl', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Bio</label>
                                    <textarea
                                        value={formData.bio}
                                        onChange={(e) => handleFormChange('bio', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 min-h-[140px]"
                                        placeholder="Trainer background and achievements"
                                    />
                                </div>
                            </div>

                            {/* Form Footer */}
                            <div className="sticky bottom-0 p-5 sm:p-6 border-t border-white/10 bg-[#1a1d24] flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium shadow-lg shadow-orange-500/20 disabled:opacity-70 transition-colors"
                                >
                                    {saving ? 'Saving...' : 'Save Trainer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {showLoginModal && loginTrainer && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[120] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setShowLoginModal(false)}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <form
                            onSubmit={handleCreateLogin}
                            className="bg-[#1a1d24] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                        >
                            <div className="p-5 border-b border-white/10 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Create Trainer Login</h2>
                                    <p className="text-text-muted text-sm mt-1">{loginTrainer.name}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowLoginModal(false)}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-5 bg-[#13151a]">
                                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Mail size={20} className="text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-orange-400">Send Activation Email</h3>
                                        <p className="text-sm text-orange-400/80 mt-1">
                                            {loginTrainer?.email ? (
                                                <>An activation email will be sent to <strong>{loginTrainer.email}</strong> for them to securely set their password.</>
                                            ) : (
                                                <span className="text-red-400 font-medium">This trainer does not have an email address on file. Please edit their profile first.</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 border-t border-white/10 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowLoginModal(false)}
                                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loginSaving || !loginTrainer?.email}
                                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-70 transition-colors"
                                >
                                    {loginSaving ? 'Creating...' : 'Create Login'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {qrTrainer && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[120] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setQrTrainer(null)}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <div className="bg-[#1a1d24] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                            <div className="p-5 border-b border-white/10 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Trainer QR Code</h2>
                                    <p className="text-text-muted text-sm mt-1">{qrTrainer.name}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setQrTrainer(null)}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-6 bg-[#13151a] flex flex-col items-center">
                                <div className="bg-white p-4 rounded-2xl">
                                    <QRCode value={`TRAINER:${qrTrainer.id}`} size={190} />
                                </div>
                                <p className="mt-4 text-white font-mono text-sm">TRAINER:{qrTrainer.id}</p>
                                <p className="mt-1 text-text-muted text-xs uppercase tracking-widest">Scan at access control</p>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}



