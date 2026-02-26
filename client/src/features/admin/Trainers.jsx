import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Star, History, X, Info, Pencil, Trash2, Plus, QrCode, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import DataTable from '../../components/common/DataTable';
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

export default function Trainers() {
    const { user } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const queryClient = useQueryClient();

    // -- State --
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [viewMode, setViewMode] = useState(null); // 'profile' or 'sessions'
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState('create'); // create | edit
    const [activeTab, setActiveTab] = useState('TRAINERS'); // TRAINERS or RESCHEDULE
    const [resolveModalSession, setResolveModalSession] = useState(null);
    const [resolveForm, setResolveForm] = useState({ action: 'MOVE', date: '', time: '', note: '' });
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginTrainer, setLoginTrainer] = useState(null);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [qrTrainer, setQrTrainer] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        type: 'FULLTIME',
        specialty: '',
        specialties: '',
        email: '',
        phone: '',
        experience: '',
        rating: '',
        sessionPrice: '',
        sessionDurations: ['60'],
        availabilityByDay: {},
        availabilityIntervalMinutes: 30,
        bio: '',
        imageUrl: '',
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
            alert(error?.response?.data?.error || 'Failed to create trainer.');
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
            alert(error?.response?.data?.error || 'Failed to update trainer.');
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
            alert(error?.response?.data?.error || 'Failed to delete trainer.');
        }
    });

    const resolveRequestMutation = useMutation({
        mutationFn: async (payload) => {
            return axios.post(`/api/staff/training-sessions/${resolveModalSession.id}/trainer-change-request/resolve`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['trainer-change-requests']);
            setResolveModalSession(null);
            alert('Trainer change request resolved.');
        },
        onError: (error) => {
            alert(error?.response?.data?.error || 'Failed to resolve request.');
        }
    });

    const createLoginMutation = useMutation({
        mutationFn: async ({ id, creds }) => {
            return axios.post(`/api/trainers/${id}/create-login`, creds);
        },
        onSuccess: () => {
            setShowLoginModal(false);
            setLoginTrainer(null);
            alert('Trainer login created successfully.');
        },
        onError: (error) => {
            alert(error?.response?.data?.error || 'Failed to create trainer login.');
        }
    });

    // -- Derived Data --
    const totalTrainers = trainers.length;
    const avgRating = totalTrainers
        ? (trainers.reduce((sum, t) => sum + (Number(t.rating) || 0), 0) / totalTrainers).toFixed(1)
        : '0.0';
    const totalClasses = trainers.reduce((sum, t) => sum + (t.classes?.length || 0), 0);
    const saving = createTrainerMutation.isPending || updateTrainerMutation.isPending;
    const loginSaving = createLoginMutation.isPending;

    // -- Handlers --
    const handleViewProfile = (trainer) => {
        setSelectedTrainer(trainer);
        setViewMode('profile');
    };

    const handleViewSessions = (trainer) => {
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
            rating: '',
            sessionPrice: '',
            sessionDurations: ['60'],
            availabilityByDay: {},
            availabilityIntervalMinutes: 30,
            bio: '',
            imageUrl: '',
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
            rating: trainer.rating ?? '',
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
                    }, {})
                    : {}),
            availabilityIntervalMinutes: trainer.availabilityIntervalMinutes || 30,
            bio: trainer.bio || '',
            imageUrl: trainer.imageUrl || '',
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

    const handleSaveTrainer = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return alert('Trainer name is required.');
        if (formMode === 'create' && formData.createLogin) {
            if (!formData.email) {
                return alert('Trainer email is required to create trainer access.');
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

    const handleDeleteTrainer = (trainer) => {
        if (confirm(`Delete trainer ${trainer.name}?`)) {
            deleteTrainerMutation.mutate(trainer.id);
        }
    };

    const openLoginModal = (trainer) => {
        setLoginTrainer(trainer);
        setShowLoginModal(true);
    };

    const handleCreateLogin = (e) => {
        e.preventDefault();
        if (!loginTrainer) return;
        if (!loginTrainer.email) {
            return alert('Trainer does not have an email address set. Please edit the trainer first.');
        }
        createLoginMutation.mutate({
            id: loginTrainer.id,
            creds: { loginEmail: loginTrainer.email }
        });
    };

    const handleSubmitResolution = () => {
        if (!resolveModalSession) return;
        const payload = { action: resolveForm.action, note: resolveForm.note };
        if (payload.action === 'MOVE') {
            if (!resolveForm.date || !resolveForm.time) {
                return alert('Date and time are required for MOVE action.');
            }
            payload.date = resolveForm.date;
            payload.time = resolveForm.time;
        }
        resolveRequestMutation.mutate(payload);
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
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Trainer Management</h1>
                    <p className="text-text-muted mt-1">Create, update, and manage trainer profiles and sessions</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setActiveTab(activeTab === 'RESCHEDULE' ? 'TRAINERS' : 'RESCHEDULE')}
                        className={`px-4 py-2 rounded-xl border transition-all text-sm font-semibold flex items-center gap-2 ${activeTab === 'RESCHEDULE' ? 'bg-primary text-background border-primary' : 'bg-surfaceHighlight text-white border-white/10 hover:border-white/20'}`}
                    >
                        Reschedules {trainerChangeRequests.length > 0 && <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === 'RESCHEDULE' ? 'bg-background/20 font-black' : 'bg-red-500 text-white font-black'}`}>{trainerChangeRequests.length}</span>}
                    </button>
                    <div className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-sm text-text-secondary">
                        <span className="text-white font-semibold">{totalTrainers}</span> Trainers
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-sm text-text-secondary">
                        <span className="text-white font-semibold">{totalClasses}</span> Classes
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-surfaceHighlight border border-white/10 text-sm text-text-secondary flex items-center gap-2">
                        <Star size={14} className="text-amber-400" />
                        <span className="text-white font-semibold">{avgRating}</span>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={openCreateForm}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Add Trainer
                        </button>
                    )}
                </div>
            </header>

            {activeTab === 'RESCHEDULE' ? (
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
                                {trainerChangeRequests.length === 0 && (
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
                                            <p className="text-xs max-w-[220px] truncate" title={session.trainerChangeRequest?.request?.reason || ''}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {trainers.map(trainer => (
                        <div key={trainer.id} className="bg-surface p-5 rounded-2xl border border-white/5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>

                            <div className="absolute top-4 right-4 flex gap-2 z-20 pointer-events-auto">
                                {isAdmin && (
                                    <>
                                        <button
                                            onClick={() => setQrTrainer(trainer)}
                                            className="w-9 h-9 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 transition-all"
                                            title="View trainer QR"
                                        >
                                            <QrCode size={16} />
                                        </button>
                                        <button
                                            onClick={() => openEditForm(trainer)}
                                            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-text-muted hover:text-white transition-all"
                                            title="Edit trainer"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => openLoginModal(trainer)}
                                            className="w-9 h-9 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 transition-all"
                                            title="Create trainer login"
                                        >
                                            <User size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTrainer(trainer)}
                                            className="w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 transition-all"
                                            title="Delete trainer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-4 mb-5 relative z-10">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10">
                                    {trainer.imageUrl ? (
                                        <img src={trainer.imageUrl} alt={trainer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-surfaceHighlight flex items-center justify-center">
                                            <User className="text-text-muted" size={26} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold text-white">{trainer.name}</h3>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${trainer.type === 'FREELANCER'
                                            ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                            }`}>
                                            {trainer.type === 'FREELANCER' ? 'Freelance' : 'Full-time'}
                                        </span>
                                    </div>
                                    <p className="text-text-secondary text-sm">{trainer.specialty || 'Elite Coach'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                                    <p className="text-xs text-text-muted mb-1">Classes</p>
                                    <p className="text-lg font-semibold text-white">{trainer.classes?.length || 0}</p>
                                </div>
                                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                                    <p className="text-xs text-text-muted mb-1">Rating</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg font-semibold text-white">{trainer.rating || '5.0'}</p>
                                        <Star className="text-amber-400 fill-amber-400" size={14} />
                                    </div>
                                </div>
                            </div>

                            {(trainer.availabilityByDay && Object.keys(trainer.availabilityByDay).length > 0) && (
                                <div className="mb-5 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                                    <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Availability</p>
                                    <div className="space-y-1">
                                        {Object.keys(trainer.availabilityByDay)
                                            .map(Number)
                                            .sort((a, b) => a - b)
                                            .map((day) => {
                                                const config = trainer.availabilityByDay[String(day)];
                                                const label = WEEKDAY_OPTIONS.find((w) => w.value === day)?.label || day;
                                                return (
                                                    <p key={day} className="text-xs text-white">
                                                        <span className="font-semibold">{label}</span>: {config?.start || '--:--'} - {config?.end || '--:--'}
                                                    </p>
                                                );
                                            })}
                                    </div>
                                    <p className="text-xs text-text-muted mt-2">
                                        Interval: {trainer.availabilityIntervalMinutes || 30} min
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 relative z-10">
                                <button
                                    onClick={() => handleViewProfile(trainer)}
                                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    <Info size={16} className="text-primary" />
                                    Profile
                                </button>
                                <button
                                    onClick={() => handleViewSessions(trainer)}
                                    className="flex-1 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    <History size={16} />
                                    Sessions
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for Profile / Sessions */}
            {viewMode && selectedTrainer && (
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => setViewMode(null)}></div>
                    <div className="relative min-h-full w-full flex items-center justify-center p-4 sm:p-6">
                        <div className="bg-surface w-full max-w-4xl max-h-[92vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="sticky top-0 z-10 p-6 border-b border-white/10 bg-surface/95 backdrop-blur flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10">
                                        {selectedTrainer.imageUrl ? (
                                            <img src={selectedTrainer.imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-surfaceHighlight flex items-center justify-center text-lg font-bold text-primary">
                                                {selectedTrainer.name[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-white leading-none">{selectedTrainer.name}</h2>
                                        <p className="text-text-muted text-sm mt-1">{selectedTrainer.specialty || 'Elite Coach'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewMode('profile')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${viewMode === 'profile'
                                            ? 'bg-primary/15 text-primary border-primary/40'
                                            : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'
                                            }`}
                                    >
                                        Profile
                                    </button>
                                    <button
                                        onClick={() => setViewMode('sessions')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${viewMode === 'sessions'
                                            ? 'bg-primary/15 text-primary border-primary/40'
                                            : 'bg-white/5 text-text-secondary border-white/10 hover:text-white'
                                            }`}
                                    >
                                        Sessions
                                    </button>
                                    <button
                                        onClick={() => setViewMode(null)}
                                        className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                                {viewMode === 'profile' ? (
                                    <div className="space-y-8">
                                        <div className="bg-white/[0.02] rounded-2xl p-6 border border-white/5">
                                            <h3 className="text-lg font-bold text-white mb-4">Biography</h3>
                                            <p className="text-text-secondary leading-relaxed text-lg">
                                                {selectedTrainer.bio || "No biography available for this trainer yet. More details coming soon."}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white/[0.02] rounded-2xl p-6 border border-white/5">
                                                <h3 className="text-lg font-bold text-white mb-4">Specs & Skills</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {(selectedTrainer.specialty || 'Fitness,Coaching,Nutrition').split(',').map((skill, i) => (
                                                        <span key={i} className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-black uppercase tracking-widest">
                                                            {skill.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="bg-white/[0.02] rounded-2xl p-6 border border-white/5">
                                                <h3 className="text-lg font-bold text-white mb-4">Performance</h3>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-text-muted text-sm font-bold uppercase tracking-widest">Global Rating</span>
                                                        <div className="flex items-center gap-1.5 text-amber-500 font-black">
                                                            <span>{selectedTrainer.rating || '5.0'}</span>
                                                            <Star size={16} fill="currentColor" />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-text-muted text-sm font-bold uppercase tracking-widest">Classes Hosted</span>
                                                        <span className="text-white font-black">{selectedTrainer.classes?.length || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {sessionsLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20">
                                                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                                                <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Fetching sessions...</p>
                                            </div>
                                        ) : sessions.length > 0 ? (
                                            <DataTable
                                                columns={[
                                                    {
                                                        header: 'Member',
                                                        accessor: (session) => (
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-full bg-surfaceHighlight flex items-center justify-center font-black text-xs text-text-muted">
                                                                    {session.member?.firstName?.[0]}
                                                                </div>
                                                                <div>
                                                                    <p className="text-white font-black text-sm">{session.member?.firstName} {session.member?.lastName}</p>
                                                                    <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase italic">Member #{session.memberId}</p>
                                                                </div>
                                                            </div>
                                                        )
                                                    },
                                                    {
                                                        header: 'Date & Time',
                                                        accessor: (session) => (
                                                            <div className="flex flex-col">
                                                                <span className="text-white font-bold text-sm">
                                                                    {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                                <span className="text-text-muted text-[10px] font-black uppercase">
                                                                    {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        )
                                                    },
                                                    {
                                                        header: 'Duration',
                                                        accessor: (session) => <span className="font-bold text-white text-sm">{session.duration} min</span>
                                                    },
                                                    {
                                                        header: 'Status',
                                                        accessor: (session) => (
                                                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${session.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                session.status === 'SCHEDULED' ? 'bg-primary/10 text-primary border-primary/20' :
                                                                    'bg-red-500/10 text-red-500 border-red-500/20'
                                                                }`}>
                                                                {session.status}
                                                            </span>
                                                        )
                                                    }
                                                ]}
                                                data={sessions}
                                                isLoading={sessionsLoading}
                                                emptyMessage="No Session History"
                                            />
                                        ) : (
                                            <div className="text-center py-20 bg-white/[0.01] rounded-[2rem] border border-white/5 border-dashed">
                                                <History size={48} className="text-text-muted/20 mx-auto mb-4" />
                                                <h4 className="text-lg font-bold text-white/30">No Session History</h4>
                                                <p className="text-text-muted/20 text-xs font-bold uppercase tracking-widest mt-2">Past training sessions will appear here</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trainer Change Resolution Modal */}
            {resolveModalSession && (
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
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
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
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Rating</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.1"
                                            value={formData.rating}
                                            onChange={(e) => handleFormChange('rating', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Image URL</label>
                                        <input
                                            value={formData.imageUrl}
                                            onChange={(e) => handleFormChange('imageUrl', e.target.value)}
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
                </div>
            )}

            {showLoginModal && loginTrainer && (
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
                </div>
            )}

            {qrTrainer && (
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
