import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Star, History, X, Info, Pencil, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import DataTable from '../../components/common/DataTable';

export default function Trainers() {
    const { user } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrainer, setSelectedTrainer] = useState(null);
    const [viewMode, setViewMode] = useState(null); // 'profile' or 'sessions'
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState('create'); // create | edit
    const [saving, setSaving] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginTrainer, setLoginTrainer] = useState(null);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginSaving, setLoginSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        specialty: '',
        specialties: '',
        email: '',
        phone: '',
        experience: '',
        rating: '',
        sessionPrice: '',
        sessionDurations: ['60'],
        availableSlots: '',
        bio: '',
        imageUrl: '',
        createLogin: false,
        loginEmail: '',
        loginPassword: ''
    });
    const totalTrainers = trainers.length;
    const avgRating = totalTrainers
        ? (trainers.reduce((sum, t) => sum + (Number(t.rating) || 0), 0) / totalTrainers).toFixed(1)
        : '0.0';
    const totalClasses = trainers.reduce((sum, t) => sum + (t.classes?.length || 0), 0);

    useEffect(() => {
        fetchTrainers();
    }, []);

    const fetchTrainers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/trainers');
            setTrainers(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch trainers");
            setLoading(false);
        }
    };

    const fetchTrainerSessions = async (trainerId) => {
        setSessionsLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/trainers/${trainerId}/sessions`);
            setSessions(res.data);
            setSessionsLoading(false);
        } catch (error) {
            console.error("Failed to fetch sessions");
            setSessionsLoading(false);
        }
    };

    const handleViewProfile = async (trainer) => {
        setSelectedTrainer(trainer);
        setViewMode('profile');
    };

    const handleViewSessions = async (trainer) => {
        setSelectedTrainer(trainer);
        setViewMode('sessions');
        fetchTrainerSessions(trainer.id);
    };

    const openCreateForm = () => {
        setFormMode('create');
        setFormData({
            name: '',
            specialty: '',
            specialties: '',
            email: '',
            phone: '',
            experience: '',
            rating: '',
            sessionPrice: '',
            sessionDurations: ['60'],
            availableSlots: '',
            bio: '',
            imageUrl: '',
            createLogin: false,
            loginEmail: '',
            loginPassword: ''
        });
        setShowForm(true);
        // Scroll modal to top when opened
        setTimeout(() => {
            const modalContent = document.querySelector('.modal-scroll-container');
            if (modalContent) modalContent.scrollTop = 0;
        }, 0);
    };

    const openEditForm = (trainer) => {
        setFormMode('edit');
        setFormData({
            name: trainer.name || '',
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
            availableSlots: trainer.availableSlots ?? '',
            bio: trainer.bio || '',
            imageUrl: trainer.imageUrl || '',
            createLogin: false,
            loginEmail: '',
            loginPassword: ''
        });
        setSelectedTrainer(trainer);
        setShowForm(true);
        // Scroll modal to top when opened
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
        if (!formData.name.trim()) return alert('Trainer name is required.');
        if (formMode === 'create' && formData.createLogin) {
            if (!formData.loginEmail || !formData.loginPassword) {
                return alert('Login email and password are required to create trainer access.');
            }
        }
        setSaving(true);
        try {
            if (formMode === 'create') {
                await axios.post('http://localhost:5000/api/trainers', {
                    ...formData,
                    sessionDurations: formData.sessionDurations.join(',')
                });
            } else if (selectedTrainer) {
                await axios.put(`http://localhost:5000/api/trainers/${selectedTrainer.id}`, {
                    ...formData,
                    sessionDurations: formData.sessionDurations.join(',')
                });
            }
            setShowForm(false);
            await fetchTrainers();
        } catch (error) {
            alert(error?.response?.data?.error || 'Failed to save trainer.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTrainer = async (trainer) => {
        const confirmed = confirm(`Delete trainer ${trainer.name}?`);
        if (!confirmed) return;
        try {
            await axios.delete(`http://localhost:5000/api/trainers/${trainer.id}`);
            await fetchTrainers();
        } catch (error) {
            alert(error?.response?.data?.error || 'Failed to delete trainer.');
        }
    };

    const openLoginModal = (trainer) => {
        setLoginTrainer(trainer);
        setLoginEmail(trainer.email || '');
        setLoginPassword('');
        setShowLoginModal(true);
    };

    const handleCreateLogin = async (e) => {
        e.preventDefault();
        if (!loginTrainer) return;
        if (!loginEmail || !loginPassword) {
            return alert('Login email and password are required.');
        }
        setLoginSaving(true);
        try {
            await axios.post(`http://localhost:5000/api/trainers/${loginTrainer.id}/create-login`, {
                loginEmail,
                loginPassword
            });
            setShowLoginModal(false);
            setLoginTrainer(null);
        } catch (error) {
            alert(error?.response?.data?.error || 'Failed to create trainer login.');
        } finally {
            setLoginSaving(false);
        }
    };

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
                    <h1 className="text-3xl font-bold text-white">Trainer Management</h1>
                    <p className="text-text-muted mt-1">Create, update, and manage trainer profiles and sessions</p>
                </div>
                <div className="flex flex-wrap gap-3">
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {trainers.map(trainer => (
                    <div key={trainer.id} className="bg-surface p-5 rounded-2xl border border-white/5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>

                        <div className="absolute top-4 right-4 flex gap-2 z-20 pointer-events-auto">
                            {isAdmin && (
                                <>
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
                                <h3 className="text-xl font-bold text-white">{trainer.name}</h3>
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
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Available Slots</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.availableSlots}
                                            onChange={(e) => handleFormChange('availableSlots', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                        />
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
                                                            createLogin: checked,
                                                            loginEmail: checked ? (prev.loginEmail || prev.email || '') : '',
                                                            loginPassword: checked ? prev.loginPassword : ''
                                                        }));
                                                    }}
                                                    className="accent-orange-500 w-4 h-4"
                                                />
                                            </div>

                                            {formData.createLogin && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                    <div>
                                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Login Email</label>
                                                        <input
                                                            type="email"
                                                            value={formData.loginEmail}
                                                            onChange={(e) => handleFormChange('loginEmail', e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                            placeholder="trainer@login.com"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Temporary Password</label>
                                                        <input
                                                            type="password"
                                                            value={formData.loginPassword}
                                                            onChange={(e) => handleFormChange('loginPassword', e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                            placeholder="Set a temp password"
                                                        />
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
                            <div className="p-5 space-y-4 bg-[#13151a]">
                                <div>
                                    <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Login Email</label>
                                    <input
                                        type="email"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                        placeholder="trainer@login.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Temporary Password</label>
                                    <input
                                        type="password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                        placeholder="Set a temp password"
                                    />
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
                                    disabled={loginSaving}
                                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-70 transition-colors"
                                >
                                    {loginSaving ? 'Creating...' : 'Create Login'}
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
